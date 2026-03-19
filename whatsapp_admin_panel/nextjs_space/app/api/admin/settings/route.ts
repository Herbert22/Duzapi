import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin, isAdminError } from '@/lib/admin-auth';

export async function GET() {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  const settings = await prisma.systemSetting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  return NextResponse.json(map);
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (isAdminError(auth)) return auth;

  try {
    const body = await request.json() as Record<string, string>;

    const operations = Object.entries(body).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar configuracoes' }, { status: 500 });
  }
}
