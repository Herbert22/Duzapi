'use client';

import { SessionProvider } from 'next-auth/react';
import { Sidebar } from './sidebar';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Sidebar />
        <main className="lg:ml-64 min-h-screen">
          <div className="p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
