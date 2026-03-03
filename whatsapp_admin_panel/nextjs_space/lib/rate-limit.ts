/**
 * Rate Limiting utility para proteger rotas de autenticação
 * Implementa sliding window rate limiting em memória
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Limpa entradas expiradas periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Limpa a cada minuto

export interface RateLimitConfig {
  maxAttempts: number;      // Número máximo de tentativas
  windowMs: number;         // Janela de tempo em millisegundos
  blockDurationMs?: number; // Duração do bloqueio após exceder limite
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Verifica e aplica rate limiting
 * @param identifier - Identificador único (IP, email, etc)
 * @param config - Configuração do rate limit
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // Se não existe entrada ou expirou, cria nova
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      success: true,
      remaining: config.maxAttempts - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Se excedeu o limite
  if (entry.count >= config.maxAttempts) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  // Incrementa contador
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    success: true,
    remaining: config.maxAttempts - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Reset do rate limit para um identificador
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Configurações pré-definidas
 */
export const RATE_LIMIT_CONFIGS = {
  // Login: 5 tentativas por 15 minutos
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutos
    blockDurationMs: 30 * 60 * 1000, // 30 minutos de bloqueio
  },
  // Signup: 3 contas por hora por IP
  signup: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hora
  },
  // API geral: 100 requests por minuto
  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minuto
  },
  // Regenerar API Key: 3 vezes por hora
  regenerateKey: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hora
  },
} as const;

/**
 * Helper para extrair IP do request
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}
