'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
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
  X,
  Plus,
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

/* ── Condition Node (inline editing with dynamic handles) ── */

interface ConditionItem {
  operator: string;
  value: string;
}

function ConditionNodeBody({ id, data }: { id: string; data: Record<string, unknown> }) {
  const { setNodes, setEdges } = useReactFlow();
  const conditions = (data.conditions as ConditionItem[]) || [];
  const variable = (data.variable as string) || '';

  // Local state for fast input response
  const [localConditions, setLocalConditions] = useState<ConditionItem[]>(conditions);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when external data changes (e.g., from side panel variable select)
  useEffect(() => {
    setLocalConditions((data.conditions as ConditionItem[]) || []);
  }, [data.conditions]);

  const commitConditions = useCallback(
    (next: ConditionItem[]) => {
      setLocalConditions(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, conditions: next } } : n,
          ),
        );
      }, 300);
    },
    [id, setNodes],
  );

  const toggleOperator = useCallback(
    (idx: number) => {
      const next = localConditions.map((c, i) =>
        i === idx
          ? { ...c, operator: c.operator === 'equals' ? 'contains' : 'equals' }
          : c,
      );
      commitConditions(next);
    },
    [localConditions, commitConditions],
  );

  const updateValue = useCallback(
    (idx: number, value: string) => {
      const next = localConditions.map((c, i) => (i === idx ? { ...c, value } : c));
      commitConditions(next);
    },
    [localConditions, commitConditions],
  );

  const addCondition = useCallback(() => {
    commitConditions([...localConditions, { operator: 'equals', value: '' }]);
  }, [localConditions, commitConditions]);

  const removeCondition = useCallback(
    (idx: number) => {
      const next = localConditions.filter((_, i) => i !== idx);
      commitConditions(next);

      // Clean up edges: remove edge from deleted handle, re-index remaining
      setEdges((eds) =>
        eds
          .filter((e) => !(e.source === id && e.sourceHandle === `condition-${idx}`))
          .map((e) => {
            if (e.source !== id || !e.sourceHandle?.startsWith('condition-')) return e;
            if (e.sourceHandle === 'condition-default') return e;
            const handleIdx = parseInt(e.sourceHandle.replace('condition-', ''), 10);
            if (handleIdx > idx) {
              return { ...e, sourceHandle: `condition-${handleIdx - 1}` };
            }
            return e;
          }),
      );
    },
    [id, localConditions, commitConditions, setEdges],
  );

  return (
    <div className="px-2 py-2 space-y-2">
      {/* Variable display */}
      <div className="text-[10px] text-slate-400 truncate px-1">
        Variável: <span className="text-amber-400 font-semibold">{variable || '—'}</span>
      </div>

      {/* Condition rows */}
      {localConditions.map((cond, i) => (
        <div key={i} className="relative flex items-center gap-1 pr-5">
          <button
            onClick={(e) => { e.stopPropagation(); toggleOperator(i); }}
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 transition-colors ${
              cond.operator === 'equals'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-amber-300'
            }`}
            title={cond.operator === 'equals' ? 'Correspondência exata' : 'Contém o texto'}
          >
            {cond.operator === 'equals' ? 'EXATA' : 'CONTÉM'}
          </button>
          <input
            value={cond.value}
            onChange={(e) => { e.stopPropagation(); updateValue(i, e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="termo"
            className="flex-1 min-w-0 text-[11px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={(e) => { e.stopPropagation(); removeCondition(i); }}
            className="text-slate-500 hover:text-red-400 shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
          <Handle
            type="source"
            position={Position.Right}
            id={`condition-${i}`}
            className="!w-2.5 !h-2.5 !border-2 !bg-slate-900 !absolute !right-[-9px]"
            style={{ borderColor: '#f97316', top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>
      ))}

      {/* Add path button */}
      <button
        onClick={(e) => { e.stopPropagation(); addCondition(); }}
        className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 px-1 transition-colors"
      >
        <Plus className="w-3 h-3" /> Adicionar caminho
      </button>

      {/* Default / fallback path */}
      <div className="relative flex items-center pr-5 pt-1 border-t border-slate-700">
        <span className="text-[10px] text-slate-500 italic px-1">Nenhuma (padrão)</span>
        <Handle
          type="source"
          position={Position.Right}
          id="condition-default"
          className="!w-2.5 !h-2.5 !border-2 !bg-slate-900 !absolute !right-[-9px]"
          style={{ borderColor: '#64748b', top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>
    </div>
  );
}

/* ── Main Node Component ── */

export const FunnelNodeComponent = memo(({ id, data, selected }: NodeProps) => {
  const nodeType = (data.nodeType as string) || 'send_text';
  const config = NODE_CONFIG[nodeType] || NODE_CONFIG.send_text;
  const Icon = config.icon;
  const isCondition = nodeType === 'condition';

  return (
    <div
      className={`rounded-xl border-2 shadow-lg transition-all ${
        isCondition ? 'min-w-[240px] max-w-[300px]' : 'min-w-[180px] max-w-[220px]'
      } ${selected ? 'ring-2 ring-violet-400 scale-105' : ''}`}
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

      {isCondition ? (
        /* Condition: inline editor with dynamic handles */
        <ConditionNodeBody id={id} data={data as Record<string, unknown>} />
      ) : (
        /* Other nodes: simple preview + bottom handle */
        <>
          <div className="px-3 py-2">
            <p className="text-[11px] text-slate-400 truncate">
              {getPreview(data as Record<string, unknown>)}
            </p>
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            className="!w-3 !h-3 !border-2 !bg-slate-900"
            style={{ borderColor: config.color }}
          />
        </>
      )}
    </div>
  );
});

FunnelNodeComponent.displayName = 'FunnelNodeComponent';
