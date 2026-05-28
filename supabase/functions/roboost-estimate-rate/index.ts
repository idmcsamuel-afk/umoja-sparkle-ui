import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  origin_zone: z.string().trim().min(1).max(120),
  weight_kg: z.number().min(0.01).max(1000).default(0.5),
  quantity: z.number().int().min(1).max(10000).default(50),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ROBOOST_KEY = Deno.env.get("ROBOOST_API_KEY");
  if (!ROBOOST_KEY) {
    return new Response(JSON.stringify({ error: "ROBOOST_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const r = await fetch("https://api.roboost.ai/v1/shipments/estimate-rate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ROBOOST_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
    });
    const text = await r.text();
    let upstream: unknown;
    try { upstream = JSON.parse(text); } catch { upstream = { raw: text }; }

    if (!r.ok) {
      // Roboost unreachable / not provisioned — return a deterministic fallback so the UI can render.
      const fallback = {
        total_per_unit: 19,
        base_rate: 12,
        weight_surcharge: 5,
        handling_fee: 2,
        currency: "ZAR",
        zone: parsed.data.origin_zone,
        fallback: true,
        upstream_status: r.status,
      };
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(upstream), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[roboost-estimate-rate] error", e);
    return new Response(JSON.stringify({
      total_per_unit: 19, base_rate: 12, weight_surcharge: 5, handling_fee: 2,
      currency: "ZAR", zone: parsed.data.origin_zone, fallback: true,
      error: (e as Error).message,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
