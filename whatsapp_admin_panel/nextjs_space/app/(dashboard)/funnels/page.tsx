'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageLoading } from '@/components/ui/loading';
import {
  GitBranch,
  Plus,
  Search,
  Edit,
  Trash2,
  Play,
  Pause,
  Loader2,
  X,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Funnel, Tenant } from '@/lib/types';

export default function FunnelsPage() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<Funnel | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newTenantId, setNewTenantId] = useState('');
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');

  const fetchData = async () => {
    try {
      const [funnelsRes, tenantsRes] = await Promise.all([
        fetch('/api/proxy/funnels'),
        fetch('/api/proxy/tenants'),
      ]);
      if (funnelsRes.ok) setFunnels(await funnelsRes.json());
      if (tenantsRes.ok) setTenants(await tenantsRes.json());
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newTenantId) {
      toast.error('Preencha o nome e selecione um inquilino');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/proxy/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          tenant_id: newTenantId,
          trigger_keywords: newKeywords,
          is_active: false,
          priority: 0,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        toast.success('Funil criado com sucesso');
        setShowCreateModal(false);
        setNewName('');
        setNewTenantId('');
        setNewKeywords([]);
        // Navigate to editor
        router.push(`/funnels/${created.id}`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Erro ao criar funil');
      }
    } catch {
      toast.error('Erro ao criar funil');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/proxy/funnels/${showDeleteModal.id}`, { method: 'DELETE' });
      if (res.ok) {
        setFunnels(funnels.filter(f => f.id !== showDeleteModal.id));
        toast.success('Funil excluído');
        setShowDeleteModal(null);
      } else {
        toast.error('Erro ao excluir funil');
      }
    } catch {
      toast.error('Erro ao excluir funil');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (funnel: Funnel) => {
    if (!funnel.is_active && funnel.trigger_keywords.length === 0) {
      toast.error('Adicione palavras-chave de gatilho antes de ativar o funil');
      return;
    }
    try {
      const res = await fetch(`/api/proxy/funnels/${funnel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !funnel.is_active }),
      });
      if (res.ok) {
        setFunnels(funnels.map(f => f.id === funnel.id ? { ...f, is_active: !f.is_active } : f));
        toast.success(funnel.is_active ? 'Funil desativado' : 'Funil ativado');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Erro ao atualizar funil');
      }
    } catch {
      toast.error('Erro ao atualizar funil');
    }
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !newKeywords.includes(kw)) {
      setNewKeywords([...newKeywords, kw]);
      setKeywordInput('');
    }
  };

  const filteredFunnels = funnels.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const getTenantName = (tenantId: string) =>
    tenants.find(t => t.id === tenantId)?.name || 'Desconhecido';

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <GitBranch className="w-7 h-7 text-violet-400" />
            Funis de Mensagens
          </h1>
          <p className="text-slate-400 mt-1">
            Crie fluxos de conversa automatizados para seus produtos e serviços
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/funnels/analytics">
            <Button variant="outline" className="border-violet-500/50 text-violet-400 hover:bg-violet-500/10">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
          </Link>
          <Button onClick={() => setShowCreateModal(true)} className="bg-violet-600 hover:bg-violet-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo Funil
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
        <Input
          placeholder="Buscar funis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white"
        />
      </div>

      {/* Funnel list */}
      {filteredFunnels.length === 0 ? (
        <div className="text-center py-16">
          <GitBranch className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400">Nenhum funil encontrado</h3>
          <p className="text-slate-500 mt-1">Crie seu primeiro funil para começar</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredFunnels.map((funnel) => (
            <div
              key={funnel.id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-violet-500/50 transition-all cursor-pointer group"
              onClick={() => router.push(`/funnels/${funnel.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg group-hover:text-violet-300 transition-colors">
                    {funnel.name}
                  </h3>
                  <p className="text-slate-500 text-sm">{getTenantName(funnel.tenant_id)}</p>
                </div>
                <Badge variant={funnel.is_active ? 'success' : 'secondary'}>
                  {funnel.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {funnel.trigger_keywords.slice(0, 4).map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs">
                    {kw}
                  </Badge>
                ))}
                {funnel.trigger_keywords.length > 4 && (
                  <Badge variant="secondary" className="text-xs">
                    +{funnel.trigger_keywords.length - 4}
                  </Badge>
                )}
                {funnel.trigger_keywords.length === 0 && (
                  <span className="text-xs text-slate-600">Sem gatilhos definidos</span>
                )}
              </div>

              {/* Stats & actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                <span className="text-sm text-slate-500">
                  {funnel.node_count} {funnel.node_count === 1 ? 'bloco' : 'blocos'}
                </span>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => toggleActive(funnel)}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-green-400 transition-colors"
                    title={funnel.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {funnel.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => router.push(`/funnels/${funnel.id}`)}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-violet-400 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(funnel)}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        title="Novo Funil"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nome do Funil</label>
            <Input
              placeholder="Ex: Funil Cirurgia Reparadora"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Inquilino</label>
            <select
              value={newTenantId}
              onChange={(e) => setNewTenantId(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2"
            >
              <option value="">Selecione...</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Palavras-chave de gatilho
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: bariátrica"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <Button type="button" onClick={addKeyword} variant="outline" size="sm">
                Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {newKeywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="text-xs gap-1">
                  {kw}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-400"
                    onClick={() => setNewKeywords(newKeywords.filter(k => k !== kw))}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-violet-600 hover:bg-violet-700">
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar e Editar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!showDeleteModal}
        onOpenChange={(v) => { if (!v) setShowDeleteModal(null); }}
        title="Excluir Funil"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            Tem certeza que deseja excluir o funil <strong>{showDeleteModal?.name}</strong>?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} disabled={deleting} variant="destructive">
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
