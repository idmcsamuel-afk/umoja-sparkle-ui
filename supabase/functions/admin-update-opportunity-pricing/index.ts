import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Locked margin engine — must mirror the approval form.
function computePricing(input: {
  alibaba_cost_zar: number;
  weight_kg: number;
  freight_override?: number | null;
  buffer_pct: number;
  commission_pct: number;
  suggested_selling_price_zar: number;
}) {
  const alibaba = Number(input.alibaba_cost_zar) || 0;
  const weight = Number(input.weight_kg) || 0;
  const buffer = Number(input.buffer_pct) || 0;
  const commission = Number(input.commission_pct) || 0;
  const sell = Number(input.suggested_selling_price_zar) || 0;
  const isOverride = input.freight_override != null && !Number.isNaN(Number(input.freight_override));

  const adjusted_cost = alibaba * (1 + buffer / 100);
  const freight_cost_zar = isOverride
    ? Number(input.freight_override)
    : (weight / 167) * 8800;
  const umoja_commission_zar = (adjusted_cost + freight_cost_zar) * (commission / 100);
  const landed_cost_zar = adjusted_cost + freight_cost_zar + umoja_commission_zar;
  const gross_margin_zar = sell - landed_cost_zar;
  const expected_margin_percentage = sell > 0 ? (gross_margin_zar / sell) * 100 : 0;

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    freight_cost_zar: r2(freight_cost_zar),
    umoja_commission_zar: r2(umoja_commission_zar),
    landed_cost_zar: r2(landed_cost_zar),
    gross_margin_zar: r2(gross_margin_zar),
    expected_margin_percentage: r2(expected_margin_percentage),
    unit_cost_zar: r2(landed_cost_zar),
    freight_is_override: isOverride,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: isAdminRow } = await admin
      .from("admin_users").select("user_id").eq("user_id", adminId).maybeSingle();
    if (!isAdminRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const computed = computePricing({
      alibaba_cost_zar: Number(body.alibaba_cost_zar) || 0,
      weight_kg: Number(body.weight_kg) || 0,
      freight_override: body.freight_override === "" || body.freight_override == null
        ? null
        : Number(body.freight_override),
      buffer_pct: Number(body.buffer_pct) || 0,
      commission_pct: Number(body.commission_pct) || 0,
      suggested_selling_price_zar: Number(body.suggested_selling_price_zar) || 0,
    });

    const updatePayload: Record<string, unknown> = {
      alibaba_cost_zar: Number(body.alibaba_cost_zar) || 0,
      weight_kg: Number(body.weight_kg) || 0,
      buffer_pct: Number(body.buffer_pct) || 0,
      commission_pct: Number(body.commission_pct) || 0,
      suggested_selling_price_zar: Number(body.suggested_selling_price_zar) || 0,
      moq_required: body.moq_required != null ? Number(body.moq_required) : undefined,
      supplier_name: body.supplier_name ?? undefined,
      ...computed,
      updated_at: new Date().toISOString(),
    };
    // Strip undefined
    Object.keys(updatePayload).forEach((k) => updatePayload[k] === undefined && delete updatePayload[k]);

    const { data: updated, error: updErr } = await admin
      .from("spark_trade_opportunities")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updErr) {
      console.error("[admin-update-opportunity-pricing] update failed", updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, row: updated, computed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[admin-update-opportunity-pricing] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
