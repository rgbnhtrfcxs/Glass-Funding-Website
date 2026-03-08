import { Route } from "wouter";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

/** Route guard: allows access for auditor, audit_manager, and admin roles. */
export default function AuditorRoute({
  path,
  component: Component,
}: {
  path: string;
  component: ComponentType<any>;
}) {
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!user) {
        setAllowed(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setAllowed(false);
        return;
      }
      const role: string = (data as any)?.role ?? "user";
      const isAdmin: boolean = Boolean((data as any)?.is_admin);
      setAllowed(isAdmin || ["auditor", "audit_manager", "admin"].includes(role));
    }
    if (!loading) check();
    return () => {
      mounted = false;
    };
  }, [loading, user?.id]);

  return (
    <Route
      path={path}
      component={(props: any) => {
        if (loading || allowed === null) return null;
        if (!user) {
          window.location.replace(`/login?next=${encodeURIComponent(path)}`);
          return null;
        }
        if (!allowed) {
          window.location.replace("/");
          return null;
        }
        return <Component {...props} />;
      }}
    />
  );
}
