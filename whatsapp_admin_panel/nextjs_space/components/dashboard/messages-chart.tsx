'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  date: string;
  messages: number;
}

export default function MessagesChart() {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    // Generate mock data for the last 7 days
    const mockData: ChartData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      mockData.push({
        date: date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
        messages: Math.floor(Math.random() * 100) + 20,
      });
    }
    setData(mockData);

    // Try to fetch real data
    fetchRealData();
  }, []);

  const fetchRealData = async () => {
    try {
      const response = await fetch('/api/proxy/messages/history?limit=1000');
      if (response.ok) {
        const messages = await response.json();
        if (messages?.length > 0) {
          // Group messages by date
          const grouped: Record<string, number> = {};
          messages.forEach((msg: any) => {
            const date = new Date(msg?.processed_at)?.toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: '2-digit',
            });
            if (date) {
              grouped[date] = (grouped[date] ?? 0) + 1;
            }
          });

          const chartData = Object.entries(grouped).map(([date, messages]) => ({
            date,
            messages,
          }));

          if (chartData?.length > 0) {
            setData(chartData.slice(-7));
          }
        }
      }
    } catch {
      // Backend not available - using mock data
    }
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
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
            itemStyle={{ color: '#8b5cf6' }}
          />
          <Area
            type="monotone"
            dataKey="messages"
            stroke="#8b5cf6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorMessages)"
            name="Mensagens"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
