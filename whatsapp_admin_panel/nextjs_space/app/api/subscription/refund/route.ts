import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cancelSubscription, listSubscriptionPayments, refundPayment } from '@/lib/asaas';

export const dynamic = 'force-dynamic';

const FREE_MAX_TENANTS = 1;
const FREE_MAX_MESSAGES = 500;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        subscriptions: {
          where: { status: { in: ['active', 'pending'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user || user.subscriptions.length === 0) {
      return NextResponse.json({ error: 'Nenhuma assinatura ativa encontrada' }, { status: 404 });
    }

    const sub = user.subscriptions[0];

    // Trial users cannot request refund (no payment was made)
    if (sub.trialEndsAt && !sub.asaasSubscriptionId) {
      return NextResponse.json(
        { error: 'Assinaturas em trial não possuem pagamento para estorno.' },
        { status: 400 }
      );
    }

    if (!sub.asaasSubscriptionId) {
      return NextResponse.json(
        { error: 'Assinatura sem vínculo com gateway de pagamento.' },
        { status: 400 }
      );
    }

    // Find the most recent confirmed payment for this subscription
    let refunded = false;
    try {
      const payments = await listSubscriptionPayments(sub.asaasSubscriptionId);
      const confirmedPayment = payments.find(
        (p) => p.status === 'CONFIRMED' || p.status === 'RECEIVED'
      );

      if (confirmedPayment) {
        refunded = await refundPayment(confirmedPayment.id);
      }
    } catch (refundError) {
      console.error('Asaas refund error:', refundError);
    }

    // Cancel the subscription in Asaas
    try {
      await cancelSubscription(sub.asaasSubscriptionId);
    } catch (cancelError) {
      console.error('Asaas cancel after refund error:', cancelError);
    }

    // Update local subscription
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'cancelled',
        endDate: new Date(),
      },
    });

    // Downgrade user limits
    await prisma.user.update({
      where: { id: user.id },
      data: {
        maxTenants: FREE_MAX_TENANTS,
        maxMessagesPerMonth: FREE_MAX_MESSAGES,
      },
    });

    return NextResponse.json({
      success: true,
      refunded,
      message: refunded
        ? 'Assinatura cancelada e estorno solicitado com sucesso.'
        : 'Assinatura cancelada. Não foi possível processar o estorno automaticamente — entre em contato com o suporte.',
    });
  } catch (error) {
    console.error('Refund subscription error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar estorno' },
      { status: 500 }
    );
  }
}
