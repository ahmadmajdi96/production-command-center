import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MES_BACKEND } from "@/integrations/supabase/mes-backend";
import type { Database, Json } from "./database.types";

function backendUrl(value: string) {
  const url = new URL(value);
  return url.origin + url.pathname.replace(/\/+$/, "");
}

// Dedicated APS commands added after the imported source schema snapshot.
type ApsDatabase = Database & {
  public: {
    Functions: {
      aps_create_schedule_draft: {
        Args: { actor_email: string; draft: Json };
        Returns: { id: string; version_no: number }[];
      };
      aps_transition_schedule: {
        Args: {
          target_id: string;
          actor_email: string;
          decision: "submit" | "approved" | "rejected";
          signer_name?: string | null;
          comment?: string | null;
        };
        Returns: undefined;
      };
    };
  };
};

let apsDb: SupabaseClient<ApsDatabase> | undefined;

/** The isolated APS planning database never shares a client with MES. */
export function getApsDb() {
  if (apsDb) return apsDb;
  const url = process.env.APS_SUPABASE_URL;
  const key = process.env.APS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("APS planning database is not configured.");
  if (
    [MES_BACKEND.url, process.env.SUPABASE_URL].some(
      (mes) => mes && backendUrl(mes) === backendUrl(url),
    )
  ) {
    throw new Error("APS requires a planning database separate from MES.");
  }

  apsDb = createClient<ApsDatabase>(url, key, {
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
