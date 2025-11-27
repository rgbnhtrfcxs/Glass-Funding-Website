import { Route } from "wouter";
import type { ComponentType } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ path, component: Component }: { path: string; component: ComponentType<any> }) {
  const { user, loading } = useAuth();

  return (
    <Route
      path={path}
      component={(props: any) => {
        if (loading) return null;
        if (!user) {
          window.location.replace(`/login?next=${encodeURIComponent(path)}`);
          return null;
        }
        return <Component {...props} />;
      }}
    />
  );
}

