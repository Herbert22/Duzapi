'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Power,
  Key,
  Clock,
  Tag,
  Check,
  Loader2,
  MessageCircle,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import type { BotConfig, Tenant } from '@/lib/types';

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
  });

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
        body: JSON.stringify(formData),
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
      // Only send openai_api_key if user typed a new one
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

  const handleToggleActive = async (config: BotConfig) => {
    try {
      const response = await fetch(`/api/proxy/bot-configs/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !config.is_active }),
      });
      if (response.ok) {
        toast.success(config.is_active ? 'Configuração desativada' : 'Configuração ativada');
        fetchData();
      }
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

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

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Configurações de Bot</h1>
          <p className="text-slate-400 mt-1">Gerencie as personas e configurações de IA</p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Configuração
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-violet-400" />
              Configurações
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedTenantFilter}
                onChange={(e) => setSelectedTenantFilter(e.target.value)}
                className="h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Todos os Tenants</option>
                {tenants?.map((t) => (
                  <option key={t?.id} value={t?.id}>{t?.name}</option>
                ))}
              </select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Buscar configuração..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredConfigs?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma configuração encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredConfigs?.map((config) => (
                  <motion.div
                    key={config?.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 rounded-xl bg-slate-700/30 border border-slate-700/50 hover:border-violet-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-500/20">
                          <Bot className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{config?.persona_name}</h3>
                          <p className="text-xs text-slate-400">{getTenantName(config?.tenant_id)}</p>
                        </div>
                      </div>
                      <Badge variant={config?.is_active ? 'success' : 'secondary'}>
                        {config?.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                      {config?.system_prompt}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {config?.response_delay_min}-{config?.response_delay_max}s
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {config?.trigger_mode === 'all' ? 'Todas' : 'Keywords'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bot className="w-3 h-3" />
                        {(config as any)?.ai_provider === 'openai' ? 'OpenAI' : 'Gemini'}
                      </span>
                      <span className={`flex items-center gap-1 ${(config as any)?.has_openai_key ? 'text-green-400' : 'text-red-400'}`}>
                        <Key className="w-3 h-3" />
                        {(config as any)?.has_openai_key ? 'API Key OK' : 'Sem API Key'}
                      </span>
                    </div>

                    {config?.trigger_mode === 'keywords' && config?.trigger_keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {config.trigger_keywords?.slice(0, 3)?.map((kw) => (
                          <span key={kw} className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded-full">
                            {kw}
                          </span>
                        ))}
                        {config.trigger_keywords?.length > 3 && (
                          <span className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded-full">
                            +{config.trigger_keywords.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700/50">
                      <button
                        onClick={() => handleToggleActive(config)}
                        className={`p-2 rounded-lg transition-colors ${
                          config?.is_active
                            ? 'hover:bg-red-500/20 text-red-400'
                            : 'hover:bg-green-500/20 text-green-400'
                        }`}
                        title={config?.is_active ? 'Desativar' : 'Ativar'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedConfig(config);
                          setFormData({
                            tenant_id: config?.tenant_id ?? '',
                            persona_name: config?.persona_name ?? '',
                            system_prompt: config?.system_prompt ?? '',
                            response_delay_min: config?.response_delay_min ?? 1,
                            response_delay_max: config?.response_delay_max ?? 3,
                            trigger_mode: config?.trigger_mode ?? 'all',
                            trigger_keywords: config?.trigger_keywords ?? [],
                            ai_provider: (config as any)?.ai_provider ?? 'gemini',
                            openai_api_key: '',
                          });
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-slate-600 text-slate-400 transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedConfig(config);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

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
              <label className="text-sm font-medium text-slate-300">Tenant *</label>
              <select
                value={formData.tenant_id}
                onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                className="w-full h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Selecione um tenant</option>
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
                API Key {isEditModalOpen && (selectedConfig as any)?.has_openai_key ? '' : '*'}
              </label>
              <Input
                type="password"
                placeholder={
                  isEditModalOpen && (selectedConfig as any)?.has_openai_key
                    ? '••••••••  (deixe vazio para manter a chave atual)'
                    : formData.ai_provider === 'gemini' ? 'AIza...' : 'sk-...'
                }
                value={formData.openai_api_key}
                onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
              />
              <p className="text-xs text-slate-500">
                {isEditModalOpen && (selectedConfig as any)?.has_openai_key
                  ? 'Chave já configurada — preencha apenas para substituir'
                  : 'Obrigatória — chave do provedor selecionado'}
              </p>
            </div>
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
