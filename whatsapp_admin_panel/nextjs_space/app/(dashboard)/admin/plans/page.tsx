'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Package, Plus, Pencil, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Plan {
  id: string;
  slug: string;
  name: string;
  priceInCents: number;
  cycle: string;
  description: string | null;
  features: string[];
  maxTenants: number;
  maxMessagesPerMonth: number;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm = { slug: '', name: '', priceInCents: 0, cycle: 'MONTHLY', description: '', features: '', maxTenants: 5, maxMessagesPerMonth: 10000, sortOrder: 0, isActive: true };

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/plans');
      const data = await res.json();
      setPlans(data || []);
    } catch {
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setForm({
      slug: plan.slug,
      name: plan.name,
      priceInCents: plan.priceInCents,
      cycle: plan.cycle,
      description: plan.description || '',
      features: plan.features.join('\n'),
      maxTenants: plan.maxTenants,
      maxMessagesPerMonth: plan.maxMessagesPerMonth,
      sortOrder: plan.sortOrder,
      isActive: plan.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const body = {
        ...form,
        features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
      };

      const url = editingId ? `/api/admin/plans/${editingId}` : '/api/admin/plans';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      toast.success(editingId ? 'Plano atualizado' : 'Plano criado');
      setShowModal(false);
      fetchPlans();
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (plan: Plan) => {
    try {
      await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      toast.success(plan.isActive ? 'Plano desativado' : 'Plano ativado');
      fetchPlans();
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-amber-400" />
            Planos
          </h1>
          <p className="text-slate-400 mt-1">Gerencie os planos de assinatura</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-amber-600 to-orange-600">
          <Plus className="w-4 h-4 mr-2" /> Novo Plano
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className={`bg-slate-800/50 border-slate-700/50 ${!plan.isActive ? 'opacity-50' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white text-lg">{plan.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={plan.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                    {plan.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <button onClick={() => openEdit(plan)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold text-white">
                    R$ {(plan.priceInCents / 100).toFixed(2).replace('.', ',')}
                    <span className="text-sm font-normal text-slate-400">/{plan.cycle === 'MONTHLY' ? 'mes' : 'ano'}</span>
                  </p>
                  <p className="text-sm text-slate-500 mt-1">Slug: {plan.slug}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-300">Limites</p>
                  <div className="flex gap-4 text-sm text-slate-400">
                    <span>{plan.maxTenants} tenants</span>
                    <span>{plan.maxMessagesPerMonth.toLocaleString()} msgs/mes</span>
                  </div>
                </div>

                {plan.features.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-300">Recursos</p>
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-400">
                        <Check className="w-3 h-3 text-green-400 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full" onClick={() => toggleActive(plan)}>
                  {plan.isActive ? 'Desativar' : 'Ativar'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onOpenChange={setShowModal} title={editingId ? 'Editar Plano' : 'Novo Plano'} description="Configure os detalhes do plano">
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Slug *</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="monthly" disabled={!!editingId} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Nome *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Plano Mensal" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Preco (centavos) *</label>
              <Input type="number" value={form.priceInCents} onChange={(e) => setForm({ ...form, priceInCents: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-slate-500">R$ {(form.priceInCents / 100).toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Ciclo *</label>
              <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className="w-full h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white">
                <option value="MONTHLY">Mensal</option>
                <option value="YEARLY">Anual</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Descricao</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descricao curta do plano" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Max Tenants</label>
              <Input type="number" value={form.maxTenants} onChange={(e) => setForm({ ...form, maxTenants: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Max Msgs/Mes</label>
              <Input type="number" value={form.maxMessagesPerMonth} onChange={(e) => setForm({ ...form, maxMessagesPerMonth: parseInt(e.target.value) || 500 })} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Recursos (um por linha)</label>
            <Textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} rows={4} placeholder="5 instancias WhatsApp&#10;10.000 mensagens/mes&#10;Suporte prioritario" />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-gradient-to-r from-amber-600 to-orange-600">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
