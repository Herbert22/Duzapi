'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageLoading } from '@/components/ui/loading';
import {
  Bot,
  Plus,
  Search,
  Edit,
  Trash2,
  Key,
  Clock,
  Check,
  Loader2,
  MessageCircle,
  X,
  GripVertical,
  Volume2,
  MessageSquareText,
  Power,
  PowerOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { BotConfig, Tenant } from '@/lib/types';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Column IDs ──────────────────────────────────────────────────────
const COLUMN_INACTIVE = 'inactive';
const COLUMN_ACTIVE = 'active';

// ─── Sortable Bot Card ──────────────────────────────────────────────
function SortableBotCard({
  config,
  getTenantName,
  onEdit,
  onDelete,
}: {
  config: BotConfig;
  getTenantName: (id: string) => string;
  onEdit: (config: BotConfig) => void;
  onDelete: (config: BotConfig) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-violet-500/40 transition-all ${
        isDragging ? 'shadow-2xl shadow-violet-500/20 ring-2 ring-violet-500/30' : ''
      }`}
    >
      {/* Drag handle bar */}
      <div
        className="flex items-center justify-center py-1.5 cursor-grab active:cursor-grabbing rounded-t-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-slate-500" />
      </div>

      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-1.5 rounded-lg bg-violet-500/20 shrink-0">
            <Bot className="w-4 h-4 text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white text-sm truncate">{config.persona_name}</h3>
            <p className="text-[11px] text-slate-500 truncate">{getTenantName(config.tenant_id)}</p>
          </div>
        </div>

        {/* Prompt preview */}
        <p className="text-xs text-slate-400 line-clamp-2 mb-2.5 leading-relaxed">
          {config.system_prompt}
        </p>

        {/* Info badges */}
        <div className="flex items-center flex-wrap gap-1.5 mb-2.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700/60 text-[10px] text-slate-400">
            <Clock className="w-2.5 h-2.5" />
            {config.response_delay_min}-{config.response_delay_max}s
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700/60 text-[10px] text-slate-400">
            <MessageCircle className="w-2.5 h-2.5" />
            {config.trigger_mode === 'all' ? 'Todas' : 'Keywords'}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700/60 text-[10px] text-slate-400">
            <Bot className="w-2.5 h-2.5" />
            {config.ai_provider === 'openai' ? 'OpenAI' : 'Gemini'}
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
            config.has_openai_key
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            <Key className="w-2.5 h-2.5" />
            {config.has_openai_key ? 'OK' : 'Sem chave'}
          </span>
          {config.enable_audio_response && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-[10px] text-blue-400">
              <Volume2 className="w-2.5 h-2.5" />
              Áudio
            </span>
          )}
          {config.initial_message && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] text-amber-400">
              <MessageSquareText className="w-2.5 h-2.5" />
              Saudação
            </span>
          )}
        </div>

        {/* Keywords */}
        {config.trigger_mode === 'keywords' && config.trigger_keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {config.trigger_keywords.slice(0, 3).map((kw) => (
              <span key={kw} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-[10px] rounded-full">
                {kw}
              </span>
            ))}
            {config.trigger_keywords.length > 3 && (
              <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 text-[10px] rounded-full">
                +{config.trigger_keywords.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-700/40">
          <button
            onClick={() => onEdit(config)}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Editar"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(config)}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            title="Deletar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drag Overlay (ghost while dragging) ─────────────────────────────
function DragOverlayCard({ config, getTenantName }: { config: BotConfig; getTenantName: (id: string) => string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-800 border-2 border-violet-500 shadow-2xl shadow-violet-500/30 backdrop-blur-sm w-[280px]">
      <div className="flex items-center gap-2.5">
        <GripVertical className="w-4 h-4 text-violet-400" />
        <div className="p-1.5 rounded-lg bg-violet-500/20">
          <Bot className="w-4 h-4 text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white text-sm truncate">{config.persona_name}</h3>
          <p className="text-[11px] text-slate-400 truncate">{getTenantName(config.tenant_id)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Droppable Column ────────────────────────────────────────────────
function KanbanColumn({
  id,
  title,
  icon,
  count,
  accentColor,
  borderColor,
  bgColor,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  count: number;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border-2 transition-all duration-200 min-h-[400px] ${
        isOver ? `${borderColor} bg-opacity-20 scale-[1.01]` : 'border-slate-700/50'
      } ${bgColor}`}
    >
      {/* Column header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-slate-700/50 rounded-t-2xl`}>
        {icon}
        <h2 className={`font-semibold text-sm ${accentColor}`}>{title}</h2>
        <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${accentColor} bg-slate-700/50`}>
          {count}
        </span>
      </div>

      {/* Cards area */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {children}
        {count === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <Bot className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">Arraste cards para cá</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function BotConfigsPage() {
  const [configs, setConfigs] = useState<BotConfig[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<BotConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    tenant_id: '',
    persona_name: '',
    system_prompt: '',
    response_delay_min: 1,
    response_delay_max: 3,
    trigger_mode: 'all' as 'all' | 'keywords',
    trigger_keywords: [] as string[],
    ai_provider: 'gemini' as 'gemini' | 'openai',
    openai_api_key: '',
    initial_message: '',
    enable_audio_response: false,
    is_active: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [configsRes, tenantsRes] = await Promise.all([
        fetch('/api/proxy/bot-configs'),
        fetch('/api/proxy/tenants'),
      ]);

      if (configsRes.ok) {
        const configsData = await configsRes.json();
        setConfigs(configsData ?? []);
      }
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        setTenants(tenantsData ?? []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      tenant_id: '',
      persona_name: '',
      system_prompt: '',
      response_delay_min: 1,
      response_delay_max: 3,
      trigger_mode: 'all',
      trigger_keywords: [],
      ai_provider: 'gemini',
      openai_api_key: '',
      initial_message: '',
      enable_audio_response: false,
      is_active: true,
    });
    setKeywordInput('');
  };

  const handleCreate = async () => {
    if (!formData.tenant_id || !formData.persona_name || !formData.system_prompt) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (!formData.openai_api_key) {
      toast.error('A chave da API de IA é obrigatória');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/proxy/bot-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          position: configs.length,
        }),
      });
      if (response.ok) {
        toast.success('Configuração criada com sucesso!');
        setIsCreateModalOpen(false);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error?.detail ?? 'Erro ao criar configuração');
      }
    } catch (error) {
      toast.error('Erro ao criar configuração');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedConfig) return;
    setSubmitting(true);
    try {
      const { openai_api_key, ...rest } = formData;
      const payload = openai_api_key ? formData : rest;
      const response = await fetch(`/api/proxy/bot-configs/${selectedConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        toast.success('Configuração atualizada com sucesso!');
        setIsEditModalOpen(false);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error?.detail ?? 'Erro ao atualizar configuração');
      }
    } catch (error) {
      toast.error('Erro ao atualizar configuração');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConfig) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/proxy/bot-configs/${selectedConfig.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('Configuração deletada com sucesso!');
        setIsDeleteModalOpen(false);
        fetchData();
      } else {
        toast.error('Erro ao deletar configuração');
      }
    } catch (error) {
      toast.error('Erro ao deletar configuração');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActiveOnBackend = async (configId: string, newIsActive: boolean) => {
    try {
      await fetch(`/api/proxy/bot-configs/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newIsActive }),
      });
      toast.success(newIsActive ? 'Bot ativado!' : 'Bot desativado!');
    } catch (error) {
      toast.error('Erro ao alterar status');
      fetchData(); // revert on error
    }
  };

  const persistOrder = async (items: BotConfig[]) => {
    try {
      const payload = items.map((c, i) => ({ id: c.id, position: i }));
      await fetch('/api/proxy/bot-configs/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Reorder failed:', error);
    }
  };

  // ─── Drag handlers ──────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const findColumnForCard = (cardId: string): string | null => {
    const config = configs.find((c) => c.id === cardId);
    if (!config) return null;
    return config.is_active ? COLUMN_ACTIVE : COLUMN_INACTIVE;
  };

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    // Determine source and destination columns
    const sourceColumn = findColumnForCard(activeCardId);

    let destColumn: string | null = null;
    if (overId === COLUMN_ACTIVE || overId === COLUMN_INACTIVE) {
      destColumn = overId;
    } else {
      destColumn = findColumnForCard(overId);
    }

    if (!sourceColumn || !destColumn || sourceColumn === destColumn) return;

    // Move card between columns (optimistic update)
    setConfigs((prev) =>
      prev.map((c) =>
        c.id === activeCardId
          ? { ...c, is_active: destColumn === COLUMN_ACTIVE }
          : c
      )
    );
  }, [configs]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;
    const draggedConfig = configs.find((c) => c.id === activeCardId);
    if (!draggedConfig) return;

    const currentColumn = draggedConfig.is_active ? COLUMN_ACTIVE : COLUMN_INACTIVE;

    // Determine if dropped on a column or a card
    let targetColumn = currentColumn;
    if (overId === COLUMN_ACTIVE || overId === COLUMN_INACTIVE) {
      targetColumn = overId;
    } else {
      const overConfig = configs.find((c) => c.id === overId);
      if (overConfig) {
        targetColumn = overConfig.is_active ? COLUMN_ACTIVE : COLUMN_INACTIVE;
      }
    }

    // Check if status changed
    const newIsActive = targetColumn === COLUMN_ACTIVE;
    const statusChanged = draggedConfig.is_active !== newIsActive;

    // Reorder within column
    const columnConfigs = configs.filter((c) =>
      targetColumn === COLUMN_ACTIVE ? c.is_active : !c.is_active
    );

    if (overId !== COLUMN_ACTIVE && overId !== COLUMN_INACTIVE) {
      const oldIndex = columnConfigs.findIndex((c) => c.id === activeCardId);
      const newIndex = columnConfigs.findIndex((c) => c.id === overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(columnConfigs, oldIndex, newIndex);
        const otherColumn = configs.filter((c) =>
          targetColumn === COLUMN_ACTIVE ? !c.is_active : c.is_active
        );
        setConfigs([...otherColumn, ...reordered]);
        persistOrder([...otherColumn, ...reordered]);
      }
    }

    // Persist status change
    if (statusChanged) {
      // Already updated optimistically in handleDragOver
      toggleActiveOnBackend(activeCardId, newIsActive);
    }
  }, [configs]);

  // ─── Helpers ──────────────────────────────────────────────────
  const addKeyword = () => {
    if (keywordInput?.trim() && !formData.trigger_keywords?.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        trigger_keywords: [...(formData.trigger_keywords ?? []), keywordInput.trim()],
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      trigger_keywords: formData.trigger_keywords?.filter((k) => k !== keyword) ?? [],
    });
  };

  const getTenantName = (tenantId: string) => {
    return tenants?.find((t) => t?.id === tenantId)?.name ?? 'Desconhecido';
  };

  const filteredConfigs = configs?.filter((c) => {
    const matchesSearch =
      c?.persona_name?.toLowerCase()?.includes(search?.toLowerCase() ?? '') ||
      getTenantName(c?.tenant_id)?.toLowerCase()?.includes(search?.toLowerCase() ?? '');
    const matchesTenant = !selectedTenantFilter || c?.tenant_id === selectedTenantFilter;
    return matchesSearch && matchesTenant;
  }) ?? [];

  const inactiveConfigs = filteredConfigs.filter((c) => !c.is_active);
  const activeConfigs = filteredConfigs.filter((c) => c.is_active);
  const activeConfig = activeId ? configs.find((c) => c.id === activeId) : null;

  if (loading) {
    return <PageLoading />;
  }

  const openEditModal = (config: BotConfig) => {
    setSelectedConfig(config);
    setFormData({
      tenant_id: config.tenant_id ?? '',
      persona_name: config.persona_name ?? '',
      system_prompt: config.system_prompt ?? '',
      response_delay_min: config.response_delay_min ?? 1,
      response_delay_max: config.response_delay_max ?? 3,
      trigger_mode: config.trigger_mode ?? 'all',
      trigger_keywords: config.trigger_keywords ?? [],
      ai_provider: config.ai_provider ?? 'gemini',
      openai_api_key: '',
      initial_message: config.initial_message ?? '',
      enable_audio_response: config.enable_audio_response ?? false,
      is_active: config.is_active ?? true,
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Configurações de Bot</h1>
          <p className="text-slate-400 mt-1">Arraste os cards entre as colunas para ativar ou desativar</p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Configuração
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedTenantFilter}
          onChange={(e) => setSelectedTenantFilter(e.target.value)}
          className="h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Todos os Inquilinos</option>
          {tenants?.map((t) => (
            <option key={t?.id} value={t?.id}>{t?.name}</option>
          ))}
        </select>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Buscar configuração..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Inactive Column */}
          <KanbanColumn
            id={COLUMN_INACTIVE}
            title="Inativos"
            icon={<PowerOff className="w-4 h-4 text-slate-400" />}
            count={inactiveConfigs.length}
            accentColor="text-slate-400"
            borderColor="border-slate-500"
            bgColor="bg-slate-900/40"
          >
            <SortableContext
              items={inactiveConfigs.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {inactiveConfigs.map((config) => (
                <SortableBotCard
                  key={config.id}
                  config={config}
                  getTenantName={getTenantName}
                  onEdit={openEditModal}
                  onDelete={(c) => { setSelectedConfig(c); setIsDeleteModalOpen(true); }}
                />
              ))}
            </SortableContext>
          </KanbanColumn>

          {/* Active Column */}
          <KanbanColumn
            id={COLUMN_ACTIVE}
            title="Ativos"
            icon={<Power className="w-4 h-4 text-green-400" />}
            count={activeConfigs.length}
            accentColor="text-green-400"
            borderColor="border-green-500"
            bgColor="bg-green-950/20"
          >
            <SortableContext
              items={activeConfigs.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {activeConfigs.map((config) => (
                <SortableBotCard
                  key={config.id}
                  config={config}
                  getTenantName={getTenantName}
                  onEdit={openEditModal}
                  onDelete={(c) => { setSelectedConfig(c); setIsDeleteModalOpen(true); }}
                />
              ))}
            </SortableContext>
          </KanbanColumn>
        </div>

        <DragOverlay>
          {activeConfig && (
            <DragOverlayCard config={activeConfig} getTenantName={getTenantName} />
          )}
        </DragOverlay>
      </DndContext>

      {/* Create/Edit Modal */}
      <Modal
        open={isCreateModalOpen || isEditModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
          }
        }}
        title={isEditModalOpen ? 'Editar Configuração' : 'Nova Configuração'}
        description={isEditModalOpen ? 'Atualize a configuração do bot' : 'Configure uma nova persona de IA'}
        className="max-w-2xl"
      >
        <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Inquilino *</label>
              <select
                value={formData.tenant_id}
                onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                className="w-full h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Selecione um inquilino</option>
                {tenants?.map((t) => (
                  <option key={t?.id} value={t?.id}>{t?.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Nome da Persona *</label>
              <Input
                placeholder="Ex: Assistente de Vendas"
                value={formData.persona_name}
                onChange={(e) => setFormData({ ...formData, persona_name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">System Prompt *</label>
            <Textarea
              placeholder="Descreva como o bot deve se comportar..."
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              className="min-h-[120px]"
            />
          </div>

          {/* Initial Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Mensagem Inicial</label>
            <Textarea
              placeholder="Mensagem enviada automaticamente no primeiro contato do usuário (opcional)"
              value={formData.initial_message}
              onChange={(e) => setFormData({ ...formData, initial_message: e.target.value })}
              className="min-h-[80px]"
            />
            <p className="text-xs text-slate-500">
              Será enviada automaticamente quando um novo contato enviar a primeira mensagem
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Delay Mínimo (s)</label>
              <Input
                type="number"
                min="0"
                value={formData.response_delay_min}
                onChange={(e) => setFormData({ ...formData, response_delay_min: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Delay Máximo (s)</label>
              <Input
                type="number"
                min="0"
                value={formData.response_delay_max}
                onChange={(e) => setFormData({ ...formData, response_delay_max: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Modo de Resposta</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.trigger_mode === 'all'}
                  onChange={() => setFormData({ ...formData, trigger_mode: 'all' })}
                  className="w-4 h-4 text-violet-600"
                />
                <span className="text-sm text-slate-300">Responder a todas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.trigger_mode === 'keywords'}
                  onChange={() => setFormData({ ...formData, trigger_mode: 'keywords' })}
                  className="w-4 h-4 text-violet-600"
                />
                <span className="text-sm text-slate-300">Apenas palavras-chave</span>
              </label>
            </div>
          </div>

          {formData.trigger_mode === 'keywords' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Palavras-chave</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma palavra-chave"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                />
                <Button type="button" onClick={addKeyword} variant="secondary">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.trigger_keywords?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.trigger_keywords?.map((kw) => (
                    <span
                      key={kw}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-600 text-slate-200 text-sm rounded-full"
                    >
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Provedor de IA</label>
              <select
                value={formData.ai_provider}
                onChange={(e) => setFormData({ ...formData, ai_provider: e.target.value as 'gemini' | 'openai' })}
                className="w-full h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="gemini">Google Gemini (recomendado)</option>
                <option value="openai">OpenAI GPT</option>
              </select>
              <p className="text-xs text-slate-500">Gemini é ~30x mais barato que OpenAI</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                API Key {isEditModalOpen && selectedConfig?.has_openai_key ? '' : '*'}
              </label>
              <Input
                type="password"
                placeholder={
                  isEditModalOpen && selectedConfig?.has_openai_key
                    ? '••••••••  (deixe vazio para manter a chave atual)'
                    : formData.ai_provider === 'gemini' ? 'AIza...' : 'sk-...'
                }
                value={formData.openai_api_key}
                onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
              />
              <p className="text-xs text-slate-500">
                {isEditModalOpen && selectedConfig?.has_openai_key
                  ? 'Chave já configurada — preencha apenas para substituir'
                  : 'Obrigatória — chave do provedor selecionado'}
              </p>
            </div>
          </div>

          {/* Audio response toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-700/30 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-white">Resposta por Áudio</p>
                <p className="text-xs text-slate-400">O assistente responderá com mensagens de voz</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, enable_audio_response: !formData.enable_audio_response })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.enable_audio_response ? 'bg-violet-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.enable_audio_response ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Active/Inactive toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-700/30 border border-slate-700/50">
            <div className="flex items-center gap-3">
              {formData.is_active ? (
                <Power className="w-5 h-5 text-green-400" />
              ) : (
                <PowerOff className="w-5 h-5 text-red-400" />
              )}
              <div>
                <p className="text-sm font-medium text-white">Bot Ativo</p>
                <p className="text-xs text-slate-400">
                  {formData.is_active ? 'O bot está respondendo mensagens' : 'O bot está desativado'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_active ? 'bg-green-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={isEditModalOpen ? handleEdit : handleCreate} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {isEditModalOpen ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Confirmar Exclusão"
        description="Esta ação não pode ser desfeita"
      >
        <div className="mt-4">
          <p className="text-slate-300">
            Tem certeza que deseja deletar a configuração{' '}
            <strong className="text-white">{selectedConfig?.persona_name}</strong>?
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Deletar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
