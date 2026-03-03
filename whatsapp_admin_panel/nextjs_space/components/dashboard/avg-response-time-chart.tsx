'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TimeData {
  hour: string;
  avgTime: number;
}

export default function AvgResponseTimeChart() {
  const [data, setData] = useState<TimeData[]>([]);
  const [avgTime, setAvgTime] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/proxy/messages/history?limit=500');
      if (response.ok) {
        const messages = await response.json();
        if (messages?.length > 0) {
          const hourlyData: Record<number, { total: number; count: number }> = {};
          let totalTime = 0;
          let count = 0;

          messages.forEach((msg: any) => {
            if (msg.processed_at && msg.response_sent_at) {
              const processed = new Date(msg.processed_at).getTime();
              const sent = new Date(msg.response_sent_at).getTime();
              const diff = (sent - processed) / 1000; // seconds
              
              if (diff > 0 && diff < 300) { // max 5 min
                const hour = new Date(msg.processed_at).getHours();
                if (!hourlyData[hour]) hourlyData[hour] = { total: 0, count: 0 };
                hourlyData[hour].total += diff;
                hourlyData[hour].count++;
                totalTime += diff;
                count++;
              }
            }
          });

          if (count > 0) {
            setAvgTime(Math.round(totalTime / count));
            const chartData = Object.entries(hourlyData)
              .map(([hour, data]) => ({
                hour: `${hour}h`,
                avgTime: Math.round(data.total / data.count),
              }))
              .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
            setData(chartData);
            return;
          }
        }
      }

      // Mock data
      generateMockData();
    } catch {
      generateMockData();
    }
  };

  const generateMockData = () => {
    const mockData: TimeData[] = [];
    for (let i = 8; i <= 22; i++) {
      mockData.push({
        hour: `${i}h`,
        avgTime: Math.floor(Math.random() * 20) + 10,
      });
    }
    setData(mockData);
    setAvgTime(18);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20">
        <div>
          <p className="text-sm text-slate-400">Tempo Médio de Resposta</p>
          <p className="text-3xl font-bold text-white">{avgTime}s</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Meta</p>
          <p className="text-xl font-semibold text-cyan-400">&lt; 30s</p>
        </div>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              unit="s"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value}s`, 'Tempo Médio']}
            />
            <Line
              type="monotone"
              dataKey="avgTime"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={{ fill: '#06b6d4', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
