import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin, isAdminError } from '@/lib/admin-auth';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  const subscription = await prisma.subscription.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, maxTenants: true, maxMessagesPerMonth: true } },
    },
  });

  if (!subscription) {
    return NextResponse.json({ error: 'Assinatura nao encontrada' }, { status: 404 });
  }

  return NextResponse.json(subscription);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  try {
    const body = await request.json();
    const { action, endDate } = body;

    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
      include: { user: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Assinatura nao encontrada' }, { status: 404 });
    }

    if (action === 'activate') {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: params.id },
          data: { status: 'active', startDate: new Date() },
        }),
        prisma.user.update({
          where: { id: subscription.userId },
          data: { maxTenants: 5, maxMessagesPerMonth: 10000 },
        }),
      ]);
    } else if (action === 'cancel') {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: params.id },
          data: { status: 'cancelled', endDate: new Date() },
        }),
        prisma.user.update({
          where: { id: subscription.userId },
          data: { maxTenants: 1, maxMessagesPerMonth: 500 },
        }),
      ]);
    } else if (action === 'extend' && endDate) {
      await prisma.subscription.update({
        where: { id: params.id },
        data: { endDate: new Date(endDate), status: 'active' },
      });
    } else {
      return NextResponse.json({ error: 'Acao invalida' }, { status: 400 });
    }

    const updated = await prisma.subscription.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar assinatura' }, { status: 500 });
  }
}
