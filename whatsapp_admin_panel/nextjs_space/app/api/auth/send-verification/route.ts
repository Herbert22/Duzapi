import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getClientIP } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const body = await request.json();
    const { email, name, password } = body;

    // Rate limiting
    const rateLimitResult = checkRateLimit(`send-verification:${clientIP}`, RATE_LIMIT_CONFIGS.signup);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente mais tarde.' },
        { status: 429 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.emailVerified) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 400 }
      );
    }

    // Gerar código
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salvar código no banco
    await prisma.emailVerificationCode.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    // Se usuário não existe, criar com email não verificado
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: hashedPassword,
          role: 'user',
        },
      });
    }

    // Enviar email com código via SMTP
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">DuzAPI</h1>
          <p style="color: #666; margin-top: 5px;">WhatsApp Automation</p>
        </div>

        <div style="background: #f9fafb; padding: 30px; border-radius: 12px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 10px;">Seu código de verificação</h2>
          <p style="color: #666; margin-bottom: 20px;">Use o código abaixo para verificar seu email:</p>

          <div style="background: #7c3aed; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 8px; display: inline-block;">
            ${code}
          </div>

          <p style="color: #999; font-size: 14px; margin-top: 20px;">
            Este código expira em 15 minutos.
          </p>
        </div>

        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
          Se você não solicitou este código, ignore este email.
        </p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: `${code} é seu código de verificação - DuzAPI`,
      html: htmlBody,
    });

    return NextResponse.json({
      success: true,
      message: 'Código enviado para seu email',
    });
  } catch (error) {
    console.error('Send verification error:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar código de verificação' },
      { status: 500 }
    );
  }
}
