'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageLoading } from '@/components/ui/loading';
import {
  Smartphone,
  Plus,
  Play,
  Square,
  RefreshCw,
  QrCode,
  Wifi,
  WifiOff,
  Loader2,
  Link as LinkIcon,
  Check,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import type { Tenant } from '@/lib/types';

interface WhatsAppSession {
  sessionId: string;
  status: string;
  tenantId?: string;
  tenantName?: string;
}

export default function WhatsAppPage() {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [newSessionId, setNewSessionId] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sessionsRes, tenantsRes] = await Promise.all([
        fetch('/api/proxy/whatsapp/sessions').catch(() => ({ ok: false })),
        fetch('/api/proxy/tenants').catch(() => ({ ok: false })),
      ]);

      let loadedTenants: Tenant[] = [];
      if ((tenantsRes as Response).ok) {
        const tenantsData = await (tenantsRes as Response).json();
        loadedTenants = tenantsData ?? [];
        setTenants(loadedTenants);
      }
      if ((sessionsRes as Response).ok) {
        const sessionsData = await (sessionsRes as Response).json();
        const rawSessions: WhatsAppSession[] = Array.isArray(sessionsData) ? sessionsData : sessionsData?.sessions ?? [];
        // Enrich sessions with tenant names
        const enriched = rawSessions.map((s) => ({
          ...s,
          tenantName: s.tenantId ? loadedTenants.find((t) => t.id === s.tenantId)?.name : undefined,
        }));
        setSessions(enriched);
      }
    } catch {
      // Backend unavailable - using empty data
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/proxy/whatsapp/sessions/${sessionId}/start`, {
        method: 'POST',
      });
      if (response.ok) {
        toast.success('Sessão iniciada!');
        fetchData();
        // Try to get QR code
        setSelectedSession(sessionId);
        setTimeout(() => fetchQrCode(sessionId), 2000);
      } else {
        toast.error('Erro ao iniciar sessão');
      }
    } catch (error) {
      toast.error('Erro ao conectar com WhatsApp Bridge');
    }
  };

  const stopSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/proxy/whatsapp/sessions/${sessionId}/stop`, {
        method: 'POST',
      });
      if (response.ok) {
        toast.success('Sessão parada!');
        fetchData();
      } else {
        toast.error('Erro ao parar sessão');
      }
    } catch (error) {
      toast.error('Erro ao conectar com WhatsApp Bridge');
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm(`Tem certeza que deseja excluir a sessão "${sessionId}"? Isso removerá todos os dados da sessão.`)) return;
    try {
      const response = await fetch(`/api/proxy/whatsapp/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('Sessão excluída!');
        fetchData();
      } else {
        toast.error('Erro ao excluir sessão');
      }
    } catch (error) {
      toast.error('Erro ao conectar com WhatsApp Bridge');
    }
  };

  const fetchQrCode = useCallback(async (sessionId: string) => {
    setQrLoading(true);
    try {
      // Check status first — only start if not already running/waiting QR
      const statusRes = await fetch(`/api/proxy/whatsapp/sessions/${sessionId}/status`);
      const statusData = statusRes.ok ? await statusRes.json() : null;
      const currentStatus = statusData?.status;

      if (currentStatus === 'connected') {
        toast.success('Sessão já está conectada!');
        fetchData();
        return;
      }

      // If session has QR ready, show it immediately
      if (currentStatus === 'waiting_qr_scan' && statusData?.qrCode) {
        setQrCode(statusData.qrCode);
        setIsQrModalOpen(true);
        return;
      }

      // Only start if not already in progress
      if (currentStatus === 'not_found' || currentStatus === 'disconnected') {
        await fetch(`/api/proxy/whatsapp/sessions/${sessionId}/start`, {
          method: 'POST',
        });
      }

      // Poll for QR code — Chromium takes 15-30s on small VPS
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const maxAttempts = 30;

      for (let i = 0; i < maxAttempts; i++) {
        await delay(i < 3 ? 2000 : 1500);

        const response = await fetch(`/api/proxy/whatsapp/sessions/${sessionId}/status`);
        if (response.ok) {
          const data = await response.json();

          // Session connected while waiting
          if (data?.status === 'connected') {
            toast.success('Sessão conectada!');
            setIsQrModalOpen(false);
            fetchData();
            return;
          }

          const qr = data?.qrCode;
          if (qr) {
            setQrCode(qr);
            setIsQrModalOpen(true);
            fetchData();
            return;
          }
        }
      }
      toast.error('QR Code não disponível. Tente novamente.');
    } catch {
      toast.error('Erro ao conectar com WhatsApp Bridge');
    } finally {
      setQrLoading(false);
    }
  }, []);

  const createAndStartSession = async () => {
    if (!newSessionId) {
      toast.error('Digite o ID da sessão');
      return;
    }
    setSubmitting(true);
    try {
      // Map tenant first (fast operation)
      if (selectedTenantId) {
        await fetch(`/api/proxy/whatsapp/sessions/${newSessionId}/tenant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: selectedTenantId }),
        });
      }

      const sessionName = newSessionId;

      // Close create modal → open QR modal with loading state
      setIsNewSessionModalOpen(false);
      setNewSessionId('');
      setSelectedTenantId('');
      setSelectedSession(sessionName);
      setQrCode(null);
      setIsQrModalOpen(true);

      // Start session + fetch QR (QR modal already visible with spinner)
      fetchQrCode(sessionName);
    } catch (error) {
      toast.error('Erro ao criar sessão');
    } finally {
      setSubmitting(false);
    }
  };

  const mapTenantToSession = async (sessionId: string, tenantId: string) => {
    try {
      const response = await fetch(`/api/proxy/whatsapp/sessions/${sessionId}/tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (response.ok) {
        toast.success('Tenant vinculado!');
        fetchData();
      } else {
        toast.error('Erro ao vincular tenant');
      }
    } catch (error) {
      toast.error('Erro ao conectar com WhatsApp Bridge');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'already_connected':
        return 'success';
      case 'connecting':
      case 'qr':
      case 'waiting_qr_scan':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'already_connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando';
      case 'qr':
      case 'waiting_qr_scan':
        return 'Aguardando QR';
      default:
        return 'Desconectado';
    }
  };

  // Auto-refresh QR while modal is open
  useEffect(() => {
    if (!isQrModalOpen || !selectedSession) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/proxy/whatsapp/sessions/${selectedSession}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data?.status === 'connected') {
          toast.success('WhatsApp conectado!');
          setIsQrModalOpen(false);
          setQrCode(null);
          fetchData();
          return;
        }

        if (data?.qrCode) {
          setQrCode(data.qrCode);
        }
      } catch { /* ignore */ }
    }, 15000);

    return () => clearInterval(interval);
  }, [isQrModalOpen, selectedSession]);

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">WhatsApp</h1>
          <p className="text-slate-400 mt-1">Gerencie as sessões do WhatsApp</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={() => setIsNewSessionModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Sessão
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-violet-400" />
            Sessões WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma sessão encontrada</p>
              <p className="text-sm mt-1">Inicie uma nova sessão para conectar ao WhatsApp</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {sessions?.map((session) => (
                  <motion.div
                    key={session?.sessionId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 rounded-xl bg-slate-700/30 border border-slate-700/50"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          session?.status === 'connected'
                            ? 'bg-green-500/20'
                            : 'bg-slate-600/50'
                        }`}>
                          {session?.status === 'connected' ? (
                            <Wifi className="w-5 h-5 text-green-400" />
                          ) : (
                            <WifiOff className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{session?.sessionId}</h3>
                          {session?.tenantName && (
                            <p className="text-xs text-slate-400">{session.tenantName}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={getStatusColor(session?.status)}>
                        {getStatusLabel(session?.status)}
                      </Badge>
                    </div>

                    {/* Tenant mapping */}
                    {!session?.tenantId && (
                      <div className="mb-4">
                        <label className="text-xs text-slate-400 block mb-1">Vincular a Inquilino</label>
                        <select
                          className="w-full h-9 px-3 rounded-lg border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          onChange={(e) => e.target.value && mapTenantToSession(session?.sessionId, e.target.value)}
                          defaultValue=""
                        >
                          <option value="">Selecione um inquilino</option>
                          {tenants?.map((t) => (
                            <option key={t?.id} value={t?.id}>{t?.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700/50">
                      {session?.status !== 'connected' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSession(session?.sessionId);
                            fetchQrCode(session?.sessionId);
                          }}
                          disabled={qrLoading && selectedSession === session?.sessionId}
                        >
                          {qrLoading && selectedSession === session?.sessionId ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <QrCode className="w-4 h-4 mr-1" />
                          )}
                          QR Code
                        </Button>
                      )}
                      {session?.status === 'connected' ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => stopSession(session?.sessionId)}
                        >
                          <Square className="w-4 h-4 mr-1" />
                          Parar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => startSession(session?.sessionId)}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Iniciar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-400 hover:text-red-300 hover:border-red-500/50"
                        onClick={() => deleteSession(session?.sessionId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Session Modal */}
      <Modal
        open={isNewSessionModalOpen}
        onOpenChange={setIsNewSessionModalOpen}
        title="Nova Sessão WhatsApp"
        description="Crie uma nova sessão para conectar ao WhatsApp"
      >
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">ID da Sessão</label>
            <Input
              placeholder="Ex: session-001"
              value={newSessionId}
              onChange={(e) => setNewSessionId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Vincular a Inquilino (opcional)</label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Selecione um inquilino</option>
              {tenants?.map((t) => (
                <option key={t?.id} value={t?.id}>{t?.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsNewSessionModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createAndStartSession} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Criar e Iniciar
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        open={isQrModalOpen}
        onOpenChange={setIsQrModalOpen}
        title="QR Code WhatsApp"
        description="Escaneie o QR Code com seu WhatsApp"
      >
        <div className="flex flex-col items-center py-6">
          {qrCode ? (
            <>
              <div className="p-4 bg-white rounded-xl">
                <img
                  src={qrCode?.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-sm text-slate-400 mt-4 text-center">
                Abra o WhatsApp no seu celular, vá em Dispositivos Vinculados e escaneie o código
              </p>
            </>
          ) : qrLoading ? (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <Loader2 className="w-12 h-12 mb-3 animate-spin text-violet-400" />
              <p className="text-white font-medium">Iniciando sessão...</p>
              <p className="text-sm mt-1">Aguarde enquanto o navegador é iniciado (~20s)</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <AlertCircle className="w-12 h-12 mb-3" />
              <p>QR Code não disponível</p>
              <p className="text-sm mt-1">Tente atualizar ou iniciar a sessão novamente</p>
            </div>
          )}
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => selectedSession && fetchQrCode(selectedSession)}
            disabled={qrLoading}
          >
            {qrLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Atualizar QR
          </Button>
        </div>
      </Modal>
    </div>
  );
}
