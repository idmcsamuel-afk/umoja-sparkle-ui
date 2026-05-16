// Flame Graphics — DALL·E 3 image generation
// Free tier: 3 graphics / week (resets Monday UTC)
// Buyers Club Pro / Fulfilled / Gold: unlimited
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const WEEKLY_LIMIT = 3;
const VALID_SIZES = new Set(["1024x1024", "1024x1792", "1792x1024"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supa.auth.getUser();
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "service_unavailable" }, 500);

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt ?? "").trim();
    const size = String(body?.size ?? "1024x1024");
    const style = body?.style === "vivid" ? "vivid" : "natural";
    const template = String(body?.template ?? "custom").slice(0, 64);
    const styleLabel = body?.style_label ? String(body.style_label).slice(0, 64) : null;

    if (prompt.length < 5 || prompt.length > 1500) {
      return json({ error: "prompt must be 5–1500 characters" }, 400);
    }
    if (!VALID_SIZES.has(size)) {
      return json({ error: "invalid size" }, 400);
    }

    // Tier check — Buyers Club Pro/Fulfilled/Gold bypass the limit
    const { data: member } = await supa
      .from("members")
      .select("buyers_club_tier, buyers_club_status")
      .eq("id", user.id)
      .maybeSingle();

    const tier = member?.buyers_club_tier ?? null;
    const status = member?.buyers_club_status ?? null;
    const hasFlamePro =
      ((tier === "pro" || tier === "fulfilled") && status === "active") ||
      tier === "gold";

    let used = 0;
    if (!hasFlamePro) {
      const { data: countData, error: countErr } = await supa.rpc("flame_graphics_count_week");
      if (countErr) console.error("[generate-graphics] count error:", countErr);
      used = typeof countData === "number" ? countData : 0;
      if (used >= WEEKLY_LIMIT) {
        return json({
          error: "weekly_limit_reached",
          message: "Weekly limit reached (3/3). Upgrade to Buyers Club Pro for unlimited graphics.",
          used,
          limit: WEEKLY_LIMIT,
          upgrade_url: "/spark",
        }, 429);
      }
    }

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        quality: "standard",
        style,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[generate-graphics] openai error:", res.status, JSON.stringify(data).slice(0, 500));
      const msg = data?.error?.message ?? "image_generation_failed";
      return json({ error: msg }, 502);
    }

    const image_url: string = data?.data?.[0]?.url ?? "";
    const revised_prompt: string = data?.data?.[0]?.revised_prompt ?? "";

    // Record usage (best-effort)
    await supa.from("flame_graphics_usage").insert({
      member_id: user.id,
      template,
      size,
      style: styleLabel,
      prompt,
      revised_prompt,
      image_url,
    });

    return json({
      image_url,
      revised_prompt,
      used: hasFlamePro ? 0 : used + 1,
      limit: hasFlamePro ? null : WEEKLY_LIMIT,
      remaining: hasFlamePro ? null : WEEKLY_LIMIT - (used + 1),
      unlimited: hasFlamePro,
    });
  } catch (e) {
    console.error("[generate-graphics] server error:", e);
    return json({ error: "server_error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
