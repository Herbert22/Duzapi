'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Receipt, DollarSign, Users, Loader2, Play, XCircle, CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  priceInCents: number;
  startDate: string | null;
  endDate: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

interface Summary {
  active: number;
  trial: number;
  mrr: number;
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<Summary>({ active: 0, trial: 0, mrr: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Extend modal
  const [extendSub, setExtendSub] = useState<Subscription | null>(null);
  const [extendDate, setExtendDate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    if (planFilter) params.set('plan', planFilter);

    try {
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
      setTotalPages(data.totalPages || 1);
      setSummary(data.summary || { active: 0, trial: 0, mrr: 0 });
    } catch {
      toast.error('Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, planFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) throw new Error();
      toast.success(action === 'activate' ? 'Ativada' : action === 'cancel' ? 'Cancelada' : 'Estendida');
      setExtendSub(null);
      fetchData();
    } catch {
      toast.error('Erro na operacao');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    cancelled: 'bg-red-500/20 text-red-400',
    expired: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Receipt className="w-8 h-8 text-amber-400" />
          Assinaturas
        </h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Ativos (pagos)</p>
              <p className="text-xl font-bold text-white">{summary.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Em Trial</p>
              <p className="text-xl font-bold text-white">{summary.trial}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">MRR</p>
              <p className="text-xl font-bold text-white">R$ {summary.mrr.toFixed(2).replace('.', ',')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white">
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending">Pendente</option>
          <option value="cancelled">Cancelado</option>
          <option value="expired">Expirado</option>
        </select>
        <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }} className="h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white">
          <option value="">Todos os planos</option>
          <option value="monthly">Mensal</option>
          <option value="yearly">Anual</option>
          <option value="trial">Trial</option>
        </select>
      </div>

      {/* Table */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Usuario</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Plano</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Preco</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Inicio</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Fim</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-500" /></td></tr>
                ) : subscriptions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-8 text-slate-500">Nenhuma assinatura encontrada</td></tr>
                ) : subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="p-4">
                      <div className="text-white">{sub.user.name || '-'}</div>
                      <div className="text-sm text-slate-400">{sub.user.email}</div>
                    </td>
                    <td className="p-4 text-slate-300 capitalize">{sub.plan}</td>
                    <td className="p-4"><Badge className={statusColors[sub.status] || statusColors.expired}>{sub.status}</Badge></td>
                    <td className="p-4 text-slate-300">R$ {(sub.priceInCents / 100).toFixed(2).replace('.', ',')}</td>
                    <td className="p-4 text-sm text-slate-500">{sub.startDate ? new Date(sub.startDate).toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="p-4 text-sm text-slate-500">{sub.endDate ? new Date(sub.endDate).toLocaleDateString('pt-BR') : sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        {sub.status !== 'active' && (
                          <button onClick={() => handleAction(sub.id, 'activate')} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-green-400" title="Ativar">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {sub.status === 'active' && (
                          <button onClick={() => handleAction(sub.id, 'cancel')} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400" title="Cancelar">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => { setExtendSub(sub); setExtendDate(''); }} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400" title="Estender">
                          <CalendarPlus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="px-4 py-2 text-sm text-slate-400">Pagina {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Proxima</Button>
        </div>
      )}

      {/* Extend Modal */}
      <Modal open={!!extendSub} onOpenChange={(open) => !open && setExtendSub(null)} title="Estender Assinatura" description={extendSub?.user.email || ''}>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Nova data de termino</label>
            <Input type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} className="bg-slate-800/50 border-slate-700" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setExtendSub(null)}>Cancelar</Button>
            <Button
              onClick={() => extendSub && handleAction(extendSub.id, 'extend', { endDate: extendDate })}
              disabled={submitting || !extendDate}
              className="bg-gradient-to-r from-amber-600 to-orange-600"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Estender
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
