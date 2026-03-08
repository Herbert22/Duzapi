import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Limits granted on paid subscription activation
const PAID_MAX_TENANTS = 5;
const PAID_MAX_MESSAGES = 10000;

// Default limits for free/expired users
const FREE_MAX_TENANTS = 1;
const FREE_MAX_MESSAGES = 500;

const VALID_EVENTS = [
  'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE',
  'PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED',
  'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_EXPIRED',
];

function verifyAsaasSignature(request: NextRequest): boolean {
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!webhookToken) {
    // In production, reject if token not configured
    if (process.env.NODE_ENV === 'production') return false;
    // In dev, allow for testing
    return true;
  }
  const header = request.headers.get('asaas-access-token') || '';
  return header === webhookToken;
}

export async function POST(request: NextRequest) {
  if (!verifyAsaasSignature(request)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { event, subscription } = body;

    // Log unhandled events
    if (!VALID_EVENTS.includes(event)) {
      console.warn(`[WEBHOOK] Unknown Asaas event: ${event}`, JSON.stringify(body).slice(0, 500));
      return NextResponse.json({ received: true, handled: false });
    }

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

          // Upgrade user limits on paid payment
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
    // Payment overdue — mark subscription as pending
    // ------------------------------------------------------------------
    if (event === 'PAYMENT_OVERDUE') {
      if (subscription?.id) {
        const sub = await prisma.subscription.findFirst({
          where: { asaasSubscriptionId: subscription.id },
        });

        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'pending' },
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // Payment refunded/chargeback — downgrade immediately
    // ------------------------------------------------------------------
    if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_CHARGEBACK_REQUESTED') {
      if (subscription?.id) {
        const sub = await prisma.subscription.findFirst({
          where: { asaasSubscriptionId: subscription.id },
        });

        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'cancelled', endDate: new Date() },
          });

          await prisma.user.update({
            where: { id: sub.userId },
            data: {
              maxTenants: FREE_MAX_TENANTS,
              maxMessagesPerMonth: FREE_MAX_MESSAGES,
            },
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // Subscription created — link Asaas ID (trial already handled in create route)
    // ------------------------------------------------------------------
    if (event === 'SUBSCRIPTION_CREATED') {
      const customerEmail = body.subscription?.customer?.email;

      if (customerEmail && subscription?.id) {
        const user = await prisma.user.findUnique({
          where: { email: customerEmail },
          include: {
            subscriptions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (user?.subscriptions[0]) {
          // Only link the Asaas subscription ID — don't re-activate trial
          await prisma.subscription.update({
            where: { id: user.subscriptions[0].id },
            data: { asaasSubscriptionId: subscription.id },
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

          // Downgrade user limits
          await prisma.user.update({
            where: { id: sub.userId },
            data: {
              maxTenants: FREE_MAX_TENANTS,
              maxMessagesPerMonth: FREE_MAX_MESSAGES,
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
