import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const STALL_DAYS = 5;
const STALL_PROGRESS_THRESHOLD = 30; // percent

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const paused: number[] = [];
  const promoted: number[] = [];

  try {
    // Active spotlight opportunities
    const { data: spotlights, error: spotErr } = await supabase
      .from("spark_trade_opportunities")
      .select("id, product_name, spotlight_rank, created_at")
      .eq("is_spotlight", true);
    if (spotErr) throw spotErr;

    const cutoff = new Date(Date.now() - STALL_DAYS * 86400_000).toISOString();

    for (const opp of spotlights ?? []) {
      const { data: status } = await supabase
        .from("v_product_commitment_status")
        .select("progress_percent, last_activity_at")
        .eq("opportunity_id", opp.id)
        .maybeSingle();

      const progress = Number(status?.progress_percent ?? 0);
      const lastActivity = status?.last_activity_at ?? opp.created_at;
      const isStalled = (!lastActivity || lastActivity < cutoff) && progress < STALL_PROGRESS_THRESHOLD;

      if (isStalled) {
        const { error: pauseErr } = await supabase
          .from("spark_trade_opportunities")
          .update({ is_spotlight: false, spotlight_rank: null, group_buy_status: "paused" })
          .eq("id", opp.id);
        if (!pauseErr) paused.push(opp.id);
      }
    }

    // Promote next candidates to keep spotlight filled (top 10)
    if (paused.length > 0) {
      const { data: candidates } = await supabase
        .from("spark_trade_opportunities")
        .select("id, product_name")
        .eq("is_spotlight", false)
        .neq("group_buy_status", "paused")
        .order("created_at", { ascending: false })
        .limit(paused.length);

      let rank = 1;
      for (const cand of candidates ?? []) {
        const { error: promoErr } = await supabase
          .from("spark_trade_opportunities")
          .update({
            is_spotlight: true,
            spotlight_rank: rank,
            spotlight_title: cand.product_name,
          })
          .eq("id", cand.id);
        if (!promoErr) promoted.push(cand.id);
        rank++;
      }
    }

    return new Response(
      JSON.stringify({
        ran_at: new Date().toISOString(),
        paused_count: paused.length,
        promoted_count: promoted.length,
        paused,
        promoted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message, paused, promoted }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
