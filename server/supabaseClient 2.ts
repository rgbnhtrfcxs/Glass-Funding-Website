import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";

// Load dotenv only in development
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

// Supabase environment variables
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Supabase environment variables missing. Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
  );
}

// Create Supabase client
export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
