import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getClientIP } from '@/lib/rate-limit';
import { logUnauthorizedAccess, logRateLimitExceeded } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const WHATSAPP_URL = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:3000';
const BRIDGE_AUTH_TOKEN = process.env.BRIDGE_AUTH_TOKEN || '';

/** Paths that use the admin API (no tenant API key required) */
const ADMIN_PATHS = ['bot-configs', 'messages', 'funnels', 'uploads'];

/** Paths that need Bearer token but are NOT under /admin/ prefix */
const AUTH_PATHS = ['tenants'];

/** Build the upstream URL.
 *  - Collection endpoints (e.g. /bot-configs) get a trailing slash so FastAPI matches the
 *    router root "/" without a 307 redirect.
 *  - Resource endpoints with an ID (e.g. /bot-configs/{uuid}) must NOT have a trailing
 *    slash, because FastAPI would 307-redirect to remove it and the PUT/POST body is lost.
 */
function backendUrl(path: string, searchParams?: string): string {
  let base: string;
  if (path.startsWith('whatsapp/')) {
    base = `${WHATSAPP_URL}/api/${path.replace('whatsapp/', '')}`;
  } else if (ADMIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    base = `${BACKEND_URL}/api/v1/admin/${path}`;
  } else {
    base = `${BACKEND_URL}/api/v1/${path}`;
  }
  // Only add trailing slash for collection-level paths (no sub-resource / ID after base).
  // A path like "bot-configs" is a collection; "bot-configs/861b5..." has a resource ID.
  const isCollection = ADMIN_PATHS.includes(path) || AUTH_PATHS.includes(path) || path === '';
  if (isCollection && !base.endsWith('/')) {
    base += '/';
  }
  return searchParams ? `${base}?${searchParams}` : base;
}

/** Build headers — adds Bearer token for bridge, admin, and auth-required requests */
function buildHeaders(path: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const needsToken =
    path.startsWith('whatsapp/') ||
    ADMIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) ||
    AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  if (needsToken && BRIDGE_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${BRIDGE_AUTH_TOKEN}`;
  }
  return headers;
}

/**
 * Check if user has an active (non-expired) subscription
 */
async function hasActiveSubscription(userEmail: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      subscriptions: {
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!user || user.subscriptions.length === 0) {
    // Admin users bypass subscription check
    if (user?.role === 'admin') return true;
    return false;
  }

  const sub = user.subscriptions[0];

  // Check if trial has expired
  if (sub.trialEndsAt && !sub.asaasSubscriptionId) {
    if (new Date(sub.trialEndsAt) < new Date()) {
      // Trial expired — mark as expired
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'expired' },
      });
      return false;
    }
  }

  return true;
}

/**
 * Verifica autenticação, subscription e rate limiting
 */
async function checkAuth(request: NextRequest, path: string): Promise<NextResponse | null> {
  // Verifica sessão
  const session = await getServerSession(authOptions);
  if (!session) {
    await logUnauthorizedAccess(request, path);
    return NextResponse.json(
      { error: 'Não autorizado. Faça login para continuar.' },
      { status: 401 }
    );
  }

  // Verifica subscription ativa (skip for billing-related reads)
  const email = session.user?.email;
  if (email && !path.startsWith('billing')) {
    const active = await hasActiveSubscription(email);
    if (!active) {
      return NextResponse.json(
        { error: 'Assinatura inativa ou expirada. Acesse a página de cobrança.', subscriptionRequired: true },
        { status: 403 }
      );
    }
  }

  // Rate limiting por usuário
  const clientIP = getClientIP(request);
  const rateLimitKey = `api:${email || clientIP}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.api);

  if (!rateLimitResult.success) {
    await logRateLimitExceeded(request, rateLimitKey);
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em instantes.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        }
      }
    );
  }

  return null; // Autorizado
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';

  // Verifica autenticação
  const authError = await checkAuth(request, path);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams.toString();
  const url = backendUrl(path, searchParams || undefined);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(path),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar dados do backend', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível. Tente novamente em instantes.' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';

  // Verifica autenticação
  const authError = await checkAuth(request, path);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const url = backendUrl(path);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(path),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';

  // Verifica autenticação
  const authError = await checkAuth(request, path);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const url = backendUrl(path);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: buildHeaders(path),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';

  // Verifica autenticação
  const authError = await checkAuth(request, path);
  if (authError) return authError;

  const url = backendUrl(path);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(path),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 503 });
  }
}
