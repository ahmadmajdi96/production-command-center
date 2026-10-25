import "@/integrations/supabase/mes-backend";
// PMS shares the MES Command Center backend. Publishable values only.
const MES_URL = "https://rhzqncnxnglazqzvzjvl.supabase.co";
const MES_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoenFuY254bmdsYXpxenZ6anZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MTU3MjQsImV4cCI6MjA5OTM5MTcyNH0.bNpOcxMtmc_FWzAF029BZQcBE0hBu-J-qhE26vZumCM";
if (typeof process !== "undefined" && process.env) {
  process.env.SUPABASE_URL ||= MES_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY ||= MES_KEY;
}
export const MES_BACKEND = { url: MES_URL, key: MES_KEY };
