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

/* ── Tenant ownership cache (60s TTL) ── */

interface TenantCacheEntry { ids: string[]; expiresAt: number }
const tenantCache = new Map<string, TenantCacheEntry>();

async function getUserTenantIds(userId: string): Promise<string[]> {
  const cached = tenantCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/tenants/by-owner/${userId}`,
      { headers: { Authorization: `Bearer ${BRIDGE_AUTH_TOKEN}` } },
    );
    if (!res.ok) return [];
    const tenants: Array<{ id: string }> = await res.json();
    const ids = tenants.map((t) => t.id);
    tenantCache.set(userId, { ids, expiresAt: Date.now() + 60_000 });
    return ids;
  } catch {
    return [];
  }
}

function clearTenantCache(userId: string) {
  tenantCache.delete(userId);
}

/* ── URL building ── */

function backendUrl(path: string, searchParams?: string): string {
  let base: string;
  if (path.startsWith('whatsapp/')) {
    base = `${WHATSAPP_URL}/api/${path.replace('whatsapp/', '')}`;
  } else if (ADMIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    base = `${BACKEND_URL}/api/v1/admin/${path}`;
  } else {
    base = `${BACKEND_URL}/api/v1/${path}`;
  }
  const isCollection = ADMIN_PATHS.includes(path) || AUTH_PATHS.includes(path) || path === '';
  if (isCollection && !base.endsWith('/')) {
    base += '/';
  }
  return searchParams ? `${base}?${searchParams}` : base;
}

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

/* ── Subscription check ── */

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
    if (user?.role === 'admin') return true;
    return false;
  }

  const sub = user.subscriptions[0];
  if (sub.trialEndsAt && !sub.asaasSubscriptionId) {
    if (new Date(sub.trialEndsAt) < new Date()) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'expired' },
      });
      return false;
    }
  }

  return true;
}

/* ── Auth check — returns session info on success ── */

interface AuthSuccess {
  userId: string;
  email: string;
  role: string;
  isAdmin: boolean;
  tenantIds: string[];
}

async function checkAuth(
  request: NextRequest,
  path: string,
): Promise<NextResponse | AuthSuccess> {
  const session = await getServerSession(authOptions);
  if (!session) {
    await logUnauthorizedAccess(request, path);
    return NextResponse.json(
      { error: 'Não autorizado. Faça login para continuar.' },
      { status: 401 },
    );
  }

  const email = (session.user as { email?: string })?.email || '';
  const userId = (session.user as { id?: string })?.id || '';
  const role = (session.user as { role?: string })?.role || 'user';

  // Subscription check (skip for billing reads)
  if (email && !path.startsWith('billing')) {
    const active = await hasActiveSubscription(email);
    if (!active) {
      return NextResponse.json(
        { error: 'Assinatura inativa ou expirada. Acesse a página de cobrança.', subscriptionRequired: true },
        { status: 403 },
      );
    }
  }

  // Rate limiting
  const clientIP = getClientIP(request);
  const rateLimitKey = `api:${email || clientIP}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.api);
  if (!rateLimitResult.success) {
    await logRateLimitExceeded(request, rateLimitKey);
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } },
    );
  }

  const isAdmin = role === 'admin';
  const tenantIds = isAdmin ? [] : await getUserTenantIds(userId);

  return { userId, email, role, isAdmin, tenantIds };
}

/* ── Tenant isolation helpers ── */

/** Check if a tenant_id is allowed for this user */
function isAllowedTenant(auth: AuthSuccess, tenantId: string): boolean {
  if (auth.isAdmin) return true;
  return auth.tenantIds.includes(tenantId);
}

