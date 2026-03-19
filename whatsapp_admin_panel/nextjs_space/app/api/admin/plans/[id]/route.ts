import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin, isAdminError } from '@/lib/admin-auth';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  try {
    const body = await request.json();
    const { name, priceInCents, cycle, description, features, maxTenants, maxMessagesPerMonth, isActive, sortOrder } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (priceInCents !== undefined) data.priceInCents = priceInCents;
    if (cycle !== undefined) data.cycle = cycle;
    if (description !== undefined) data.description = description;
    if (features !== undefined) data.features = features;
    if (maxTenants !== undefined) data.maxTenants = maxTenants;
    if (maxMessagesPerMonth !== undefined) data.maxMessagesPerMonth = maxMessagesPerMonth;
    if (isActive !== undefined) data.isActive = isActive;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const plan = await prisma.plan.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  try {
    // Soft delete — just deactivate
    const plan = await prisma.plan.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ error: 'Erro ao desativar plano' }, { status: 500 });
  }
}
