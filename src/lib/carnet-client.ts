import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { backendConfig, backendFetch } from "./backend-config";

// Use the external account's own storage key, not the managed Cloud session.
export const supabase = createClient<Database>(
  backendConfig.url,
  backendConfig.publishableKey,
  { global: { fetch: backendFetch } },
);