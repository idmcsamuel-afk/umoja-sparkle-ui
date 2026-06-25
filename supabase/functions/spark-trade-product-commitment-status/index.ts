import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const opportunityId = url.pathname.split("/").pop();

    if (!opportunityId || isNaN(Number(opportunityId))) {
      return new Response(
        JSON.stringify({ error: "Invalid opportunity_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const oppId = Number(opportunityId);

    const { data, error } = await supabase
      .from("v_product_commitment_status")
      .select("*")
      .eq("opportunity_id", oppId)
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Product not found or no commitments yet", details: error?.message ?? null }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The view lacks `category` — fetch it separately.
    const { data: opp } = await supabase
      .from("spark_trade_opportunities")
      .select("category")
      .eq("id", oppId)
      .maybeSingle();

    const totalUnitsCommitted = Number((data as any).total_units) || 0;
    const moq = Number((data as any).moq_required) || 0;
    const progress = Number((data as any).progress_percent) || 0;
    const status = (data as any).status || "FORMING";

    return new Response(
      JSON.stringify({
        success: true,
        opportunity_id: (data as any).opportunity_id,
        product_name: (data as any).product_name,
        category: (opp as any)?.category ?? null,
        members_committed: Number((data as any).members_committed) || 0,
        total_units_committed: totalUnitsCommitted,
        moq_required: moq,
        progress_percent: progress,
        status,
        progress_label: `${totalUnitsCommitted}/${moq} units (${progress}%)`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
