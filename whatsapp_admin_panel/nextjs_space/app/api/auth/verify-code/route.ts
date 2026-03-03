import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const body = await request.json();
    const { email, code } = body;

    // Rate limiting
    const rateLimitResult = checkRateLimit(`verify-code:${clientIP}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000, // 15 minutos
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente mais tarde.' },
        { status: 429 }
      );
    }

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email e código são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar código válido
    const verificationCode = await prisma.emailVerificationCode.findFirst({
      where: {
        email,
        code,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verificationCode) {
      return NextResponse.json(
        { error: 'Código inválido ou expirado' },
        { status: 400 }
      );
    }

    // Marcar código como usado
    await prisma.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { used: true },
    });

    // Verificar email do usuário
    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Email verificado com sucesso',
    });
  } catch (error) {
    console.error('Verify code error:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar código' },
      { status: 500 }
    );
  }
}
