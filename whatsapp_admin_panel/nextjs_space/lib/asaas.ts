/**
 * Integração com Asaas para pagamentos
 */

const ASAAS_API_URL = 'https://api.asaas.com/v3';

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) {
    throw new Error('ASAAS_API_KEY não configurada');
  }
  return key;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  status: string;
}

export interface CreateCustomerParams {
  name: string;
  email: string;
  cpfCnpj?: string;
}

export interface CreateSubscriptionParams {
  customer: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  value: number;
  nextDueDate: string;
  cycle: 'MONTHLY' | 'YEARLY';
  description: string;
}

/**
 * Cria um cliente no Asaas
 */
export async function createCustomer(params: CreateCustomerParams): Promise<AsaasCustomer> {
  const response = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': getApiKey(),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Asaas createCustomer error:', error);
    throw new Error(error.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
  }

  return response.json();
}

/**
 * Busca cliente por email
 */
export async function findCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
  const response = await fetch(`${ASAAS_API_URL}/customers?email=${encodeURIComponent(email)}`, {
    headers: {
      'access_token': getApiKey(),
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.data?.[0] || null;
}

/**
 * Cria uma assinatura no Asaas
 */
export async function createSubscription(params: CreateSubscriptionParams): Promise<AsaasSubscription> {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': getApiKey(),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Asaas createSubscription error:', error);
    throw new Error(error.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas');
  }

  return response.json();
}

/**
 * Gera um link de pagamento para assinatura
 */
export async function createPaymentLink(params: {
  name: string;
  description: string;
  value: number;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  chargeType: 'DETACHED' | 'RECURRENT' | 'INSTALLMENT';
  subscriptionCycle?: 'MONTHLY' | 'YEARLY';
  dueDateLimitDays?: number;
  maxInstallmentCount?: number;
}): Promise<{ id: string; url: string }> {
  const response = await fetch(`${ASAAS_API_URL}/paymentLinks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': getApiKey(),
    },
    body: JSON.stringify({
      ...params,
      endDate: null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Asaas createPaymentLink error:', error);
    throw new Error(error.errors?.[0]?.description || 'Erro ao criar link de pagamento');
  }

  return response.json();
}

/**
 * Busca assinatura por ID
 */
export async function getSubscription(subscriptionId: string): Promise<AsaasSubscription | null> {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
    headers: {
      'access_token': getApiKey(),
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Cancela uma assinatura
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: {
      'access_token': getApiKey(),
    },
  });

  return response.ok;
}

/**
 * Lista cobranças de uma assinatura
 */
export async function listSubscriptionPayments(subscriptionId: string): Promise<{ id: string; status: string; value: number; paymentDate: string | null }[]> {
  const response = await fetch(`${ASAAS_API_URL}/payments?subscription=${subscriptionId}`, {
    headers: {
      'access_token': getApiKey(),
    },
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.data || [];
}

/**
 * Estorna um pagamento (refund)
 */
export async function refundPayment(paymentId: string, value?: number): Promise<boolean> {
  const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': getApiKey(),
    },
    body: JSON.stringify(value ? { value } : {}),
  });

  return response.ok;
}

// Planos hardcoded (fallback se o banco estiver vazio)
export const PLANS_FALLBACK: Record<string, { id: string; name: string; price: number; priceInCents: number; cycle: string; description: string; features: string[]; maxTenants: number; maxMessagesPerMonth: number }> = {
  monthly: {
    id: 'monthly',
    name: 'Plano Mensal',
    price: 129.90,
    priceInCents: 12990,
    cycle: 'MONTHLY',
    description: 'Acesso completo ao WhatsApp Automation',
    features: [
      'Chatbot com IA avançada (GPT-4)',
      'Até 5 instâncias WhatsApp',
      'Até 10.000 mensagens/mês',
      'Suporte prioritário',
      'Dashboard de métricas',
    ],
    maxTenants: 5,
    maxMessagesPerMonth: 10000,
  },
  yearly: {
    id: 'yearly',
    name: 'Plano Anual',
    price: 1299.00,
    priceInCents: 129900,
    cycle: 'YEARLY',
    description: 'Acesso completo ao WhatsApp Automation - Economia de 2 meses!',
    features: [
      'Tudo do plano mensal',
      'Economia de R$ 259,80/ano',
      'Até 10.000 mensagens/mês',
      'Suporte VIP',
      'Configuração assistida',
    ],
    maxTenants: 5,
    maxMessagesPerMonth: 10000,
  },
};

// Backward-compatible alias
export const PLANS = PLANS_FALLBACK;

/** Fetch plans from database, falling back to hardcoded */
export async function getPlansFromDB() {
  try {
    const { prisma } = await import('./db');
    const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    if (plans.length === 0) return PLANS_FALLBACK;
    const map: Record<string, typeof PLANS_FALLBACK[string]> = {};
    for (const p of plans) {
      map[p.slug] = {
        id: p.slug,
        name: p.name,
        price: p.priceInCents / 100,
        priceInCents: p.priceInCents,
        cycle: p.cycle,
        description: p.description || '',
        features: p.features,
        maxTenants: p.maxTenants,
        maxMessagesPerMonth: p.maxMessagesPerMonth,
      };
    }
    return map;
  } catch {
    return PLANS_FALLBACK;
  }
}
