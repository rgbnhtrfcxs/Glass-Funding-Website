import { useEffect, useState } from "react";
import { useConsent, type ConsentPreferences } from "@/context/ConsentContext";

export function ConsentBanner() {
  const {
    needsConsent,
    showPreferences,
    openPreferences,
    closePreferences,
    acceptAll,
    declineAll,
    savePreferences,
    hasFunctionalConsent,
    hasAnalyticsConsent,
  } = useConsent();
  const [draft, setDraft] = useState<ConsentPreferences>({
    functional: hasFunctionalConsent,
    analytics: hasAnalyticsConsent,
  });

  useEffect(() => {
    if (!showPreferences) return;
    setDraft({
      functional: hasFunctionalConsent,
      analytics: hasAnalyticsConsent,
    });
  }, [showPreferences, hasFunctionalConsent, hasAnalyticsConsent]);

  if (!needsConsent && !showPreferences) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto mb-6 w-[min(960px,92vw)] rounded-3xl border border-border bg-card/95 p-6 shadow-lg backdrop-blur">
        {!showPreferences ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">We respect your privacy</h3>
              <p className="text-sm text-muted-foreground">
                We use cookies and local storage for preferences and draft saving, plus optional analytics to
                understand lab page usage.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={declineAll}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                Decline non-essential
              </button>
              <button
                type="button"
                onClick={openPreferences}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
              >
                Manage preferences
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Cookie preferences</h3>
                <p className="text-sm text-muted-foreground">
                  Choose which non-essential features you want to enable. You can update this anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={closePreferences}
                className="text-sm text-muted-foreground transition hover:text-primary"
              >
                Close
              </button>
            </div>
            <div className="grid gap-3">
              <label className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Functional</p>
                  <p className="text-xs text-muted-foreground">
                    Saves preferences and drafts on your device so you can resume where you left off.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={draft.functional}
                  onChange={event =>
                    setDraft(prev => ({ ...prev, functional: event.target.checked }))
                  }
                />
              </label>
              <label className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Analytics</p>
                  <p className="text-xs text-muted-foreground">
                    Helps us measure lab profile views and improve the directory experience.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={draft.analytics}
                  onChange={event =>
                    setDraft(prev => ({ ...prev, analytics: event.target.checked }))
                  }
                />
              </label>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={declineAll}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                Decline non-essential
              </button>
              <button
                type="button"
                onClick={() => savePreferences(draft)}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
