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
  initial_message?: string;
  enable_audio_response?: boolean;
  position?: number;
  has_openai_key?: boolean;
  ai_provider?: 'gemini' | 'openai';
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

// Funnel types
export type NodeType =
  | 'start'
  | 'send_text'
  | 'send_image'
  | 'send_audio'
  | 'send_video'
  | 'send_document'
  | 'wait'
  | 'ask'
  | 'condition'
  | 'tag'
  | 'ai_response';

export interface FunnelNode {
  id: string;
  funnel_id: string;
  type: NodeType;
  data: Record<string, unknown>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface FunnelEdge {
  id: string;
  funnel_id: string;
  source_node_id: string;
  target_node_id: string;
  condition_label?: string;
  condition_value?: string;
  sort_order: number;
}

export interface Funnel {
  id: string;
  tenant_id: string;
  name: string;
  trigger_keywords: string[];
  is_active: boolean;
  priority: number;
  node_count: number;
  created_at: string;
  updated_at: string;
}

export interface FunnelDetail extends Funnel {
  nodes: FunnelNode[];
  edges: FunnelEdge[];
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
