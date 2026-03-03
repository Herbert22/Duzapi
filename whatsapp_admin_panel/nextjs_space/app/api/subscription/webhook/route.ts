import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Limits granted on paid subscription activation
const PAID_MAX_TENANTS = 5;
const PAID_MAX_MESSAGES = 10000;

function verifyAsaasSignature(request: NextRequest): boolean {
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!webhookToken) return true; // not configured — skip verification in dev
  const header = request.headers.get('asaas-access-token') || '';
  return header === webhookToken;
}

export async function POST(request: NextRequest) {
  if (!verifyAsaasSignature(request)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { event, payment, subscription } = body;

    // ------------------------------------------------------------------
    // Payment confirmed — activate subscription and upgrade limits
    // ------------------------------------------------------------------
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      if (subscription?.id) {
        const sub = await prisma.subscription.findFirst({
          where: { asaasSubscriptionId: subscription.id },
          include: { user: true },
        });

        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'active', startDate: new Date() },
          });

          // Upgrade user limits on first paid payment
          await prisma.user.update({
            where: { id: sub.userId },
            data: {
              maxTenants: PAID_MAX_TENANTS,
              maxMessagesPerMonth: PAID_MAX_MESSAGES,
            },
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // Subscription created — link Asaas ID and activate trial if eligible
    // ------------------------------------------------------------------
    if (event === 'SUBSCRIPTION_CREATED') {
      const customerEmail = body.subscription?.customer?.email;

      if (customerEmail && subscription?.id) {
        const user = await prisma.user.findUnique({
          where: { email: customerEmail },
          include: {
            subscriptions: {
              where: { status: 'pending' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (user?.subscriptions[0]) {
          const trialUsed = await prisma.subscription.findFirst({
            where: { userId: user.id, trialUsed: true },
          });

          const updateData: {
            asaasSubscriptionId: string;
            trialEndsAt?: Date;
            trialUsed?: boolean;
            status?: string;
          } = { asaasSubscriptionId: subscription.id };

          // Grant 7-day trial on first subscription
          if (!trialUsed) {
            const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            updateData.trialEndsAt = trialEndsAt;
            updateData.trialUsed = true;
            updateData.status = 'active';
          }

          await prisma.subscription.update({
            where: { id: user.subscriptions[0].id },
            data: updateData,
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // Subscription cancelled or expired — downgrade limits
    // ------------------------------------------------------------------
    if (event === 'SUBSCRIPTION_CANCELLED' || event === 'SUBSCRIPTION_EXPIRED') {
      if (subscription?.id) {
        const sub = await prisma.subscription.findFirst({
          where: { asaasSubscriptionId: subscription.id },
        });

        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: event === 'SUBSCRIPTION_CANCELLED' ? 'cancelled' : 'expired',
              endDate: new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
