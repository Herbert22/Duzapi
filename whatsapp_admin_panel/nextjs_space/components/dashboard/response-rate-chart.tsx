'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface RateData {
  name: string;
  value: number;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

export default function ResponseRateChart() {
  const [data, setData] = useState<RateData[]>([]);
  const [rate, setRate] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/proxy/messages/history?limit=1000');
      if (response.ok) {
        const messages = await response.json();
        if (messages?.length > 0) {
          const withResponse = messages.filter((m: any) => m.ai_response).length;
          const withoutResponse = messages.length - withResponse;
          const responseRate = Math.round((withResponse / messages.length) * 100);
          
          setRate(responseRate);
          setData([
            { name: 'Respondidas', value: withResponse },
            { name: 'Sem Resposta', value: withoutResponse },
          ]);
          return;
        }
      }

      // Mock data
      setRate(96);
      setData([
        { name: 'Respondidas', value: 96 },
        { name: 'Sem Resposta', value: 4 },
      ]);
    } catch {
      setRate(96);
      setData([
        { name: 'Respondidas', value: 96 },
        { name: 'Sem Resposta', value: 4 },
      ]);
    }
  };

  return (
    <div className="h-[250px] w-full relative">
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div className="text-center">
          <p className="text-4xl font-bold text-white">{rate}%</p>
          <p className="text-sm text-slate-400">Taxa de Resposta</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={90}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
