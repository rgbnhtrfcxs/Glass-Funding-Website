import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { InsertLab, LabPartner, UpdateLab } from "@shared/labs";

type LabInput = InsertLab;
type LabUpdate = UpdateLab;

interface LabsContextValue {
  labs: LabPartner[];
  isLoading: boolean;
  error: string | null;
  refresh: (includeHidden?: boolean) => Promise<void>;
  addLab: (lab: LabInput) => Promise<LabPartner>;
  updateLab: (id: number, updates: LabUpdate) => Promise<LabPartner>;
  removeLab: (id: number) => Promise<void>;
}

const LabsContext = createContext<LabsContextValue | undefined>(undefined);

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const { headers, ...rest } = init ?? {};
  const response = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function LabsProvider({ children }: { children: ReactNode }) {
  const [labs, setLabs] = useState<LabPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeHidden, setIncludeHidden] = useState(false);

  const fetchLabs = useCallback(async (withHidden = false) => {
    setIsLoading(true);
    try {
      setIncludeHidden(withHidden);
      const data = await request<LabPartner[]>(withHidden ? "/api/labs?includeHidden=true" : "/api/labs");
      const filtered = withHidden ? data : data.filter(lab => lab.isVisible !== false);
      setLabs(filtered);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load labs";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabs(includeHidden);
  }, [fetchLabs, includeHidden]);

  const addLab = useCallback(async (lab: LabInput) => {
    const created = await request<LabPartner>("/api/labs", {
      method: "POST",
      body: JSON.stringify(lab),
    });
    setLabs(current => {
      const next = [...current, created];
      return includeHidden ? next : next.filter(item => item.isVisible !== false);
    });
    return created;
  }, [includeHidden]);

  const updateLab = useCallback(async (id: number, updates: LabUpdate) => {
    const updated = await request<LabPartner>(`/api/labs/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    setLabs(current => {
      const next = current.map(lab => (lab.id === id ? updated : lab));
      return includeHidden ? next : next.filter(item => item.isVisible !== false);
    });
    return updated;
  }, [includeHidden]);

  const removeLab = useCallback(async (id: number) => {
    await request<undefined>(`/api/labs/${id}`, {
      method: "DELETE",
    });
    setLabs(current => current.filter(lab => lab.id !== id));
  }, []);

  const refresh = useCallback(
    async (withHidden = includeHidden) => {
      await fetchLabs(withHidden);
    },
    [fetchLabs, includeHidden],
  );

  const value = useMemo(
    () => ({
      labs,
      isLoading,
      error,
      refresh,
      addLab,
      updateLab,
      removeLab,
    }),
    [labs, isLoading, error, refresh, addLab, updateLab, removeLab],
  );

  return <LabsContext.Provider value={value}>{children}</LabsContext.Provider>;
}

export function useLabs() {
  const context = useContext(LabsContext);
  if (!context) {
    throw new Error("useLabs must be used within a LabsProvider");
  }
  return context;
}
