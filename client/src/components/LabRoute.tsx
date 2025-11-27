import { Route } from "wouter";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function LabRoute({ path, component: Component }: { path: string; component: ComponentType<any> }) {
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
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setAllowed(false);
        return;
      }
      const role = (data?.role as string) || "user";
      setAllowed(role === "lab" || role === "admin");
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
          const next = encodeURIComponent(window.location.pathname);
          window.location.replace(`/login?next=${next}`);
          return null;
        }
        if (!allowed) {
          const id = props?.params?.id;
          window.location.replace(id ? `/labs/${id}` : "/");
          return null;
        }
        return <Component {...props} />;
      }}
    />
  );
}

