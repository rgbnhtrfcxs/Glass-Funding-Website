import { createClient } from "@supabase/supabase-js";

// Load dotenv synchronously in development only
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  dotenv.config({ path: path.resolve(__dirname, ".env") });
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Supabase environment variables missing. Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
  );
}

export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
