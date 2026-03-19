'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface SettingsMap {
  [key: string]: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => toast.error('Erro ao carregar configuracoes'))
      .finally(() => setLoading(false));
  }, []);

  const saveSection = async (keys: string[]) => {
    const sectionId = keys[0];
    setSaving(sectionId);
    try {
      const body: SettingsMap = {};
      for (const key of keys) {
        body[key] = settings[key] || '';
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success('Configuracoes salvas');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(null);
    }
  };

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  const generalKeys = ['default_ai_provider', 'default_max_tenants', 'default_max_messages'];
  const emailKeys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_from'];
  const paymentKeys = ['asaas_mode'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-amber-400" />
          Configuracoes do Sistema
        </h1>
        <p className="text-slate-400 mt-1">Ajuste as configuracoes globais da plataforma</p>
      </div>

      {/* General */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Geral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Provedor IA Padrao</label>
              <select
                value={settings.default_ai_provider || 'gemini'}
                onChange={(e) => update('default_ai_provider', e.target.value)}
                className="w-full h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white"
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Max Tenants (novos users)</label>
              <Input
                type="number"
                value={settings.default_max_tenants || '1'}
                onChange={(e) => update('default_max_tenants', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Max Msgs/Mes (novos users)</label>
              <Input
                type="number"
                value={settings.default_max_messages || '500'}
                onChange={(e) => update('default_max_messages', e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveSection(generalKeys)} disabled={saving === 'default_ai_provider'} className="bg-gradient-to-r from-amber-600 to-orange-600">
              {saving === 'default_ai_provider' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Geral
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Email (SMTP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Host SMTP</label>
              <Input value={settings.smtp_host || ''} onChange={(e) => update('smtp_host', e.target.value)} placeholder="smtp.hostinger.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Porta</label>
              <Input value={settings.smtp_port || ''} onChange={(e) => update('smtp_port', e.target.value)} placeholder="465" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Usuario</label>
              <Input value={settings.smtp_user || ''} onChange={(e) => update('smtp_user', e.target.value)} placeholder="contato@duzapi.com.br" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Remetente</label>
              <Input value={settings.smtp_from || ''} onChange={(e) => update('smtp_from', e.target.value)} placeholder="contato@duzapi.com.br" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveSection(emailKeys)} disabled={saving === 'smtp_host'} className="bg-gradient-to-r from-amber-600 to-orange-600">
              {saving === 'smtp_host' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Pagamentos (Asaas)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Modo</label>
            <select
              value={settings.asaas_mode || 'production'}
              onChange={(e) => update('asaas_mode', e.target.value)}
              className="w-full h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white"
            >
              <option value="sandbox">Sandbox (testes)</option>
              <option value="production">Producao</option>
            </select>
          </div>
          <div className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/50">
            <p className="text-sm text-slate-400">Webhook URL:</p>
            <p className="text-sm text-white font-mono mt-1">https://duzapi.com.br/api/subscription/webhook</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveSection(paymentKeys)} disabled={saving === 'asaas_mode'} className="bg-gradient-to-r from-amber-600 to-orange-600">
              {saving === 'asaas_mode' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Pagamentos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
