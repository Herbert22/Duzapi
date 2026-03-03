import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getClientIP } from '@/lib/rate-limit';
import { loginSchema, validateInput, formatZodErrors } from '@/lib/validation';
import { logLoginAttempt, logRateLimitExceeded } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const body = await request.json();

    // Rate limiting por IP
    const rateLimitResult = checkRateLimit(`login:${clientIP}`, RATE_LIMIT_CONFIGS.login);
    if (!rateLimitResult.success) {
      await logRateLimitExceeded(request, `login:${clientIP}`);
      return NextResponse.json(
        { 
          error: 'Muitas tentativas de login. Tente novamente mais tarde.',
          retryAfter: rateLimitResult.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter),
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // Validação com Zod
    const validation = validateInput(loginSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodErrors(validation.errors) },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      await logLoginAttempt(email, false, request, 'Usuário não encontrado');
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      await logLoginAttempt(email, false, request, 'Senha incorreta');
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Login bem-sucedido
    await logLoginAttempt(email, true, request);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
