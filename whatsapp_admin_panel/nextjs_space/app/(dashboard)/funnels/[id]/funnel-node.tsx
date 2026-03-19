'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Type,
  Image,
  Music,
  Video,
  FileText,
  Clock,
  HelpCircle,
  GitBranch,
  Tag,
  Bot,
  Play,
} from 'lucide-react';

const NODE_CONFIG: Record<string, { icon: typeof Type; color: string; bgColor: string }> = {
  start: { icon: Play, color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)' },
  send_text: { icon: Type, color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.15)' },
  send_image: { icon: Image, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)' },
  send_audio: { icon: Music, color: '#10b981', bgColor: 'rgba(16,185,129,0.15)' },
  send_video: { icon: Video, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)' },
  send_document: { icon: FileText, color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },
  wait: { icon: Clock, color: '#6366f1', bgColor: 'rgba(99,102,241,0.15)' },
  ask: { icon: HelpCircle, color: '#ec4899', bgColor: 'rgba(236,72,153,0.15)' },
  condition: { icon: GitBranch, color: '#f97316', bgColor: 'rgba(249,115,22,0.15)' },
  tag: { icon: Tag, color: '#14b8a6', bgColor: 'rgba(20,184,166,0.15)' },
  ai_response: { icon: Bot, color: '#a855f7', bgColor: 'rgba(168,85,247,0.15)' },
};

function getPreview(data: Record<string, unknown>): string {
  const type = data.nodeType as string;
  switch (type) {
    case 'start': {
      const triggers = data.triggers as Array<{ condition: string; term: string }> | undefined;
      if (triggers?.length && triggers[0]?.term) {
        const t = triggers[0];
        return `${t.condition === 'exact' ? 'Exata' : 'Contém'}: ${t.term.slice(0, 30)}`;
      }
      return 'Início do funil';
    }
    case 'send_text': return ((data.text as string) || '').slice(0, 40) || 'Mensagem de texto';
    case 'send_image': return (data.caption as string) || 'Imagem';
    case 'send_video': return (data.caption as string) || 'Vídeo';
    case 'send_document': return (data.filename as string) || 'Documento';
    case 'send_audio': return (data.use_tts as boolean) ? 'TTS: ' + ((data.tts_text as string) || '').slice(0, 30) : 'Áudio';
    case 'wait': return `Esperar ${data.delay_seconds || 5}s`;
    case 'ask': return ((data.question as string) || '').slice(0, 40) || 'Pergunta';
    case 'condition': return `Avaliar: ${(data.variable as string) || '?'}`;
    case 'tag': return `${(data.action as string) === 'remove' ? '- ' : '+ '}${(data.tag_name as string) || 'tag'}`;
    case 'ai_response': return 'Resposta com IA';
    default: return '';
  }
}

export const FunnelNodeComponent = memo(({ data, selected }: NodeProps) => {
  const nodeType = (data.nodeType as string) || 'send_text';
  const config = NODE_CONFIG[nodeType] || NODE_CONFIG.send_text;
  const Icon = config.icon;
  const preview = getPreview(data as Record<string, unknown>);

  return (
    <div
      className={`rounded-xl border-2 shadow-lg min-w-[180px] max-w-[220px] transition-all ${
        selected ? 'ring-2 ring-violet-400 scale-105' : ''
      }`}
      style={{
        borderColor: config.color,
        backgroundColor: '#1e293b',
      }}
    >
      {/* Input handle (not for start node) */}
      {nodeType !== 'start' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !bg-slate-900"
          style={{ borderColor: config.color }}
        />
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-[10px]"
        style={{ backgroundColor: config.bgColor }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
        <span className="text-xs font-semibold text-white truncate">
          {(data.label as string) || nodeType}
        </span>
      </div>

      {/* Preview */}
      <div className="px-3 py-2">
        <p className="text-[11px] text-slate-400 truncate">{preview}</p>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !bg-slate-900"
        style={{ borderColor: config.color }}
      />
    </div>
  );
});

FunnelNodeComponent.displayName = 'FunnelNodeComponent';
