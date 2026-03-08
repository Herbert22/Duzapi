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

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7c3aed; margin: 0;">DuzAPI</h1>
            <p style="color: #666; margin-top: 5px;">WhatsApp Automation</p>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 12px; text-align: center;">
            <h2 style="color: #333; margin-bottom: 10px;">Redefinição de senha</h2>
            <p style="color: #666; margin-bottom: 20px;">Clique no botão abaixo para redefinir sua senha:</p>
            <a href="${resetUrl}" style="background: #7c3aed; color: white; font-size: 16px; font-weight: bold; padding: 14px 32px; border-radius: 8px; text-decoration: none; display: inline-block;">
              Redefinir Senha
            </a>
            <p style="color: #999; font-size: 14px; margin-top: 20px;">
              Este link expira em 1 hora.
            </p>
            <p style="color: #ccc; font-size: 12px; margin-top: 10px; word-break: break-all;">
              ${resetUrl}
            </p>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
            Se você não solicitou esta redefinição, ignore este email.
          </p>
        </div>
      `;

      // Send email via Abacus AI (same provider as verification codes)
      try {
        const appUrl = process.env.NEXTAUTH_URL || '';
        const emailResponse = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployment_token: process.env.ABACUSAI_API_KEY,
            app_id: process.env.WEB_APP_ID,
            notification_id: process.env.NOTIF_ID_PASSWORD_RESET || process.env.NOTIF_ID_EMAIL_VERIFICATION_CODE,
            subject: 'Redefinição de senha — DuzAPI',
            body: htmlBody,
            is_html: true,
            recipient_email: normalizedEmail,
            sender_email: appUrl ? `noreply@${new URL(appUrl).hostname}` : 'noreply@duzapi.com.br',
            sender_alias: 'DuzAPI',
          }),
        });

        const emailResult = await emailResponse.json();
        if (!emailResult.success && !emailResult.notification_disabled) {
          console.error('Password reset email error:', emailResult);
        }
      } catch (emailError) {
        console.error('Password reset email send error:', emailError);
        // Don't fail the request — still return success to avoid leaking info
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
