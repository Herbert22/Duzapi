'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import {
  Users,
  Bot,
  MessageSquare,
  TrendingUp,
  Clock,
  Mic,
  Type,
  BarChart3,
  PieChart,
  Activity,
  CalendarDays,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const MessagesChart = dynamic(() => import('@/components/dashboard/messages-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] flex items-center justify-center"><PageLoading /></div>,
});

const TenantPerformanceChart = dynamic(() => import('@/components/dashboard/tenant-performance-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] flex items-center justify-center"><PageLoading /></div>,
});

const ResponseRateChart = dynamic(() => import('@/components/dashboard/response-rate-chart'), {
  ssr: false,
  loading: () => <div className="h-[250px] flex items-center justify-center"><PageLoading /></div>,
});

const AvgResponseTimeChart = dynamic(() => import('@/components/dashboard/avg-response-time-chart'), {
  ssr: false,
  loading: () => <div className="h-[280px] flex items-center justify-center"><PageLoading /></div>,
});

const MessagesTimelineChart = dynamic(() => import('@/components/dashboard/messages-timeline-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] flex items-center justify-center"><PageLoading /></div>,
});

type TimelinePeriod = 'hour' | 'day' | 'week';

interface Stats {
  totalTenants: number;
  activeConfigs: number;
  messagesLast24h: number;
  totalMessages: number;
  audioMessages: number;
  textMessages: number;
}

