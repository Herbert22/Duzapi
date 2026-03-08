import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cancelSubscription } from '@/lib/asaas';

export const dynamic = 'force-dynamic';

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

    // Cancel in Asaas if linked
    if (sub.asaasSubscriptionId) {
      try {
        await cancelSubscription(sub.asaasSubscriptionId);
      } catch (asaasError) {
        console.error('Asaas cancel error:', asaasError);
        // Continue to cancel locally even if Asaas fails
      }
    }

    // Cancel locally
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'cancelled',
        endDate: new Date(),
      },
    });

    // Reset user limits
    await prisma.user.update({
      where: { id: user.id },
      data: {
        maxTenants: 1,
        maxMessagesPerMonth: 500,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Assinatura cancelada com sucesso.',
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar assinatura' },
      { status: 500 }
    );
  }
}
