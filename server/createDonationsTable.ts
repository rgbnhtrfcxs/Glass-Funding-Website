import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase env vars");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createDonationsTable() {
  const { error } = await supabase.rpc("exec_sql", {
    sql: `
      create table if not exists donations (
        id uuid default gen_random_uuid() primary key,
        name text not null,
        email text,
        amount numeric(10,2) not null,
        message text,
        created_at timestamp with time zone default timezone('utc', now())
      );
    `,
  });

  if (error) console.error("❌ Error creating table:", error.message);
  else console.log("✅ Table 'donations' created successfully!");
}

createDonationsTable();
