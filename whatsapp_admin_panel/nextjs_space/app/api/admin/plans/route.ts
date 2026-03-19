import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin, isAdminError } from '@/lib/admin-auth';

export async function GET() {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json(plans);
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  try {
    const body = await request.json();
    const { slug, name, priceInCents, cycle, description, features, maxTenants, maxMessagesPerMonth, sortOrder } = body;

    if (!slug || !name || !priceInCents || !cycle) {
      return NextResponse.json({ error: 'Campos obrigatorios: slug, name, priceInCents, cycle' }, { status: 400 });
    }

    const existing = await prisma.plan.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'Slug ja existe' }, { status: 409 });
    }

    const plan = await prisma.plan.create({
      data: {
        slug,
        name,
        priceInCents,
        cycle,
        description: description || null,
        features: features || [],
        maxTenants: maxTenants || 5,
        maxMessagesPerMonth: maxMessagesPerMonth || 10000,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erro ao criar plano' }, { status: 500 });
  }
}
