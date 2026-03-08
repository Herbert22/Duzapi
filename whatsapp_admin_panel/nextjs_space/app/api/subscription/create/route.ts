import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PLANS, createCustomer, findCustomerByEmail, createPaymentLink, createSubscription } from '@/lib/asaas';

export const dynamic = 'force-dynamic';

const TRIAL_DURATION_DAYS = 7;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { planId } = body;

    if (!planId || !['monthly', 'yearly'].includes(planId)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    const plan = PLANS[planId as 'monthly' | 'yearly'];

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        subscriptions: {
          where: { status: 'active' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (user.subscriptions.length > 0) {
      return NextResponse.json({ error: 'Você já possui uma assinatura ativa' }, { status: 400 });
    }

    // -----------------------------------------------------------------
    // Determine if this user is eligible for a 7-day trial
    // -----------------------------------------------------------------
    const trialUsedRecord = await prisma.subscription.findFirst({
      where: { userId: user.id, trialUsed: true },
    });
    const isTrialEligible = !trialUsedRecord;

    // -----------------------------------------------------------------
    // Ensure Asaas customer exists
    // -----------------------------------------------------------------
    let asaasCustomerId = user.asaasCustomerId;

    if (!asaasCustomerId) {
      const existingCustomer = await findCustomerByEmail(session.user.email);

      if (existingCustomer) {
        asaasCustomerId = existingCustomer.id;
      } else {
        const newCustomer = await createCustomer({
          name: user.name || session.user.email.split('@')[0],
          email: session.user.email,
        });
        asaasCustomerId = newCustomer.id;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { asaasCustomerId },
      });
    }

    // -----------------------------------------------------------------
    // Create Asaas subscription linked to customer
    // -----------------------------------------------------------------
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + (isTrialEligible ? TRIAL_DURATION_DAYS : 1));
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    let asaasSubscriptionId: string | undefined;
    let paymentUrl: string | undefined;

    try {
      const asaasSub = await createSubscription({
        customer: asaasCustomerId!,
        billingType: 'UNDEFINED',
        value: plan.price,
        nextDueDate: nextDueDateStr,
        cycle: plan.cycle,
        description: plan.description,
      });
      asaasSubscriptionId = asaasSub.id;
    } catch (subError) {
      // Fallback: create payment link if subscription creation fails
      console.warn('Asaas subscription creation failed, using payment link:', subError);
      const paymentLink = await createPaymentLink({
        name: plan.name,
        description: plan.description,
        value: plan.price,
        billingType: 'UNDEFINED',
        chargeType: 'RECURRENT',
        subscriptionCycle: plan.cycle,
        dueDateLimitDays: 7,
      });
      paymentUrl = paymentLink.url;
    }

    // -----------------------------------------------------------------
    // Create subscription record — activate trial immediately if eligible
    // -----------------------------------------------------------------
    const trialEndsAt = isTrialEligible
      ? new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000)
      : undefined;

    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: planId,
        status: isTrialEligible ? 'active' : 'pending',
        priceInCents: plan.priceInCents,
        asaasSubscriptionId,
        asaasPaymentLink: paymentUrl,
        trialEndsAt,
        trialUsed: isTrialEligible,
        startDate: isTrialEligible ? new Date() : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      paymentUrl: paymentUrl ?? null,
      trialActivated: isTrialEligible,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar assinatura' },
      { status: 500 }
    );
  }
}
