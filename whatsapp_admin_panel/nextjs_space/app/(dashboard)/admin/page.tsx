'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UsersRound, Receipt, DollarSign, TrendingUp, UserPlus, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Stats {
  totalUsers: number;
  newUsersLast30: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  cancelledSubscriptions: number;
  mrr: number;
  signupsByMonth: Record<string, number>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <AlertCircle className="w-12 h-12 mb-3" />
        <p>Erro ao carregar estatisticas</p>
      </div>
    );
  }

  const cards = [
    { title: 'Total Usuarios', value: stats.totalUsers, icon: UsersRound, color: 'from-blue-500 to-cyan-500', href: '/admin/users' },
    { title: 'Novos (30 dias)', value: stats.newUsersLast30, icon: UserPlus, color: 'from-green-500 to-emerald-500', href: '/admin/users' },
    { title: 'Assinantes Ativos', value: stats.activeSubscriptions, icon: Receipt, color: 'from-violet-500 to-purple-500', href: '/admin/subscriptions' },
    { title: 'MRR', value: `R$ ${stats.mrr.toFixed(2).replace('.', ',')}`, icon: DollarSign, color: 'from-amber-500 to-orange-500', href: '/admin/subscriptions' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Painel Administrativo</h1>
        <p className="text-slate-400 mt-1">Visao geral do sistema</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="bg-slate-800/50 border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{card.title}</p>
                    <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <card.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Resumo Assinaturas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Ativos (pagos)</span>
              <Badge className="bg-green-500/20 text-green-400">{stats.activeSubscriptions}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Em trial</span>
              <Badge className="bg-violet-500/20 text-violet-400">{stats.trialSubscriptions}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Cancelados</span>
              <Badge className="bg-red-500/20 text-red-400">{stats.cancelledSubscriptions}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-lg">Cadastros por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {Object.entries(stats.signupsByMonth)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-6)
                .map(([month, count]) => {
                  const max = Math.max(...Object.values(stats.signupsByMonth), 1);
                  const height = (count / max) * 100;
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-slate-400">{count}</span>
                      <div
                        className="w-full bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-md min-h-[4px]"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-xs text-slate-500">{month.slice(5)}</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
