// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Client côté serveur uniquement, utilise la clé service_role — ne jamais
// importer ce fichier dans un composant client.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
