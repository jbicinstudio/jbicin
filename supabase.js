const JBICIN_SUPABASE_URL =
  "https://rnpnokzbqqdbbpwmarkw.supabase.co";

const JBICIN_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_x9wtOC-cLRfe8PKJpTXpsQ_xZXmb8YD";

const jbicinSupabase = window.supabase.createClient(
  JBICIN_SUPABASE_URL,
  JBICIN_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
