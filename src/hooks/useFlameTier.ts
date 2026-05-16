import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FlameTier = "free" | "pro";

export function useFlameTier(): { tier: FlameTier; loading: boolean } {
  const { user } = useAuth();
  const [tier, setTier] = useState<FlameTier>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) { if (alive) { setTier("free"); setLoading(false); } return; }
      const { data } = await supabase
        .from("members")
        .select("buyers_club_tier, buyers_club_status")
        .eq("id", user.id)
        .maybeSingle();
      if (!alive) return;
      const t = (data as any)?.buyers_club_tier as string | null;
      const s = (data as any)?.buyers_club_status as string | null;
      const isPro =
        (t === "pro" && s === "active") ||
        (t === "fulfilled" && s === "active") ||
        t === "gold";
      setTier(isPro ? "pro" : "free");
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  return { tier, loading };
}
