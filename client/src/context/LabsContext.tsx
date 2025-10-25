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
  refresh: () => Promise<void>;
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

  const fetchLabs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await request<LabPartner[]>("/api/labs");
      setLabs(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load labs";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

  const addLab = useCallback(async (lab: LabInput) => {
    const created = await request<LabPartner>("/api/labs", {
      method: "POST",
      body: JSON.stringify(lab),
    });
    setLabs(current => [...current, created]);
    return created;
  }, []);

  const updateLab = useCallback(async (id: number, updates: LabUpdate) => {
    const updated = await request<LabPartner>(`/api/labs/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    setLabs(current => current.map(lab => (lab.id === id ? updated : lab)));
    return updated;
  }, []);

  const removeLab = useCallback(async (id: number) => {
    await request<undefined>(`/api/labs/${id}`, {
      method: "DELETE",
    });
    setLabs(current => current.filter(lab => lab.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    await fetchLabs();
  }, [fetchLabs]);

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
