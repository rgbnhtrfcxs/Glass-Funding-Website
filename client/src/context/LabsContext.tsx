import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { mockLabs, type LabPartner } from "@/data/mockLabs";

type LabInput = Omit<LabPartner, "id"> & { id?: number };
type LabUpdate = Partial<Omit<LabPartner, "id">>;

interface LabsContextValue {
  labs: LabPartner[];
  addLab: (lab: LabInput) => LabPartner;
  updateLab: (id: number, updates: LabUpdate) => void;
  removeLab: (id: number) => void;
}

const LabsContext = createContext<LabsContextValue | undefined>(undefined);

export function LabsProvider({ children }: { children: ReactNode }) {
  const [labs, setLabs] = useState<LabPartner[]>(mockLabs);

  const addLab = useCallback((lab: LabInput) => {
    let createdLab: LabPartner | null = null;
    setLabs(current => {
      const nextId = lab.id ?? (current.length ? Math.max(...current.map(item => item.id)) + 1 : 1);
      createdLab = { ...lab, id: nextId };
      return [...current, createdLab];
    });
    if (!createdLab) {
      throw new Error("Failed to create lab entry");
    }
    return createdLab;
  }, []);

  const updateLab = useCallback((id: number, updates: LabUpdate) => {
    setLabs(current =>
      current.map(lab => (lab.id === id ? { ...lab, ...updates } : lab)),
    );
  }, []);

  const removeLab = useCallback((id: number) => {
    setLabs(current => current.filter(lab => lab.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      labs,
      addLab,
      updateLab,
      removeLab,
    }),
    [labs, addLab, updateLab, removeLab],
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
