import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Always return success to avoid leaking which emails exist
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      // Invalidate any previous unused tokens for this email
      await prisma.passwordResetToken.updateMany({
        where: { email: normalizedEmail, used: false },
        data: { used: true },
      });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      await prisma.passwordResetToken.create({
        data: { email: normalizedEmail, token, expiresAt },
      });

      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

      // TODO: replace with your email provider (e.g. SendGrid, Resend, SES)
      // For now, log the URL in development so it can be tested
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[PASSWORD RESET] URL for ${normalizedEmail}: ${resetUrl}`);
      } else {
        // await sendEmail({ to: normalizedEmail, subject: 'Redefinição de senha — DuzAPI', resetUrl });
        console.warn(`[PASSWORD RESET] Email sending not configured. Token for ${normalizedEmail}: ${token}`);
      }
    }

    // Generic response — do not reveal whether email exists
    return NextResponse.json({
      success: true,
      message: 'Se esse email estiver cadastrado, você receberá um link em breve.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 });
  }
}
