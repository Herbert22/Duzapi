import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './auth';
import { prisma } from './db';

/**
 * Server-side admin role check for page components.
 * Redirects to /dashboard if user is not admin.
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, email: true, name: true },
  });

  if (!user || user.role !== 'admin') redirect('/dashboard');
  return user;
}