interface RecentMessage {
  id: string;
  sender_phone: string;
  content: string;
  message_type: string;
  processed_at: string;
  ai_response?: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelinePeriod, setTimelinePeriod] = useState<TimelinePeriod>('day');

  useEffect(() => {
    fetchData();
  }, [session, router]);

  const fetchData = async () => {
    try {
      const [tenantsRes, configsRes, messagesStatsRes, messagesRes] = await Promise.all([
        fetch('/api/proxy/tenants').catch(() => ({ ok: false, status: 0 })),
        fetch('/api/proxy/bot-configs').catch(() => ({ ok: false, status: 0 })),
        fetch('/api/proxy/messages/stats').catch(() => ({ ok: false, status: 0 })),
        fetch('/api/proxy/messages/history?limit=5').catch(() => ({ ok: false, status: 0 })),
      ]);

      // Check if subscription is required (403 from proxy)
      const anyRes = tenantsRes as Response;
      if (anyRes.status === 403) {
        const data = await anyRes.json().catch(() => ({}));
        if (data.subscriptionRequired) {
          window.location.href = '/billing';
          return;
        }
      }

      let tenants: any[] = [];
      let configs: any[] = [];
      let messagesStats: any = {};
      let messages: any[] = [];

      if ((tenantsRes as Response).ok) {
        tenants = await (tenantsRes as Response).json();
        if (!Array.isArray(tenants)) tenants = [];
      }
      if ((configsRes as Response).ok) {
        configs = await (configsRes as Response).json();
        if (!Array.isArray(configs)) configs = [];
      }
      if ((messagesStatsRes as Response).ok) {
        messagesStats = await (messagesStatsRes as Response).json();
      }
      if ((messagesRes as Response).ok) {
        const messagesData = await (messagesRes as Response).json();
        messages = messagesData?.items ?? (Array.isArray(messagesData) ? messagesData : []);
      }

      setStats({
        totalTenants: tenants?.length ?? 0,
        activeConfigs: configs?.filter((c: any) => c?.is_active)?.length ?? 0,
        messagesLast24h: messagesStats?.messages_last_24h ?? 0,
        totalMessages: messagesStats?.total_messages ?? 0,
        audioMessages: messagesStats?.audio_messages ?? 0,
        textMessages: messagesStats?.text_messages ?? 0,
      });
      setRecentMessages(messages ?? []);
    } catch {
      // Backend not available
      setStats({
        totalTenants: 0,
        activeConfigs: 0,
        messagesLast24h: 0,
        totalMessages: 0,
        audioMessages: 0,
        textMessages: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  const statCards = [
    {
      title: 'Total de Inquilinos',
      value: stats?.totalTenants ?? 0,
      icon: Users,
      color: 'from-violet-500 to-indigo-500',
      shadowColor: 'shadow-violet-500/25',
    },
    {
      title: 'Configurações Ativas',
      value: stats?.activeConfigs ?? 0,
      icon: Bot,
      color: 'from-green-500 to-emerald-500',
      shadowColor: 'shadow-green-500/25',
    },
    {
      title: 'Mensagens (24h)',
      value: stats?.messagesLast24h ?? 0,
      icon: MessageSquare,
      color: 'from-blue-500 to-cyan-500',
      shadowColor: 'shadow-blue-500/25',
    },
    {
      title: 'Total de Mensagens',
      value: stats?.totalMessages ?? 0,
      icon: TrendingUp,
      color: 'from-orange-500 to-amber-500',
      shadowColor: 'shadow-orange-500/25',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Visão geral do sistema de automação WhatsApp</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5`} />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{stat.title}</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      <AnimatedNumber value={stat.value} />
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} ${stat.shadowColor} shadow-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Gráficos de Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-violet-400" />
                Desempenho por Inquilino
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TenantPerformanceChart />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-green-400" />
                Taxa de Resposta da IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponseRateChart />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tempo Médio e Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Tempo de Resposta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AvgResponseTimeChart />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-violet-400" />
                  Mensagens por Período
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={timelinePeriod === 'hour' ? 'default' : 'outline'}
                    onClick={() => setTimelinePeriod('hour')}
                  >
                    Hora
                  </Button>
                  <Button
                    size="sm"
                    variant={timelinePeriod === 'day' ? 'default' : 'outline'}
                    onClick={() => setTimelinePeriod('day')}
                  >
                    Dia
                  </Button>
                  <Button
                    size="sm"
                    variant={timelinePeriod === 'week' ? 'default' : 'outline'}
                    onClick={() => setTimelinePeriod('week')}
                  >
                    Semana
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <MessagesTimelineChart period={timelinePeriod} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tipos de Mensagem */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-400" />
                Tendência de Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MessagesChart />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-violet-400" />
                Tipos de Mensagem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-700/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Type className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-slate-300">Texto</span>
                </div>
                <span className="text-xl font-bold text-white">{stats?.textMessages ?? 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-700/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Mic className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-slate-300">Áudio</span>
                </div>
                <span className="text-xl font-bold text-white">{stats?.audioMessages ?? 0}</span>
              </div>
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
                <p className="text-sm text-slate-400">Proporção Texto/Áudio</p>
                <div className="mt-2 h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${stats?.totalMessages ? Math.round((stats.textMessages / stats.totalMessages) * 100) : 50}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-slate-500">
                  <span>Texto: {stats?.totalMessages ? Math.round((stats.textMessages / stats.totalMessages) * 100) : 0}%</span>
                  <span>Áudio: {stats?.totalMessages ? Math.round((stats.audioMessages / stats.totalMessages) * 100) : 0}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-400" />
              Mensagens Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentMessages?.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma mensagem recente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMessages?.map((msg, index) => (
                  <div
                    key={msg?.id ?? index}
                    className="flex items-start gap-4 p-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-green-500/20">
                      {msg?.message_type === 'audio' ? (
                        <Mic className="w-5 h-5 text-green-400" />
                      ) : (
                        <MessageSquare className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          {msg?.sender_phone ?? 'Desconhecido'}
                        </span>
                        <Badge variant="secondary">
                          {msg?.message_type ?? 'text'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-300 truncate">
                        {msg?.content ?? 'Sem conteúdo'}
                      </p>
                      {msg?.ai_response && (
                        <p className="text-sm text-slate-500 truncate mt-1">
                          <span className="text-violet-400">IA:</span> {msg.ai_response}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(msg?.processed_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const stepValue = value / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue}</>;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
