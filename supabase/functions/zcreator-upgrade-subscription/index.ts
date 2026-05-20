import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TIERS: Record<string, {
  videosPerMonth: number; platforms: string[]; rands: number; sparks: number;
  autoPublish: boolean; whiteLabel: boolean;
}> = {
  free:    { videosPerMonth: 2,    platforms: ["youtube"], rands: 0,    sparks: 0,     autoPublish: false, whiteLabel: false },
  creator: { videosPerMonth: 150,  platforms: ["youtube","tiktok","instagram"], rands: 400,  sparks: 4000,  autoPublish: true,  whiteLabel: false },
  pro:     { videosPerMonth: 400,  platforms: ["youtube","tiktok","instagram"], rands: 800,  sparks: 8000,  autoPublish: true,  whiteLabel: false },
  agency:  { videosPerMonth: 1000, platforms: ["youtube","tiktok","instagram"], rands: 1600, sparks: 16000, autoPublish: true,  whiteLabel: true },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON         = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const { tier, paymentMethod, paystackReference } = body as {
      tier: string; paymentMethod: "sparks" | "paystack"; paystackReference?: string;
    };
    const cfg = TIERS[tier];
    if (!cfg || tier === "free") return json({ error: "Invalid tier" }, 400);
    if (!["sparks","paystack"].includes(paymentMethod)) return json({ error: "Invalid paymentMethod" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify payment
    if (paymentMethod === "sparks") {
      const { data: newBal, error: spErr } = await admin.rpc("adjust_spark_balance", {
        _member: userId,
        _delta: -cfg.sparks,
        _note: `Creator Studio ${tier} upgrade`,
      });
      if (spErr) return json({ error: `Sparks deduction failed: ${spErr.message}` }, 400);
      if (typeof newBal === "number" && newBal < 0) return json({ error: "Insufficient Sparks" }, 400);
    } else {
      if (!paystackReference) return json({ error: "Missing paystackReference" }, 400);
      const psKey = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (!psKey) return json({ error: "Paystack not configured" }, 500);
      const vr = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(paystackReference)}`, {
        headers: { Authorization: `Bearer ${psKey}` },
      });
      const vj = await vr.json().catch(() => ({}));
      const ok = vr.ok && vj?.data?.status === "success" && vj?.data?.amount >= cfg.rands * 100;
      if (!ok) return json({ error: "Payment verification failed" }, 400);
    }

    // Upsert subscription
    const now = new Date().toISOString();
    const { error: upErr } = await admin.from("zcreator_subscriptions").upsert({
      user_id: userId,
      tier,
      videos_per_month: cfg.videosPerMonth,
      platforms_enabled: cfg.platforms,
      auto_publish_enabled: cfg.autoPublish,
      white_label_enabled: cfg.whiteLabel,
      monthly_cost_rands: cfg.rands,
      monthly_cost_sparks: cfg.sparks,
      videos_used_this_month: 0,
      billing_cycle_starts_at: now,
      active: true,
    }, { onConflict: "user_id" });
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ success: true, tier });
  } catch (e: any) {
    console.error("upgrade error", e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
