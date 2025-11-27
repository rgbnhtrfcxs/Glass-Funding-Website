import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Logout() {
  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        window.location.replace("/");
      }
    })();
  }, []);

  return null;
}

