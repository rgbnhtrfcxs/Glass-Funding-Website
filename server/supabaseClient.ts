// Load dotenv only in development
if (process.env.NODE_ENV !== "production") {
  import("dotenv").then(dotenv => {
    const path = require("path");
    dotenv.config({ path: path.resolve(".env") });
  });
}

import { createClient } from "@supabase/supabase-js";

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
