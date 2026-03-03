// API helper functions
const BACKEND_URL = 'http://localhost:8000';
const WHATSAPP_BRIDGE_URL = 'http://localhost:3000';

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error?.detail || error?.message || `HTTP error ${response.status}`);
  }
  
  return response.json();
}

export async function fetchWhatsAppBridge<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${WHATSAPP_BRIDGE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error?.detail || error?.message || `HTTP error ${response.status}`);
  }
  
  return response.json();
}

// Tenant API functions
export const tenantsApi = {
  list: () => fetchApi<any[]>('/api/v1/tenants'),
  get: (id: string) => fetchApi<any>(`/api/v1/tenants/${id}`),
  create: (data: any) => fetchApi<any>('/api/v1/tenants', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => fetchApi<any>(`/api/v1/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/api/v1/tenants/${id}`, {
    method: 'DELETE',
  }),
  regenerateKey: (id: string) => fetchApi<any>(`/api/v1/tenants/${id}/regenerate-key`, {
    method: 'POST',
  }),
};

// Bot Config API functions
export const botConfigsApi = {
  list: (tenantId?: string) => {
    const url = tenantId ? `/api/v1/bot-configs?tenant_id=${tenantId}` : '/api/v1/bot-configs';
    return fetchApi<any[]>(url);
  },
  get: (id: string) => fetchApi<any>(`/api/v1/bot-configs/${id}`),
  create: (data: any) => fetchApi<any>('/api/v1/bot-configs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => fetchApi<any>(`/api/v1/bot-configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/api/v1/bot-configs/${id}`, {
    method: 'DELETE',
  }),
  activate: (id: string) => fetchApi<any>(`/api/v1/bot-configs/${id}/activate`, {
    method: 'POST',
  }),
};

// Messages API functions
export const messagesApi = {
  history: (params?: { tenant_id?: string; limit?: number; offset?: number; start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.tenant_id) searchParams.append('tenant_id', params.tenant_id);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    const queryString = searchParams.toString();
    return fetchApi<any[]>(`/api/v1/messages/history${queryString ? `?${queryString}` : ''}`);
  },
  conversation: (sessionId: string) => fetchApi<any[]>(`/api/v1/messages/conversation/${sessionId}`),
  stats: () => fetchApi<any>('/api/v1/messages/stats'),
};

// WhatsApp Bridge API functions
export const whatsappApi = {
  listSessions: () => fetchWhatsAppBridge<any[]>('/api/sessions'),
  startSession: (sessionId: string) => fetchWhatsAppBridge<any>(`/api/sessions/${sessionId}/start`, {
    method: 'POST',
  }),
  stopSession: (sessionId: string) => fetchWhatsAppBridge<any>(`/api/sessions/${sessionId}/stop`, {
    method: 'POST',
  }),
  getStatus: (sessionId: string) => fetchWhatsAppBridge<any>(`/api/sessions/${sessionId}/status`),
  getQrCode: (sessionId: string) => fetchWhatsAppBridge<any>(`/api/sessions/${sessionId}/qrcode`),
  mapTenant: (sessionId: string, tenantId: string) => fetchWhatsAppBridge<any>(`/api/sessions/${sessionId}/tenant`, {
    method: 'POST',
    body: JSON.stringify({ tenant_id: tenantId }),
  }),
};
