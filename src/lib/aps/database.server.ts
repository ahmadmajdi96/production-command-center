import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MES_BACKEND } from "@/integrations/supabase/mes-backend";
import type { Database } from "./database.types";

function backendUrl(value: string) {
  const url = new URL(value);
  return url.origin + url.pathname.replace(/\/+$/, "");
}

let apsDb: SupabaseClient<Database> | undefined;

/** The isolated APS planning database never shares a client with MES. */
export function getApsDb() {
  if (apsDb) return apsDb;
  const url = process.env.APS_SUPABASE_URL;
  const key = process.env.APS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("APS planning database is not configured.");
  if ([MES_BACKEND.url, process.env.SUPABASE_URL].some((mes) => mes && backendUrl(mes) === backendUrl(url))) {
    throw new Error("APS requires a planning database separate from MES.");
  }

  apsDb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  return apsDb;
}
