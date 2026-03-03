/**
 * Validação de inputs com Zod
 * Centraliza todas as validações do sistema
 */

import { z } from 'zod';

// ============================================
// Validações de Autenticação
// ============================================

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export const signupSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
  name: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo')
    .optional(),
});

// ============================================
// Validações de Tenant
// ============================================

export const createTenantSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Nome contém caracteres inválidos'),
  phone_number: z
    .string()
    .min(10, 'Número de telefone inválido')
    .max(20, 'Número de telefone muito longo')
    .regex(/^\+?[0-9]+$/, 'Número de telefone deve conter apenas dígitos'),
});

export const updateTenantSchema = createTenantSchema.partial().extend({
  is_active: z.boolean().optional(),
});

// ============================================
// Validações de Bot Config
// ============================================

const botConfigBaseSchema = z.object({
  tenant_id: z.string().uuid('ID do tenant inválido'),
  persona_name: z
    .string()
    .min(2, 'Nome da persona deve ter no mínimo 2 caracteres')
    .max(100, 'Nome da persona muito longo'),
  system_prompt: z
    .string()
    .min(10, 'System prompt deve ter no mínimo 10 caracteres')
    .max(10000, 'System prompt muito longo'),
  response_delay_min: z
    .number()
    .min(0, 'Delay mínimo não pode ser negativo')
    .max(300, 'Delay mínimo muito alto'),
  response_delay_max: z
    .number()
    .min(0, 'Delay máximo não pode ser negativo')
    .max(300, 'Delay máximo muito alto'),
  trigger_mode: z.enum(['all', 'keywords'], {
    errorMap: () => ({ message: 'Modo de gatilho inválido' }),
  }),
  trigger_keywords: z
    .array(z.string().max(50, 'Keyword muito longa'))
    .max(50, 'Muitas keywords')
    .optional()
    .default([]),
  openai_api_key: z
    .string()
    .min(1, 'API Key é obrigatória')
    .max(200, 'API Key muito longa'),
  is_active: z.boolean().optional().default(true),
});

export const botConfigSchema = botConfigBaseSchema.refine(
  (data) => data.response_delay_max >= data.response_delay_min,
  {
    message: 'Delay máximo deve ser maior ou igual ao delay mínimo',
    path: ['response_delay_max'],
  }
);

export const updateBotConfigSchema = botConfigBaseSchema.partial();

// ============================================
// Validações de Webhook
// ============================================

export const webhookMessageSchema = z.object({
  tenant_id: z.string().uuid('ID do tenant inválido'),
  session_id: z.string().min(1, 'Session ID é obrigatório'),
  sender_phone: z
    .string()
    .min(10, 'Número de telefone inválido')
    .regex(/^\+?[0-9]+$/, 'Número de telefone inválido'),
  message_type: z.enum(['text', 'audio'], {
    errorMap: () => ({ message: 'Tipo de mensagem inválido' }),
  }),
  content: z.string().max(10000, 'Conteúdo muito longo').optional(),
  audio_url: z.string().url('URL de áudio inválida').optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
});

// ============================================
// Validações de WhatsApp Session
// ============================================

export const sessionIdSchema = z
  .string()
  .min(1, 'Session ID é obrigatório')
  .max(100, 'Session ID muito longo')
  .regex(/^[a-zA-Z0-9\-_]+$/, 'Session ID contém caracteres inválidos');

export const mapTenantSchema = z.object({
  tenant_id: z.string().uuid('ID do tenant inválido'),
});

// ============================================
// Helpers
// ============================================

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type BotConfigInput = z.infer<typeof botConfigSchema>;
export type UpdateBotConfigInput = z.infer<typeof updateBotConfigSchema>;
export type WebhookMessageInput = z.infer<typeof webhookMessageSchema>;
export type MapTenantInput = z.infer<typeof mapTenantSchema>;

/**
 * Valida dados e retorna resultado tipado
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Formata erros do Zod para exibição
 */
export function formatZodErrors(error: z.ZodError): string {
  return error.errors.map((e) => e.message).join(', ');
}

/**
 * Sanitiza string removendo caracteres perigosos
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}
