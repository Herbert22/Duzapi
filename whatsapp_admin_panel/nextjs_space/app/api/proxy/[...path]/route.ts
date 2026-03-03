import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getClientIP } from '@/lib/rate-limit';
import { logUnauthorizedAccess, logRateLimitExceeded } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const WHATSAPP_URL = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:3000';

/**
 * Verifica autenticação e rate limiting
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

  // Rate limiting por usuário
  const clientIP = getClientIP(request);
  const rateLimitKey = `api:${session.user?.email || clientIP}`;
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
  const url = path.startsWith('whatsapp/')
    ? `${WHATSAPP_URL}/api/${path.replace('whatsapp/', '')}${searchParams ? `?${searchParams}` : ''}`
    : `${BACKEND_URL}/api/v1/${path}${searchParams ? `?${searchParams}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      // Return empty data for common endpoints when backend returns error
      if (path.includes('stats')) {
        return NextResponse.json({
          total_messages: 0,
          messages_today: 0,
          messages_last_24h: 0,
          audio_messages: 0,
          text_messages: 0,
        });
      }
      if (path.includes('sessions') || path.includes('tenants') || path.includes('configs') || path.includes('history')) {
        return NextResponse.json([]);
      }
      return NextResponse.json(
        { error: 'Backend request failed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    // Return empty data instead of error when backend is unavailable
    if (path.includes('stats')) {
      return NextResponse.json({
        total_messages: 0,
        messages_today: 0,
        messages_last_24h: 0,
        audio_messages: 0,
        text_messages: 0,
      });
    }
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';
  
  // Verifica autenticação
  const authError = await checkAuth(request, path);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const url = path.startsWith('whatsapp/')
    ? `${WHATSAPP_URL}/api/${path.replace('whatsapp/', '')}`
    : `${BACKEND_URL}/api/v1/${path}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';
  
  // Verifica autenticação
  const authError = await checkAuth(request, path);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const url = `${BACKEND_URL}/api/v1/${path}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params?.path?.join('/') ?? '';
  
  // Verifica autenticação
  const authError = await checkAuth(request, path);
  if (authError) return authError;

  const url = `${BACKEND_URL}/api/v1/${path}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
