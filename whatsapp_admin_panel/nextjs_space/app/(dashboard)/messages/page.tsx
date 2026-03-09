'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageLoading } from '@/components/ui/loading';
import {
  MessageSquare,
  Search,
  Filter,
  Mic,
  Type,
  Bot,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import type { MessageLog, Tenant } from '@/lib/types';

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageLog | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [selectedTenant, currentPage]);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/proxy/tenants');
      if (response.ok) {
        const data = await response.json();
        setTenants(data ?? []);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTenant) params.append('tenant_id', selectedTenant);
      params.append('limit', itemsPerPage.toString());
      params.append('offset', ((currentPage - 1) * itemsPerPage).toString());

      const response = await fetch(`/api/proxy/messages/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data?.items) {
          setMessages(data.items);
          setTotalMessages(data.total ?? 0);
        } else {
          setMessages(Array.isArray(data) ? data : []);
          setTotalMessages(Array.isArray(data) ? data.length : 0);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages?.filter((msg) => {
    const matchesSearch =
      msg?.content?.toLowerCase()?.includes(search?.toLowerCase() ?? '') ||
      msg?.sender_phone?.includes(search ?? '') ||
      msg?.ai_response?.toLowerCase()?.includes(search?.toLowerCase() ?? '');
    const matchesType = !selectedType || msg?.message_type === selectedType;
    return matchesSearch && matchesType;
  }) ?? [];

  const getTenantName = (tenantId: string) => {
    return tenants?.find((t) => t?.id === tenantId)?.name ?? 'Desconhecido';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return '';
    }
  };

  const totalPages = Math.ceil(totalMessages / itemsPerPage);

  if (loading && messages.length === 0) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Logs de Conversa</h1>
          <p className="text-slate-400 mt-1">Visualize o histórico de mensagens processadas</p>
        </div>
        <Button variant="outline" onClick={fetchMessages}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Buscar por conteúdo ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={selectedTenant}
              onChange={(e) => {
                setSelectedTenant(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[180px]"
            >
              <option value="">Todos os Inquilinos</option>
              {tenants?.map((t) => (
                <option key={t?.id} value={t?.id}>{t?.name}</option>
              ))}
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[150px]"
            >
              <option value="">Todos os Tipos</option>
              <option value="text">Texto</option>
              <option value="audio">Áudio</option>
              <option value="image">Imagem</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-violet-400" />
            Mensagens
            {totalMessages > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalMessages} mensagens
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMessages?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma mensagem encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filteredMessages?.map((msg, index) => (
                  <motion.div
                    key={msg?.id ?? index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl bg-slate-700/30 border border-slate-700/50 hover:border-violet-500/30 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedMessage(msg);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${
                        msg?.message_type === 'audio'
                          ? 'bg-green-500/20'
                          : 'bg-blue-500/20'
                      }`}>
                        {msg?.message_type === 'audio' ? (
                          <Mic className="w-5 h-5 text-green-400" />
                        ) : (
                          <Type className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <span className="font-medium text-white">{msg?.sender_phone}</span>
                          <Badge variant="secondary">{msg?.message_type}</Badge>
                          <span className="text-xs text-slate-500">
                            {getTenantName(msg?.tenant_id)}
                          </span>
                        </div>
                        
                        {/* User message */}
                        <div className="flex items-start gap-2 mb-2">
                          <User className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-slate-300">
                            {msg?.transcription ?? msg?.content ?? 'Sem conteúdo'}
                          </p>
                        </div>

                        {/* AI response */}
                        {msg?.ai_response && (
                          <div className="flex items-start gap-2">
                            <Bot className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-slate-400 line-clamp-2">
                              {msg.ai_response}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(msg?.processed_at)}
                        </span>
                        <button
                          className="p-1.5 rounded-lg hover:bg-slate-600 text-slate-400 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMessage(msg);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={filteredMessages?.length < itemsPerPage}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Detail Modal */}
      <Modal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        title="Detalhes da Mensagem"
        className="max-w-2xl"
      >
        {selectedMessage && (
          <div className="space-y-4 mt-4">
            {/* Header info */}
            <div className="flex flex-wrap gap-3">
              <Badge variant="default">{selectedMessage?.message_type}</Badge>
              <span className="text-sm text-slate-400">
                {getTenantName(selectedMessage?.tenant_id)}
              </span>
              <span className="text-sm text-slate-500">
                {formatDate(selectedMessage?.processed_at)}
              </span>
            </div>

            {/* Sender */}
            <div className="p-4 rounded-xl bg-slate-700/30">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Remetente</label>
              <p className="text-white mt-1">{selectedMessage?.sender_phone}</p>
            </div>

            {/* Original message */}
            <div className="p-4 rounded-xl bg-slate-700/30">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-400" />
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Mensagem Original</label>
              </div>
              <p className="text-white">{selectedMessage?.content ?? 'Sem conteúdo'}</p>
            </div>

            {/* Transcription (if audio) */}
            {selectedMessage?.transcription && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-4 h-4 text-green-400" />
                  <label className="text-xs font-medium text-green-400 uppercase tracking-wide">Transcrição</label>
                </div>
                <p className="text-white">{selectedMessage.transcription}</p>
              </div>
            )}

            {/* AI Response */}
            {selectedMessage?.ai_response && (
              <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-violet-400" />
                  <label className="text-xs font-medium text-violet-400 uppercase tracking-wide">Resposta da IA</label>
                </div>
                <p className="text-white whitespace-pre-wrap">{selectedMessage.ai_response}</p>
              </div>
            )}

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-700/20">
                <label className="text-xs text-slate-400">Processado em</label>
                <p className="text-sm text-white mt-1">{formatDate(selectedMessage?.processed_at)}</p>
              </div>
              {selectedMessage?.response_sent_at && (
                <div className="p-3 rounded-lg bg-slate-700/20">
                  <label className="text-xs text-slate-400">Resposta enviada em</label>
                  <p className="text-sm text-white mt-1">{formatDate(selectedMessage.response_sent_at)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
