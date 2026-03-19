import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin, isAdminError } from '@/lib/admin-auth';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      maxTenants: true,
      maxMessagesPerMonth: true,
      asaasCustomerId: true,
      createdAt: true,
      updatedAt: true,
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          plan: true,
          status: true,
          priceInCents: true,
          startDate: true,
          endDate: true,
          trialEndsAt: true,
          trialUsed: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  try {
    const body = await request.json();
    const { name, role, maxTenants, maxMessagesPerMonth } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    if (maxTenants !== undefined) data.maxTenants = maxTenants;
    if (maxMessagesPerMonth !== undefined) data.maxMessagesPerMonth = maxMessagesPerMonth;

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, role: true, maxTenants: true, maxMessagesPerMonth: true },
    });

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar usuario' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  // Prevent admin from deleting themselves
  if (auth.user.id === params.id) {
    return NextResponse.json({ error: 'Nao e possivel deletar seu proprio usuario' }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar usuario' }, { status: 500 });
  }
}
