import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware para adicionar headers de segurança em todas as respostas
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const isProduction = process.env.NODE_ENV === 'production';

  // === HEADERS DE SEGURANÇA ===

  // Previne MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Habilita proteção XSS do navegador
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Controla informações de referrer
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (antigo Feature-Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()'
  );

  // Content Security Policy - Mais restritivo em produção
  const cspDirectives = isProduction
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://apps.abacus.ai",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.abacusai.app wss://*.abacusai.app https://apps.abacus.ai",
        "frame-ancestors 'self' https://*.abacusai.app https://apps.abacus.ai",
        "form-action 'self'",
        "base-uri 'self'",
        "upgrade-insecure-requests",
      ].join('; ')
    : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apps.abacus.ai",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https: http:",
        "connect-src 'self' http://localhost:* https://*.abacusai.app wss://*.abacusai.app https://apps.abacus.ai",
        "frame-ancestors 'self' https://*.abacusai.app https://apps.abacus.ai",
        "form-action 'self'",
        "base-uri 'self'",
      ].join('; ');

  response.headers.set('Content-Security-Policy', cspDirectives);

  // HSTS - Força HTTPS em produção (1 ano)
  if (isProduction) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // X-Download-Options para IE
  response.headers.set('X-Download-Options', 'noopen');

  // X-Permitted-Cross-Domain-Policies
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  // Cache control para páginas sensíveis
  const sensitiveRoutes = ['/api/', '/dashboard', '/tenants', '/bot-configs', '/whatsapp', '/messages'];
  const isSensitive = sensitiveRoutes.some((route) => request.nextUrl.pathname.startsWith(route));
  
  if (isSensitive) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
  }

  return response;
}

// Configura em quais rotas o middleware deve executar
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
