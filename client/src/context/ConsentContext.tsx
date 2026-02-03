import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CONSENT_STORAGE_KEY = "glass-consent";
const CONSENT_VERSION = 1;

export type ConsentPreferences = {
  functional: boolean;
  analytics: boolean;
};

type ConsentState = ConsentPreferences & {
  version: number;
  updatedAt: string;
};

type ConsentContextValue = {
  consent: ConsentState | null;
  hasFunctionalConsent: boolean;
  hasAnalyticsConsent: boolean;
  needsConsent: boolean;
  showPreferences: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  acceptAll: () => void;
  declineAll: () => void;
  savePreferences: (prefs: ConsentPreferences) => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConsentState;
        if (parsed?.version === CONSENT_VERSION) {
          setConsent(parsed);
        }
      }
    } catch {
      // Ignore storage errors.
    } finally {
      setHydrated(true);
    }
  }, []);

  const persist = (prefs: ConsentPreferences) => {
    const payload: ConsentState = {
      ...prefs,
      version: CONSENT_VERSION,
      updatedAt: new Date().toISOString(),
    };
    setConsent(payload);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors.
    }
  };

  const acceptAll = () => {
    persist({ functional: true, analytics: true });
    setShowPreferences(false);
  };

  const declineAll = () => {
    persist({ functional: false, analytics: false });
    setShowPreferences(false);
  };

  const savePreferences = (prefs: ConsentPreferences) => {
    persist(prefs);
    setShowPreferences(false);
  };

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      hasFunctionalConsent: Boolean(consent?.functional),
      hasAnalyticsConsent: Boolean(consent?.analytics),
      needsConsent: hydrated && !consent,
      showPreferences,
      openPreferences: () => setShowPreferences(true),
      closePreferences: () => setShowPreferences(false),
      acceptAll,
      declineAll,
      savePreferences,
    }),
    [consent, hydrated, showPreferences]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error("useConsent must be used within a ConsentProvider.");
  }
  return context;
}
