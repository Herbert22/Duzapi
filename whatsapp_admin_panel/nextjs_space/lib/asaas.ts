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

// Planos disponíveis
export const PLANS = {
  monthly: {
    id: 'monthly',
    name: 'Plano Mensal',
    price: 97.00,
    priceInCents: 9700,
    cycle: 'MONTHLY' as const,
    description: 'Acesso completo ao WhatsApp Automation',
    features: [
      'Chatbot com IA avançada',
      'Até 5 atendentes',
      'Mensagens ilimitadas',
      'Suporte prioritário',
      'Dashboard de métricas',
    ],
  },
  yearly: {
    id: 'yearly',
    name: 'Plano Anual',
    price: 970.00,
    priceInCents: 97000,
    cycle: 'YEARLY' as const,
    description: 'Acesso completo ao WhatsApp Automation - Economia de 2 meses!',
    features: [
      'Tudo do plano mensal',
      'Economia de R$ 194/ano',
      'Suporte VIP',
      'Configuração assistida',
      'API personalizada',
    ],
  },
};
