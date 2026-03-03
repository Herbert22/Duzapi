/**
 * Sistema de Audit Logging para ações sensíveis
 * Registra todas as operações importantes para compliance e segurança
 */

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SIGNUP'
  | 'PASSWORD_CHANGE'
  | 'TENANT_CREATE'
  | 'TENANT_UPDATE'
  | 'TENANT_DELETE'
  | 'TENANT_API_KEY_REGENERATE'
  | 'BOT_CONFIG_CREATE'
  | 'BOT_CONFIG_UPDATE'
  | 'BOT_CONFIG_DELETE'
  | 'WHATSAPP_SESSION_START'
  | 'WHATSAPP_SESSION_STOP'
  | 'PROXY_ACCESS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED_ACCESS';

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * Registra uma entrada no audit log
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    // Log no console em desenvolvimento
    const logMessage = {
      timestamp: new Date().toISOString(),
      ...entry,
      // Remove dados sensíveis do log
      details: entry.details ? sanitizeDetails(entry.details) : undefined,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', JSON.stringify(logMessage, null, 2));
    }

    // Em produção, podemos adicionar persistência no banco
    // Por enquanto, apenas logamos no console
    if (process.env.NODE_ENV !== 'development') {
      console.log('[AUDIT]', JSON.stringify(logMessage));
    }
  } catch (error) {
    console.error('[AUDIT ERROR]', error);
  }
}

/**
 * Remove dados sensíveis antes de logar
 */
function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'api_key',
    'apiKey',
    'openai_api_key',
    'token',
    'secret',
    'authorization',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Helper para extrair informações do request
 */
export function getRequestInfo(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Log de tentativa de login
 */
export async function logLoginAttempt(
  email: string,
  success: boolean,
  request: Request,
  errorMessage?: string
): Promise<void> {
  const { ipAddress, userAgent } = getRequestInfo(request);

  await logAudit({
    action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
    userEmail: email,
    ipAddress,
    userAgent,
    success,
    errorMessage,
  });
}

/**
 * Log de acesso não autorizado
 */
export async function logUnauthorizedAccess(
  request: Request,
  resource: string
): Promise<void> {
  const { ipAddress, userAgent } = getRequestInfo(request);

  await logAudit({
    action: 'UNAUTHORIZED_ACCESS',
    resourceType: 'API',
    resourceId: resource,
    ipAddress,
    userAgent,
    success: false,
    errorMessage: 'Tentativa de acesso não autorizado',
  });
}

/**
 * Log de rate limit excedido
 */
export async function logRateLimitExceeded(
  request: Request,
  identifier: string
): Promise<void> {
  const { ipAddress, userAgent } = getRequestInfo(request);

  await logAudit({
    action: 'RATE_LIMIT_EXCEEDED',
    details: { identifier },
    ipAddress,
    userAgent,
    success: false,
    errorMessage: 'Rate limit excedido',
  });
}
