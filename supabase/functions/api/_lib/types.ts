// Shared request-context types for the gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

export type Supabase = ReturnType<typeof createClient>;

export interface Ctx {
  user_id: string;
  org_id: string;
  role: string;
  display_name: string;
  email: string;
  auth_mode: "key" | "jwt";
  scopes: string[];
}
