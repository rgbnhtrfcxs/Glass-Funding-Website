import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { InsertTeam, Team, UpdateTeam } from "@shared/teams";

type TeamInput = InsertTeam;
type TeamUpdate = UpdateTeam;

interface TeamsContextValue {
  teams: Team[];
  isLoading: boolean;
  error: string | null;
  refresh: (includeHidden?: boolean) => Promise<void>;
  addTeam: (team: TeamInput) => Promise<Team>;
  updateTeam: (id: number, updates: TeamUpdate) => Promise<Team>;
  removeTeam: (id: number) => Promise<void>;
}

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined);

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

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeHidden, setIncludeHidden] = useState(false);

  const fetchTeams = useCallback(async (withHidden = false) => {
    setIsLoading(true);
    try {
      setIncludeHidden(withHidden);
      const data = await request<Team[]>(withHidden ? "/api/teams?includeHidden=true" : "/api/teams");
      const filtered = withHidden ? data : data.filter(team => team.isVisible !== false);
      setTeams(filtered);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load teams";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams(includeHidden);
  }, [fetchTeams, includeHidden]);

  const addTeam = useCallback(async (team: TeamInput) => {
    const created = await request<Team>("/api/teams", {
      method: "POST",
      body: JSON.stringify(team),
    });
    setTeams(current => {
      const next = [...current, created];
      return includeHidden ? next : next.filter(item => item.isVisible !== false);
    });
    return created;
  }, [includeHidden]);

  const updateTeam = useCallback(async (id: number, updates: TeamUpdate) => {
    const updated = await request<Team>(`/api/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    setTeams(current => {
      const next = current.map(team => (team.id === id ? updated : team));
      return includeHidden ? next : next.filter(item => item.isVisible !== false);
    });
    return updated;
  }, [includeHidden]);

  const removeTeam = useCallback(async (id: number) => {
    await request<undefined>(`/api/teams/${id}`, {
      method: "DELETE",
    });
    setTeams(current => current.filter(team => team.id !== id));
  }, []);

  const refresh = useCallback(
    async (withHidden = includeHidden) => {
      await fetchTeams(withHidden);
    },
    [fetchTeams, includeHidden],
  );

  const value = useMemo(
    () => ({
      teams,
      isLoading,
      error,
      refresh,
      addTeam,
      updateTeam,
      removeTeam,
    }),
    [teams, isLoading, error, refresh, addTeam, updateTeam, removeTeam],
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

export function useTeams() {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error("useTeams must be used within a TeamsProvider");
  }
  return context;
}
