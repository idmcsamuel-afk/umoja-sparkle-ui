// Returns current ZAR -> USD rate (1 USD = X ZAR). Cached upstream by client (10 min).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Free, no key: exchangerate.host
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=ZAR");
    const j = await r.json();
    const zarPerUsd = Number(j?.rates?.ZAR);
    if (!zarPerUsd || !Number.isFinite(zarPerUsd) || zarPerUsd <= 0) {
      throw new Error("invalid_rate");
    }
    return new Response(
      JSON.stringify({ zar_per_usd: zarPerUsd, usd_per_zar: 1 / zarPerUsd, source: "exchangerate.host", ts: Date.now() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e), zar_per_usd: 18.5, usd_per_zar: 1 / 18.5, source: "fallback" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
