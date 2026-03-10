import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const body = await request.json();
    const { email } = body;

    // Rate limiting mais restritivo para reenvio
    const rateLimitResult = checkRateLimit(`resend-verification:${email}`, {
      maxAttempts: 3,
      windowMs: 10 * 60 * 1000, // 10 minutos
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Aguarde antes de solicitar novo código' },
        { status: 429 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se usuário existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email já verificado' },
        { status: 400 }
      );
    }

    // Invalidar códigos anteriores
    await prisma.emailVerificationCode.updateMany({
      where: {
        email,
        used: false,
      },
      data: { used: true },
    });

    // Gerar novo código
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.emailVerificationCode.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    // Enviar email
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">DuzAPI</h1>
          <p style="color: #666; margin-top: 5px;">WhatsApp Automation</p>
        </div>

        <div style="background: #f9fafb; padding: 30px; border-radius: 12px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 10px;">Novo código de verificação</h2>
          <p style="color: #666; margin-bottom: 20px;">Use o código abaixo para verificar seu email:</p>

          <div style="background: #7c3aed; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 8px; display: inline-block;">
            ${code}
          </div>

          <p style="color: #999; font-size: 14px; margin-top: 20px;">
            Este código expira em 15 minutos.
          </p>
        </div>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: `${code} é seu código de verificação - DuzAPI`,
      html: htmlBody,
    });

    return NextResponse.json({
      success: true,
      message: 'Novo código enviado',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Erro ao reenviar código' },
      { status: 500 }
    );
  }
}
