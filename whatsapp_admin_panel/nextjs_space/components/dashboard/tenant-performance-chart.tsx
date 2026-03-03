'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface TenantData {
  name: string;
  messages: number;
  responses: number;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function TenantPerformanceChart() {
  const [data, setData] = useState<TenantData[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tenantsRes, messagesRes] = await Promise.all([
        fetch('/api/proxy/tenants'),
        fetch('/api/proxy/messages/history?limit=1000'),
      ]);

      if (tenantsRes.ok && messagesRes.ok) {
        const tenants = await tenantsRes.json();
        const messages = await messagesRes.json();

        if (tenants?.length > 0) {
          const tenantStats: Record<string, { messages: number; responses: number }> = {};
          
          tenants.forEach((t: any) => {
            tenantStats[t.id] = { messages: 0, responses: 0 };
          });

          messages?.forEach((msg: any) => {
            if (msg?.tenant_id && tenantStats[msg.tenant_id]) {
              tenantStats[msg.tenant_id].messages++;
              if (msg.ai_response) {
                tenantStats[msg.tenant_id].responses++;
              }
            }
          });

          const chartData = tenants.map((t: any) => ({
            name: t.name?.substring(0, 15) || 'Sem nome',
            messages: tenantStats[t.id]?.messages || 0,
            responses: tenantStats[t.id]?.responses || 0,
          })).slice(0, 6);

          setData(chartData);
          return;
        }
      }

      // Mock data fallback
      setData([
        { name: 'Cliente A', messages: 120, responses: 115 },
        { name: 'Cliente B', messages: 85, responses: 80 },
        { name: 'Cliente C', messages: 65, responses: 62 },
        { name: 'Cliente D', messages: 45, responses: 43 },
      ]);
    } catch {
      setData([
        { name: 'Cliente A', messages: 120, responses: 115 },
        { name: 'Cliente B', messages: 85, responses: 80 },
        { name: 'Cliente C', messages: 65, responses: 62 },
      ]);
    }
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="messages" name="Mensagens" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
            ))}
          </Bar>
          <Bar dataKey="responses" name="Respostas IA" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-resp-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.4} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
