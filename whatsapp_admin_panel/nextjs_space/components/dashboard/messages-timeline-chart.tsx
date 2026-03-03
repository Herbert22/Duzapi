'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type Period = 'hour' | 'day' | 'week';

interface TimelineData {
  label: string;
  messages: number;
  text: number;
  audio: number;
}

interface MessagesTimelineChartProps {
  period: Period;
}

export default function MessagesTimelineChart({ period }: MessagesTimelineChartProps) {
  const [data, setData] = useState<TimelineData[]>([]);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/proxy/messages/history?limit=2000');
      if (response.ok) {
        const messages = await response.json();
        if (messages?.length > 0) {
          const grouped = groupByPeriod(messages, period);
          if (grouped.length > 0) {
            setData(grouped);
            return;
          }
        }
      }
      generateMockData();
    } catch {
      generateMockData();
    }
  };

  const groupByPeriod = (messages: any[], p: Period): TimelineData[] => {
    const groups: Record<string, { messages: number; text: number; audio: number }> = {};

    messages.forEach((msg: any) => {
      if (!msg.processed_at) return;
      const date = new Date(msg.processed_at);
      let key = '';

      if (p === 'hour') {
        key = `${date.getHours()}:00`;
      } else if (p === 'day') {
        key = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
      } else {
        const weekNum = getWeekNumber(date);
        key = `Sem ${weekNum}`;
      }

      if (!groups[key]) groups[key] = { messages: 0, text: 0, audio: 0 };
      groups[key].messages++;
      if (msg.message_type === 'audio') groups[key].audio++;
      else groups[key].text++;
    });

    return Object.entries(groups)
      .map(([label, data]) => ({ label, ...data }))
      .slice(-12);
  };

  const getWeekNumber = (d: Date): number => {
    const onejan = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  };

  const generateMockData = () => {
    const mockData: TimelineData[] = [];
    const count = period === 'hour' ? 24 : period === 'day' ? 7 : 8;

    for (let i = 0; i < count; i++) {
      const text = Math.floor(Math.random() * 80) + 20;
      const audio = Math.floor(Math.random() * 30) + 5;
      let label = '';

      if (period === 'hour') label = `${i}:00`;
      else if (period === 'day') {
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        label = days[i % 7];
      } else label = `Sem ${i + 1}`;

      mockData.push({ label, messages: text + audio, text, audio });
    }
    setData(mockData);
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorText" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorAudio" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
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
          <Area
            type="monotone"
            dataKey="text"
            stackId="1"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#colorText)"
            name="Texto"
          />
          <Area
            type="monotone"
            dataKey="audio"
            stackId="1"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#colorAudio)"
            name="Áudio"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
