import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin, isAdminError } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
  const status = searchParams.get('status') || '';
  const plan = searchParams.get('plan') || '';

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (plan) where.plan = plan;

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ]);

  // Summary stats
  const [activeCount, trialCount, totalRevenue] = await Promise.all([
    prisma.subscription.count({ where: { status: 'active', trialEndsAt: null } }),
    prisma.subscription.count({
      where: { status: 'active', trialEndsAt: { not: null }, trialUsed: true },
    }),
    prisma.subscription.aggregate({
      where: { status: 'active', trialEndsAt: null },
      _sum: { priceInCents: true },
    }),
  ]);

  const mrr = (totalRevenue._sum.priceInCents || 0) / 100;

  return NextResponse.json({
    subscriptions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    summary: {
      active: activeCount,
      trial: trialCount,
      mrr,
    },
  });
}
