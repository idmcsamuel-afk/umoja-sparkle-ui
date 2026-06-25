import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const rawId = parts[parts.length - 1];
    const opportunityId = Number(rawId);

    if (!opportunityId || Number.isNaN(opportunityId)) {
      return new Response(
        JSON.stringify({ error: "Valid opportunityId required in URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("v_product_commitment_status")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return new Response(
        JSON.stringify({ error: "Opportunity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        opportunity_id: data.opportunity_id,
        product_name: data.product_name,
        members_committed: Number(data.members_committed) || 0,
        total_units: Number(data.total_units) || 0,
        moq_required: Number(data.moq_required) || 0,
        progress_percent: Number(data.progress_percent) || 0,
        total_capital: Number(data.total_capital) || 0,
        status: data.status,
        last_activity_at: data.last_activity_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
