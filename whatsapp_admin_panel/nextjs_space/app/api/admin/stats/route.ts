import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin, isAdminError } from '@/lib/admin-auth';

export async function GET() {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersLast30,
    activeSubscriptions,
    trialSubscriptions,
    cancelledSubscriptions,
    revenueAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.subscription.count({ where: { status: 'active', trialEndsAt: null } }),
    prisma.subscription.count({
      where: { status: 'active', trialEndsAt: { not: null } },
    }),
    prisma.subscription.count({ where: { status: 'cancelled' } }),
    prisma.subscription.aggregate({
      where: { status: 'active', trialEndsAt: null },
      _sum: { priceInCents: true },
    }),
  ]);

  const mrr = (revenueAgg._sum.priceInCents || 0) / 100;

  // Monthly signups for chart (last 6 months)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const monthlySignups = await prisma.user.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: sixMonthsAgo } },
    _count: true,
  });

  // Aggregate by month
  const signupsByMonth: Record<string, number> = {};
  for (const entry of monthlySignups) {
    const d = new Date(entry.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    signupsByMonth[key] = (signupsByMonth[key] || 0) + entry._count;
  }

  return NextResponse.json({
    totalUsers,
    newUsersLast30,
    activeSubscriptions,
    trialSubscriptions,
    cancelledSubscriptions,
    mrr,
    signupsByMonth,
  });
}
