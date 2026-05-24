import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TIER_LIMITS: Record<string, { videos: number; platforms: string[] }> = {
  free: { videos: 2, platforms: ["youtube"] },
  creator: { videos: 150, platforms: ["youtube", "tiktok", "instagram"] },
  pro: { videos: 400, platforms: ["youtube", "tiktok", "instagram"] },
  agency: { videos: 1000, platforms: ["youtube", "tiktok", "instagram"] },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const _authHeader = req.headers.get("Authorization");
  if (!_authHeader?.startsWith("Bearer ")) return json({ allowed: false, error: "Unauthorized" }, 401);
  const _u = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: _authHeader } } });
  const { data: _c, error: _e } = await _u.auth.getClaims(_authHeader.replace("Bearer ", ""));
  if (_e || !_c?.claims) return json({ allowed: false, error: "Unauthorized" }, 401);
  try {
    const { userId, platforms = [] } = await req.json();
    if (!userId) return json({ allowed: false, error: "userId required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: sub } = await supabase
      .from("zcreator_subscriptions").select("*").eq("user_id", userId).maybeSingle();

    const tier = (sub?.tier ?? "free") as keyof typeof TIER_LIMITS;
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    const limit = sub?.videos_per_month ?? limits.videos;
    const used = sub?.videos_used_this_month ?? 0;

    if (used >= limit) {
      return json({
        allowed: false,
        reason: "monthly_limit_reached",
        tier, used, limit,
        upgradeUrl: "/creator-studio/subscription",
        message: `Creator Studio monthly limit reached (${used}/${limit}). Upgrade to continue.`,
      });
    }

    if (Array.isArray(platforms) && platforms.length) {
      const blocked = platforms.filter((p: string) => !limits.platforms.includes(p));
      if (blocked.length) {
        return json({
          allowed: false,
          reason: "platform_not_in_tier",
          tier, blocked,
          upgradeUrl: "/creator-studio/subscription",
          message: `Your Creator Studio plan doesn't include: ${blocked.join(", ")}. Upgrade to unlock.`,
        });
      }
    }

    return json({ allowed: true, tier, used, limit, remaining: limit - used });
  } catch (e: any) {
    console.error("check-limits error", e);
    return json({ allowed: false, error: e?.message ?? "Unknown error" }, 500);
  }
});
