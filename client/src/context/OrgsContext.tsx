import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { InsertOrg, Org, UpdateOrg } from "@shared/orgs";

type OrgInput = InsertOrg;
type OrgUpdate = UpdateOrg;

interface OrgsContextValue {
  orgs: Org[];
  isLoading: boolean;
  error: string | null;
  refresh: (includeHidden?: boolean) => Promise<void>;
  addOrg: (org: OrgInput) => Promise<Org>;
  updateOrg: (id: number, updates: OrgUpdate) => Promise<Org>;
  removeOrg: (id: number) => Promise<void>;
}

const OrgsContext = createContext<OrgsContextValue | undefined>(undefined);

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
      if (payload?.message) message = payload.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function OrgsProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeHidden, setIncludeHidden] = useState(false);

  const fetchOrgs = useCallback(async (withHidden: boolean) => {
    setIsLoading(true);
    try {
      const data = await request<Org[]>(withHidden ? "/api/orgs?includeHidden=true" : "/api/orgs");
      const filtered = withHidden ? data : data.filter(org => org.isVisible !== false);
      setOrgs(filtered);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load organizations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs(false);
  }, [fetchOrgs]);

  const addOrg = useCallback(async (org: OrgInput) => {
    const created = await request<Org>("/api/orgs", {
      method: "POST",
      body: JSON.stringify(org),
    });
    setOrgs(current => {
      const next = [...current, created];
      return includeHidden ? next : next.filter(item => item.isVisible !== false);
    });
    return created;
  }, [includeHidden]);

  const updateOrg = useCallback(async (id: number, updates: OrgUpdate) => {
    const updated = await request<Org>(`/api/orgs/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    setOrgs(current => {
      const next = current.map(org => (org.id === id ? updated : org));
      return includeHidden ? next : next.filter(item => item.isVisible !== false);
    });
    return updated;
  }, [includeHidden]);

  const removeOrg = useCallback(async (id: number) => {
    await request<undefined>(`/api/orgs/${id}`, { method: "DELETE" });
    setOrgs(current => current.filter(org => org.id !== id));
  }, []);

  const refresh = useCallback(async (withHidden = includeHidden) => {
    setIncludeHidden(withHidden);
    await fetchOrgs(withHidden);
  }, [fetchOrgs, includeHidden]);

  const value = useMemo(
    () => ({ orgs, isLoading, error, refresh, addOrg, updateOrg, removeOrg }),
    [orgs, isLoading, error, refresh, addOrg, updateOrg, removeOrg],
  );

  return <OrgsContext.Provider value={value}>{children}</OrgsContext.Provider>;
}

export function useOrgs() {
  const context = useContext(OrgsContext);
  if (!context) throw new Error("useOrgs must be used within OrgsProvider");
  return context;
}
