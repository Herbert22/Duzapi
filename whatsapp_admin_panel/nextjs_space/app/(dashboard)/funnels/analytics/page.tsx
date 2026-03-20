'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, CheckCircle, XCircle, Clock, TrendingUp, Loader2, ArrowLeft, Phone } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Summary {
  leads_today: number;
  leads_week: number;
  leads_month: number;
  leads_total: number;
  completed: number;
  dropped: number;
  in_progress: number;
  conversion_rate: number;
}

interface Contact {
  id: string;
  sender_phone: string;
  funnel_name: string;
  funnel_id: string;
  status: string;
  last_node_type: string;
  last_node_label: string;
  nodes_visited: string[];
  total_nodes: number;
  variables: Record<string, string>;
  started_at: string;
  completed_at: string | null;
}

export default function FunnelAnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);

  useEffect(() => {
    fetch('/api/proxy/funnels/analytics/summary')
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => toast.error('Erro ao carregar resumo'))
      .finally(() => setLoading(false));
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);

    try {
      const res = await fetch(`/api/proxy/funnels/analytics/contacts?${params}`);
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch {
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoadingContacts(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const statusColors: Record<string, string> = {
    completed: 'bg-green-500/20 text-green-400',
    dropped: 'bg-red-500/20 text-red-400',
    in_progress: 'bg-amber-500/20 text-amber-400',
  };

  const statusLabels: Record<string, string> = {
    completed: 'Completou',
    dropped: 'Abandonou',
    in_progress: 'Em andamento',
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    // Remove non-digits, format as BR phone
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return phone;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/funnels">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Funis
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-violet-400" />
            Analytics de Funis
          </h1>
          <p className="text-slate-400 mt-1">Metricas de leads, conversao e progresso</p>
        </div>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>
      ) : summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Leads Hoje</p>
                  <p className="text-2xl font-bold text-white">{summary.leads_today}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Leads Semana</p>
                  <p className="text-2xl font-bold text-white">{summary.leads_week}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Leads Mes</p>
                  <p className="text-2xl font-bold text-white">{summary.leads_month}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Conversao</p>
                  <p className="text-2xl font-bold text-white">{summary.conversion_rate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status breakdown */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-sm text-slate-400">Completaram</p>
                <p className="text-xl font-bold text-green-400">{summary.completed}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm text-slate-400">Abandonaram</p>
                <p className="text-xl font-bold text-red-400">{summary.dropped}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm text-slate-400">Em andamento</p>
                <p className="text-xl font-bold text-amber-400">{summary.in_progress}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3 items-center">
        <span className="text-sm text-slate-400">Filtrar:</span>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white"
        >
          <option value="">Todos os status</option>
          <option value="completed">Completou</option>
          <option value="dropped">Abandonou</option>
          <option value="in_progress">Em andamento</option>
        </select>
        <span className="text-sm text-slate-500">{total} registros</span>
      </div>

      {/* Contacts table */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Telefone</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Funil</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Ultimo No</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Etapas</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Data</th>
                </tr>
              </thead>
              <tbody>
                {loadingContacts ? (
                  <tr><td colSpan={6} className="text-center p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-500" /></td></tr>
                ) : contacts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-8 text-slate-500">Nenhum registro encontrado</td></tr>
                ) : contacts.map((c) => (
                  <tr key={c.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-500" />
                        <span className="text-white font-mono text-sm">{formatPhone(c.sender_phone)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">{c.funnel_name || '-'}</td>
                    <td className="p-4">
                      <Badge className={statusColors[c.status] || 'bg-slate-500/20 text-slate-400'}>
                        {statusLabels[c.status] || c.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-slate-400">
                      <span className="capitalize">{c.last_node_type || '-'}</span>
                      {c.last_node_label && c.last_node_label !== c.last_node_type && (
                        <span className="text-slate-500 ml-1">({c.last_node_label.slice(0, 30)})</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-slate-400">{c.total_nodes}</td>
                    <td className="p-4 text-sm text-slate-500">
                      {c.started_at ? new Date(c.started_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
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
    </div>
  );
}
