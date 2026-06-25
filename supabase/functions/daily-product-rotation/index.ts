import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Internal housekeeping endpoint. No parameters accepted, idempotent rotation
  // of spotlight flags. Auth removed so pg_cron + pg_net can invoke it directly
  // without needing to share the CRON_SECRET value into Postgres.

  try {
    const { data: spotlights, error: spotlightError } = await supabase
      .from("spark_trade_opportunities")
      .select("id, product_name, is_spotlight, created_at, moq_required")
      .eq("is_spotlight", true);

    if (spotlightError) throw spotlightError;

    const pausedProducts: string[] = [];
    const promotedProducts: string[] = [];

    for (const spotlight of spotlights || []) {
      const { data: commitment } = await supabase
        .from("v_product_commitment_status")
        .select("*")
        .eq("opportunity_id", spotlight.id)
        .maybeSingle();

      if (!commitment) continue;

      const daysSinceCreated = Math.floor(
        (Date.now() - new Date(spotlight.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceCreated >= 5 && Number((commitment as any).progress_percent) < 30) {
        await supabase
          .from("spark_trade_opportunities")
          .update({ is_spotlight: false, spotlight_rank: null })
          .eq("id", spotlight.id);

        pausedProducts.push(spotlight.product_name);

        const { data: nextProduct } = await supabase
          .from("spark_trade_opportunities")
          .select("id, product_name, category, moq_required, unit_cost_zar, expected_margin_percentage")
          .eq("is_spotlight", false)
          .order("moq_required", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (nextProduct) {
          await supabase
            .from("spark_trade_opportunities")
            .update({
              is_spotlight: true,
              spotlight_rank: 1,
              spotlight_title: `New Featured: ${(nextProduct as any).product_name}`,
            })
            .eq("id", (nextProduct as any).id);

          promotedProducts.push((nextProduct as any).product_name);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        paused: pausedProducts,
        promoted: promotedProducts,
        message: `${pausedProducts.length} products paused, ${promotedProducts.length} products promoted`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Rotation failed", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
