import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Supabase env missing: set SUPABASE_URL and SUPABASE_ANON_KEY");
}

export const supabasePublic = createClient(url, anonKey);
