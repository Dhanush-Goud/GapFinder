// Supabase clients for server code. The user client carries the visitor's session (RLS applies);
// the admin client uses the service-role key and must only ever run on the server.
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getServerConfig } from "@/lib/config";

export async function createUserClient(): Promise<SupabaseClient> {
  const { supabase } = getServerConfig();
  if (!supabase) throw new Error("Supabase is not configured.");
  const cookieStore = await cookies();
  return createServerClient(supabase.url, supabase.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only; middleware refreshes the session.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;
export function createAdminClient(): SupabaseClient {
  const { supabase } = getServerConfig();
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!admin) {
    admin = createClient(supabase.url, supabase.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