/** Inject tenant_id into search params for listing endpoints */
function injectTenantFilter(url: string, auth: AuthSuccess, existingParams: string): string {
  if (auth.isAdmin) return url;

  // If user already sent tenant_id, validate it
  const params = new URLSearchParams(existingParams);
  const requestedTenantId = params.get('tenant_id');

  if (requestedTenantId) {
    if (!isAllowedTenant(auth, requestedTenantId)) {
      return ''; // will be caught as empty → 403
    }
    return url; // tenant_id already in URL, and it's valid
  }

  // Auto-inject tenant_id for single-tenant users
  if (auth.tenantIds.length === 1) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tenant_id=${auth.tenantIds[0]}`;
  }

  // Multi-tenant user without tenant_id specified — return unfiltered but proxy will filter response
  return url;
}

/** Filter an array response to only include items belonging to user's tenants */
function filterByTenant(data: unknown, auth: AuthSuccess): unknown {
  if (auth.isAdmin) return data;
  if (!Array.isArray(data)) return data;
  return data.filter((item: Record<string, unknown>) => {
    const tid = item.tenant_id || item.tenantId;
    if (!tid) return true; // items without tenant_id pass through (e.g. user's own data)
    return auth.tenantIds.includes(String(tid));
  });
}

/* ── Listing paths that support tenant_id query param ── */
const LISTING_PATHS = ['bot-configs', 'funnels', 'messages', 'messages/history'];

/* ── HTTP Handlers ── */

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';

  const authResult = await checkAuth(request, path);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const searchParams = request.nextUrl.searchParams.toString();

  try {
    // Tenants listing: non-admin sees only their own tenants
    if (path === 'tenants') {
      if (auth.isAdmin) {
        const url = backendUrl(path, searchParams || undefined);
        const response = await fetch(url, { method: 'GET', headers: buildHeaders(path) });
        if (!response.ok) return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: response.status });
        return NextResponse.json(await response.json());
      }
      // Non-admin: fetch only user's tenants via by-owner endpoint
      const url = `${BACKEND_URL}/api/v1/tenants/by-owner/${auth.userId}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${BRIDGE_AUTH_TOKEN}` } });
      if (!response.ok) return NextResponse.json([], { status: 200 });
      return NextResponse.json(await response.json());
    }

    // WhatsApp sessions: filter response by tenant
    if (path === 'whatsapp/sessions') {
      const url = backendUrl(path, searchParams || undefined);
      const response = await fetch(url, { method: 'GET', headers: buildHeaders(path) });
      if (!response.ok) return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: response.status });
      const data = await response.json();
      if (!auth.isAdmin) {
        const sessions = Array.isArray(data) ? data : data?.sessions ?? [];
        const filtered = sessions.filter((s: Record<string, unknown>) =>
          auth.tenantIds.includes(String(s.tenantId || '')),
        );
        // Preserve original response shape
        if (data?.sessions) {
          return NextResponse.json({ ...data, sessions: filtered, count: filtered.length });
        }
        return NextResponse.json(filtered);
      }
      return NextResponse.json(data);
    }

    // Listing endpoints: inject tenant_id filter
    if (LISTING_PATHS.includes(path)) {
      let url = backendUrl(path, searchParams || undefined);
      url = injectTenantFilter(url, auth, searchParams);
      if (!url) {
        return NextResponse.json({ error: 'Acesso negado a este tenant' }, { status: 403 });
      }
      const response = await fetch(url, { method: 'GET', headers: buildHeaders(path) });
      if (!response.ok) return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: response.status });
      const data = await response.json();
      // Extra safety: filter response for multi-tenant users without explicit tenant_id
      return NextResponse.json(filterByTenant(data, auth));
    }

    // Single resource GET (e.g. /funnels/{id}, /bot-configs/{id})
    const url = backendUrl(path, searchParams || undefined);
    const response = await fetch(url, { method: 'GET', headers: buildHeaders(path) });
    if (!response.ok) return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: response.status });
    const data = await response.json();

    // Validate tenant ownership for single resources
    if (!auth.isAdmin) {
      const tid = (data as Record<string, unknown>)?.tenant_id;
      if (tid && !isAllowedTenant(auth, String(tid))) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível. Tente novamente em instantes.' },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';

  const authResult = await checkAuth(request, path);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const body = await request.json().catch(() => ({}));

  try {
    // Tenant creation: inject owner_id and check maxTenants
    if (path === 'tenants') {
      if (!auth.isAdmin) {
        const user = await prisma.user.findUnique({ where: { email: auth.email }, select: { maxTenants: true } });
        const maxTenants = user?.maxTenants ?? 1;
        if (auth.tenantIds.length >= maxTenants) {
          return NextResponse.json(
            { error: `Limite de ${maxTenants} tenant(s) atingido. Faça upgrade do plano.` },
            { status: 403 },
          );
        }
      }
      body.owner_id = body.owner_id || auth.userId;
      const url = backendUrl(path);
      const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(path),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
        return NextResponse.json(errorData, { status: response.status });
      }
      clearTenantCache(auth.userId);
      return NextResponse.json(await response.json());
    }

    // Other POST: validate tenant_id belongs to user
    if (!auth.isAdmin && body.tenant_id) {
      if (!isAllowedTenant(auth, String(body.tenant_id))) {
        return NextResponse.json({ error: 'Acesso negado a este tenant' }, { status: 403 });
      }
    }

    // WhatsApp session creation: validate tenantId
    if (path.startsWith('whatsapp/') && !auth.isAdmin && body.tenantId) {
      if (!isAllowedTenant(auth, String(body.tenantId))) {
        return NextResponse.json({ error: 'Acesso negado a este tenant' }, { status: 403 });
      }
    }

    const url = backendUrl(path);
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(path),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    return NextResponse.json(await response.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';

  const authResult = await checkAuth(request, path);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const body = await request.json().catch(() => ({}));

  // Validate tenant_id in body for non-admin
  if (!auth.isAdmin && body.tenant_id) {
    if (!isAllowedTenant(auth, String(body.tenant_id))) {
      return NextResponse.json({ error: 'Acesso negado a este tenant' }, { status: 403 });
    }
  }

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

    // Validate ownership of returned resource
    if (!auth.isAdmin) {
      const tid = (data as Record<string, unknown>)?.tenant_id;
      if (tid && !isAllowedTenant(auth, String(tid))) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';

  const authResult = await checkAuth(request, path);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  // For non-admin: pre-check ownership by fetching the resource first
  if (!auth.isAdmin) {
    const checkUrl = backendUrl(path);
    try {
      const checkRes = await fetch(checkUrl, { method: 'GET', headers: buildHeaders(path) });
      if (checkRes.ok) {
        const resource = await checkRes.json();
        const tid = resource?.tenant_id || resource?.tenantId;
        if (tid && !isAllowedTenant(auth, String(tid))) {
          return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }
      }
    } catch { /* proceed with delete attempt */ }
  }

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
