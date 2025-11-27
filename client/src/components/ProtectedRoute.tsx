import { Route, useLocation } from "wouter";
import type { ComponentType } from "react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProtectedRoute({ path, component: Component }: { path: string; component: ComponentType<any> }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      setChecking(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setHasSession(!!data.session?.user);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    if (user) {
      setHasSession(true);
      setChecking(false);
    } else {
      void checkSession();
    }

    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <Route
      path={path}
      component={(props: any) => {
        if (loading || checking || hasSession === null) return null;
        if (user || hasSession) return <Component {...props} />;

        const next = encodeURIComponent(window.location.pathname + window.location.search);
        navigate(`/login?next=${next}`, { replace: true });
        return null;
      }}
    />
  );
}
