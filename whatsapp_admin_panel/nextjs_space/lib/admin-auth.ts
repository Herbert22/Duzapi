import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import { prisma } from './db';

/**
 * API route admin role check.
 * Returns the user if admin, or a NextResponse error.
 */
export async function verifyAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, email: true, name: true },
  });

  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  return { user };
}

/** Type guard to check if verifyAdmin returned an error response */
export function isAdminError(result: Awaited<ReturnType<typeof verifyAdmin>>): result is NextResponse {
  return result instanceof NextResponse;
}
