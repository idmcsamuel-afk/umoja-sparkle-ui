// Shared kill-switch for all paid AI generation paths (Creator Studio).
// Reads creator_feature_flags.creator_generation_enabled. FAILS CLOSED:
// if the flag row is missing or the check errors, generation is refused.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const GENERATION_DISABLED_BODY = {
  error: "generation_disabled",
  message:
    "AI generation is temporarily disabled by the platform while we upgrade the Creator Studio. Please try again later.",
};

export async function generationEnabled(): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data } = await supabase
      .from("creator_feature_flags")
      .select("enabled")
      .eq("key", "creator_generation_enabled")
      .maybeSingle();
    return data?.enabled === true;
  } catch {
    return false; // fail closed — never spend when unsure
  }
}
