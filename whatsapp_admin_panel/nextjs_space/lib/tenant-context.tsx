'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface Tenant {
  id: string;
  name: string;
  phone_number: string;
  is_active: boolean;
}

interface TenantContextValue {
  tenants: Tenant[];
  currentTenantId: string | null;
  setCurrentTenantId: (id: string) => void;
  loading: boolean;
  needsOnboarding: boolean;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue>({
  tenants: [],
  currentTenantId: null,
  setCurrentTenantId: () => {},
  loading: true,
  needsOnboarding: false,
  refreshTenants: async () => {},
});

export function useTenant() {
  return useContext(TenantContext);
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/tenants');
      if (res.ok) {
        const data: Tenant[] = await res.json();
        setTenants(data);
        // Auto-select if user has exactly 1 tenant
        if (data.length === 1 && !currentTenantId) {
          setCurrentTenantId(data[0].id);
        } else if (data.length > 1 && !currentTenantId) {
          // Try to restore from localStorage
          const saved = localStorage.getItem('duzapi_current_tenant');
          if (saved && data.some((t) => t.id === saved)) {
            setCurrentTenantId(saved);
          } else {
            setCurrentTenantId(data[0].id);
          }
        }
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [currentTenantId]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // Persist selection
  useEffect(() => {
    if (currentTenantId) {
      localStorage.setItem('duzapi_current_tenant', currentTenantId);
    }
  }, [currentTenantId]);

  const needsOnboarding = !loading && tenants.length === 0;

  return (
    <TenantContext.Provider
      value={{
        tenants,
        currentTenantId,
        setCurrentTenantId,
        loading,
        needsOnboarding,
        refreshTenants: fetchTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}
