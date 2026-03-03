// Tenant types
export interface Tenant {
  id: string;
  name: string;
  phone_number: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantInput {
  name: string;
  phone_number: string;
}

export interface UpdateTenantInput {
  name?: string;
  phone_number?: string;
  is_active?: boolean;
}

// Bot Config types
export interface BotConfig {
  id: string;
  tenant_id: string;
  persona_name: string;
  system_prompt: string;
  response_delay_min: number;
  response_delay_max: number;
  trigger_mode: 'all' | 'keywords';
  trigger_keywords: string[];
  openai_api_key: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateBotConfigInput {
  tenant_id: string;
  persona_name: string;
  system_prompt: string;
  response_delay_min: number;
  response_delay_max: number;
  trigger_mode: 'all' | 'keywords';
  trigger_keywords?: string[];
  openai_api_key: string;
}

export interface UpdateBotConfigInput {
  persona_name?: string;
  system_prompt?: string;
  response_delay_min?: number;
  response_delay_max?: number;
  trigger_mode?: 'all' | 'keywords';
  trigger_keywords?: string[];
  openai_api_key?: string;
  is_active?: boolean;
}

// Message types
export interface MessageLog {
  id: string;
  tenant_id: string;
  session_id: string;
  sender_phone: string;
  message_type: string;
  content: string;
  transcription?: string;
  ai_response?: string;
  processed_at: string;
  response_sent_at?: string;
}

export interface MessageStats {
  total_messages: number;
  messages_today: number;
  messages_last_24h: number;
  audio_messages: number;
  text_messages: number;
}

// WhatsApp Session types
export interface WhatsAppSession {
  sessionId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'qr';
  tenantId?: string;
  tenantName?: string;
}

export interface SessionStatus {
  session_id: string;
  status: string;
  connected: boolean;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
