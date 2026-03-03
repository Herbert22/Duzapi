import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getClientIP } from '@/lib/rate-limit';
import { signupSchema, validateInput, formatZodErrors } from '@/lib/validation';
import { logAudit, logRateLimitExceeded, getRequestInfo } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const body = await request.json();

    // Rate limiting por IP
    const rateLimitResult = checkRateLimit(`signup:${clientIP}`, RATE_LIMIT_CONFIGS.signup);
    if (!rateLimitResult.success) {
      await logRateLimitExceeded(request, `signup:${clientIP}`);
      return NextResponse.json(
        { 
          error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.',
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
    const validation = validateInput(signupSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodErrors(validation.errors) },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Usuário já existe' },
        { status: 400 }
      );
    }

    // Hash com salt factor maior para segurança
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        role: 'admin',
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestInfo(request);
    await logAudit({
      action: 'SIGNUP',
      userId: user.id,
      userEmail: user.email,
      ipAddress,
      userAgent,
      success: true,
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
