import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authConfiguration, authConfigured } from "./config";

let client: SupabaseClient | undefined;

export function getAuthClient() {
  if (!authConfigured || typeof window === "undefined") throw { code: "not_configured" };
  client ??= createClient(authConfiguration.url, authConfiguration.key, {
    auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
  });
  return client;
}

export type UniversityMember = { id: string; email: string; name: string; university: string; account_kind?: "university" | "guest" };

// This RPC checks auth.uid(), the real auth.users.email_confirmed_at and the
// approved domain or consumed invitation in Postgres. User metadata grants no access.
export async function getUniversityMember(): Promise<UniversityMember> {
  const auth = getAuthClient();
  const { data, error } = await auth.rpc("universe_current_member");
  if (error) throw error;
  if (!data?.id || !data.email || !data.university) throw { code: "university_required" };
  return data as UniversityMember;
}
