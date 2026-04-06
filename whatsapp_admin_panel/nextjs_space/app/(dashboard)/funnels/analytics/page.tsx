'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, CheckCircle, XCircle, Clock, TrendingUp, Loader2, ArrowLeft, Phone, Copy, Send } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
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
  sender_phone_lid?: string | null;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

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

  useEffect(() => { fetchContacts(); setSelectedIds(new Set()); }, [fetchContacts]);

  const statusColors: Record<string, string> = {
    completed: 'bg-green-500/20 text-green-400',
    dropped: 'bg-red-500/20 text-red-400',
    in_progress: 'bg-amber-500/20 text-amber-400',
    reengagement: 'bg-blue-500/20 text-blue-400',
  };

  const statusLabels: Record<string, string> = {
    completed: 'Completou',
    dropped: 'Abandonou',
    in_progress: 'Em andamento',
    reengagement: 'Reengajamento',
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    // Remove non-digits, format as BR phone
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return phone;
  };

  const copyPhone = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    const digits = phone.replace(/\D/g, '');
    navigator.clipboard.writeText(digits);
    toast.success('Numero copiado!');
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) { toast.error('Digite uma mensagem'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/proxy/funnels/analytics/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_ids: Array.from(selectedIds), message: messageText }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.sent > 0) {
          toast.success(`${data.sent} mensagem(ns) enviada(s)${data.failed ? `, ${data.failed} falhou` : ''}`);
        } else if (data.failed > 0) {
          const reason = data.errors?.[0] || 'Erro desconhecido';
          toast.error(`${data.failed} mensagem(ns) falhou: ${reason}`);
        }
        setShowMessageModal(false);
        setMessageText('');
        setSelectedIds(new Set());
      } else {
        toast.error(data.detail || 'Erro ao enviar');
      }
    } catch {
      toast.error('Erro ao enviar mensagens');
    } finally {
      setSending(false);
    }
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
          <option value="reengagement">Reengajamento</option>
        </select>
        <span className="text-sm text-slate-500">{total} registros</span>
        {selectedIds.size > 0 && (
          <Button size="sm" onClick={() => setShowMessageModal(true)} className="ml-auto bg-gradient-to-r from-green-600 to-emerald-600">
            <Send className="w-4 h-4 mr-2" />
            Enviar mensagem ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Contacts table */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="p-4 w-10">
                    <input type="checkbox" checked={contacts.length > 0 && selectedIds.size === contacts.length} onChange={toggleSelectAll} className="rounded border-slate-600 bg-slate-800 text-violet-600" />
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Telefone</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Funil</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Etapas</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Data</th>
                </tr>
              </thead>
              <tbody>
                {loadingContacts ? (
                  <tr><td colSpan={6} className="text-center p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-500" /></td></tr>
                ) : contacts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-8 text-slate-500">Nenhum registro encontrado</td></tr>
                ) : contacts.map((c) => {
                  const vars = c.variables || {};
                  const varKeys = Object.keys(vars).filter((k) => k !== 'saudacao');
                  const isExpanded = expandedId === c.id;
                  return (
                    <tr key={c.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                      <td className="p-4 w-10" onClick={(e) => toggleSelect(e, c.id)}>
                        <input type="checkbox" checked={selectedIds.has(c.id)} readOnly className="rounded border-slate-600 bg-slate-800 text-violet-600" />
                      </td>
                      <td className="p-4" colSpan={isExpanded ? 5 : 1}>
                        {isExpanded ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-green-400" />
                                <span className="text-white font-mono text-sm font-bold">{formatPhone(c.sender_phone)}</span>
                                <button onClick={(e) => copyPhone(e, c.sender_phone)} className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors" title="Copiar numero">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                {c.sender_phone_lid && (
                                  <span className="text-xs text-slate-600">({c.sender_phone_lid.split('@')[0].slice(-6)})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={statusColors[c.status] || 'bg-slate-500/20 text-slate-400'}>
                                  {statusLabels[c.status] || c.status}
                                </Badge>
                                <span className="text-xs text-slate-500">
                                  {c.started_at ? new Date(c.started_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-slate-500">{c.funnel_name} — {c.total_nodes} etapas</div>
                            {varKeys.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/50 rounded-lg p-3">
                                {varKeys.map((k) => (
                                  <div key={k}>
                                    <span className="text-xs text-slate-500">{k.replace(/_/g, ' ')}</span>
                                    <p className="text-sm text-white">{vars[k] || '-'}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-500" />
                            <span className="text-white font-mono text-sm">{formatPhone(c.sender_phone)}</span>
                            <button onClick={(e) => copyPhone(e, c.sender_phone)} className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors" title="Copiar numero">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {varKeys.length > 0 && (
                              <span className="text-xs text-slate-600 ml-2">{varKeys.length} dados coletados</span>
                            )}
                          </div>
                        )}
                      </td>
                      {!isExpanded && (
                        <>
                          <td className="p-4 text-slate-300 text-sm">{c.funnel_name || '-'}</td>
                          <td className="p-4">
                            <Badge className={statusColors[c.status] || 'bg-slate-500/20 text-slate-400'}>
                              {statusLabels[c.status] || c.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-slate-400">{c.total_nodes}</td>
                          <td className="p-4 text-sm text-slate-500">
                            {c.started_at ? new Date(c.started_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
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

      {/* Send Message Modal */}
      <Modal open={showMessageModal} onOpenChange={setShowMessageModal} title="Enviar Mensagem" description={`Enviar para ${selectedIds.size} contato(s) selecionado(s)`}>
        <div className="space-y-4 mt-4">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Digite a mensagem que sera enviada via WhatsApp..."
            className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowMessageModal(false)}>Cancelar</Button>
            <Button onClick={handleSendMessage} disabled={sending} className="bg-gradient-to-r from-green-600 to-emerald-600">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
