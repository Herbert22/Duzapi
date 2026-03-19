import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Default limits for free/expired users
const FREE_MAX_TENANTS = 1;
const FREE_MAX_MESSAGES = 500;

// Default limits for paid users (fallback if plan not found in DB)
const DEFAULT_PAID_MAX_TENANTS = 5;
const DEFAULT_PAID_MAX_MESSAGES = 10000;

async function getPaidLimits(planSlug: string) {
  try {
    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
    if (plan) return { maxTenants: plan.maxTenants, maxMessagesPerMonth: plan.maxMessagesPerMonth };
  } catch { /* fallback */ }
  return { maxTenants: DEFAULT_PAID_MAX_TENANTS, maxMessagesPerMonth: DEFAULT_PAID_MAX_MESSAGES };
}

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
    const { event } = body;

    console.log(`[WEBHOOK] Asaas event: ${event}`, JSON.stringify(body).slice(0, 500));

    // Log unhandled events
    if (!VALID_EVENTS.includes(event)) {
      console.warn(`[WEBHOOK] Unknown Asaas event: ${event}`);
      return NextResponse.json({ received: true, handled: false });
    }

    // Asaas sends subscription ID in different places depending on event type:
    // - Payment events: body.payment.subscription (string ID)
    // - Subscription events: body.subscription.id (object with id)
    const subscriptionId = body.payment?.subscription || body.subscription?.id;

    // ------------------------------------------------------------------
    // Payment confirmed — activate subscription and upgrade limits
    // ------------------------------------------------------------------
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      if (subscriptionId) {
        const sub = await prisma.subscription.findFirst({
          where: { asaasSubscriptionId: subscriptionId },
          include: { user: true },
        });

        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'active', startDate: new Date() },
          });

          // Upgrade user limits based on plan
          const limits = await getPaidLimits(sub.plan);
          await prisma.user.update({
            where: { id: sub.userId },
            data: limits,
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // Payment overdue — mark subscription as pending
    // ------------------------------------------------------------------
    if (event === 'PAYMENT_OVERDUE') {
      if (subscriptionId) {
        const sub = await prisma.subscription.findFirst({
          where: { asaasSubscriptionId: subscriptionId },
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
      if (subscriptionId) {
        const sub = await prisma.subscription.findFirst({
          where: { asaasSubscriptionId: subscriptionId },
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
      const subId = body.subscription?.id;
      const customerEmail = body.subscription?.customer?.email
        // Asaas may also send customer as a string ID, try to extract email from payment
        || body.subscription?.customerEmail;

      if (customerEmail && subId) {
        const user = await prisma.user.findUnique({
          where: { email: customerEmail },
          include: {
            subscriptions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (user?.subscriptions[0] && !user.subscriptions[0].asaasSubscriptionId) {
          // Only link the Asaas subscription ID — don't re-activate trial
          await prisma.subscription.update({
            where: { id: user.subscriptions[0].id },
            data: { asaasSubscriptionId: subId },
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // Subscription cancelled or expired — downgrade limits
    // ------------------------------------------------------------------
    if (event === 'SUBSCRIPTION_CANCELLED' || event === 'SUBSCRIPTION_EXPIRED') {
      if (subscriptionId) {
        const sub = await prisma.subscription.findFirst({
          where: { asaasSubscriptionId: subscriptionId },
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
