'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageLoading } from '@/components/ui/loading';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  RefreshCw,
  Power,
  Phone,
  Check,
  Loader2,
  Key,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import type { Tenant } from '@/lib/types';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({ name: '', phone_number: '' });
  const [submitting, setSubmitting] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiKeyTenantName, setNewApiKeyTenantName] = useState('');

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/proxy/tenants');
      if (response.ok) {
        const data = await response.json();
        setTenants(data ?? []);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Erro ao carregar tenants');
    } finally {
      setLoading(false);
    }
  };

  const showApiKey = (apiKey: string, tenantName: string) => {
    setNewApiKey(apiKey);
    setNewApiKeyTenantName(tenantName);
    setCopiedApiKey(false);
    setIsApiKeyModalOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.phone_number) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/proxy/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        const data = await response.json();
        setIsCreateModalOpen(false);
        setFormData({ name: '', phone_number: '' });
        fetchTenants();
        if (data?.api_key) {
          showApiKey(data.api_key, data.name || formData.name);
        } else {
          toast.success('Tenant criado com sucesso!');
        }
      } else {
        const error = await response.json();
        toast.error(error?.detail ?? 'Erro ao criar tenant');
      }
    } catch (error) {
      toast.error('Erro ao criar tenant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedTenant) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/proxy/tenants/${selectedTenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        toast.success('Tenant atualizado com sucesso!');
        setIsEditModalOpen(false);
        fetchTenants();
      } else {
        const error = await response.json();
        toast.error(error?.detail ?? 'Erro ao atualizar tenant');
      }
    } catch (error) {
      toast.error('Erro ao atualizar tenant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTenant) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/proxy/tenants/${selectedTenant.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('Tenant deletado com sucesso!');
        setIsDeleteModalOpen(false);
        fetchTenants();
      } else {
        toast.error('Erro ao deletar tenant');
      }
    } catch (error) {
      toast.error('Erro ao deletar tenant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (tenant: Tenant) => {
    try {
      const response = await fetch(`/api/proxy/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !tenant.is_active }),
      });
      if (response.ok) {
        toast.success(tenant.is_active ? 'Tenant desativado' : 'Tenant ativado');
        fetchTenants();
      }
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleRegenerateKey = async (tenant: Tenant) => {
    try {
      const response = await fetch(`/api/proxy/tenants/${tenant.id}/regenerate-api-key`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        fetchTenants();
        if (data?.api_key) {
          showApiKey(data.api_key, tenant.name);
        } else {
          toast.success('API Key regenerada com sucesso!');
        }
      } else {
        toast.error('Erro ao regenerar API Key');
      }
    } catch (error) {
      toast.error('Erro ao regenerar API Key');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedApiKey(true);
      toast.success('API Key copiada!');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const filteredTenants = tenants?.filter(
    (t) =>
      t?.name?.toLowerCase()?.includes(search?.toLowerCase() ?? '') ||
      t?.phone_number?.includes(search ?? '')
  ) ?? [];

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Tenants</h1>
          <p className="text-slate-400 mt-1">Gerencie os tenants do sistema</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Tenant
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-400" />
              Lista de Tenants
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Buscar tenant..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTenants?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum tenant encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Nome</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Telefone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">API Key</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredTenants?.map((tenant) => (
                      <motion.tr
                        key={tenant?.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <span className="font-medium text-white">{tenant?.name}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 text-slate-300">
                            <Phone className="w-4 h-4 text-slate-500" />
                            {tenant?.phone_number}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-slate-700 px-2 py-1 rounded font-mono text-slate-400">
                              ••••••••••••••••
                            </code>
                            <button
                              onClick={() => handleRegenerateKey(tenant)}
                              className="p-1 hover:bg-slate-600 rounded transition-colors flex items-center gap-1"
                              title="Regenerar API Key (gera uma nova chave)"
                            >
                              <RefreshCw className="w-4 h-4 text-violet-400" />
                              <span className="text-xs text-violet-400 hidden sm:inline">Nova Key</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant={tenant?.is_active ? 'success' : 'secondary'}>
                            {tenant?.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleActive(tenant)}
                              className={`p-2 rounded-lg transition-colors ${
                                tenant?.is_active
                                  ? 'hover:bg-red-500/20 text-red-400'
                                  : 'hover:bg-green-500/20 text-green-400'
                              }`}
                              title={tenant?.is_active ? 'Desativar' : 'Ativar'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTenant(tenant);
                                setFormData({ name: tenant?.name ?? '', phone_number: tenant?.phone_number ?? '' });
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 rounded-lg hover:bg-slate-600 text-slate-400 transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTenant(tenant);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                              title="Deletar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Key Modal — shown after creation or regeneration */}
      <Modal
        open={isApiKeyModalOpen}
        onOpenChange={(open) => {
          setIsApiKeyModalOpen(open);
          if (!open) {
            setNewApiKey('');
            setNewApiKeyTenantName('');
            setCopiedApiKey(false);
          }
        }}
        title="API Key Gerada"
        description={`Chave do tenant "${newApiKeyTenantName}"`}
      >
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">
              Copie esta chave agora. Ela <strong>não será exibida novamente</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-slate-700 px-3 py-2 rounded font-mono text-green-300 break-all select-all">
              {newApiKey}
            </code>
            <button
              onClick={() => copyToClipboard(newApiKey)}
              className="p-2 hover:bg-slate-600 rounded transition-colors shrink-0"
              title="Copiar"
            >
              {copiedApiKey ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : (
                <Copy className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                copyToClipboard(newApiKey);
                setTimeout(() => setIsApiKeyModalOpen(false), 500);
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar e Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Novo Tenant"
        description="Crie um novo tenant para o sistema"
      >
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Nome</label>
            <Input
              placeholder="Nome do tenant"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Telefone</label>
            <Input
              placeholder="+5511999999999"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        title="Editar Tenant"
        description="Atualize as informações do tenant"
      >
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Nome</label>
            <Input
              placeholder="Nome do tenant"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Telefone</label>
            <Input
              placeholder="+5511999999999"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Salvar
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
            Tem certeza que deseja deletar o tenant <strong className="text-white">{selectedTenant?.name}</strong>?
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
