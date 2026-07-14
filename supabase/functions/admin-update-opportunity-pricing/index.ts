import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Locked margin engine — must mirror the approval form.
// buffer → freight → commission for BOTH sea and air.
// Sea freight default: weight-estimate (weight_kg / density) * rate_per_cbm.
// Real per-item CBM only used when verified (not junk placeholder dimensions).
export const DEFAULT_SEA_RATE_PER_CBM = 8800;
export const DEFAULT_SEA_DENSITY_KG_PER_CBM = 200; // ≈ R44/kg default
const MIN_PLAUSIBLE_DENSITY = 20;   // kg/CBM — below this = junk dims (empty box)
const MAX_PLAUSIBLE_DENSITY = 2000; // kg/CBM — above this = junk dims (1×1×1cm etc.)

export function isPlausibleCbm(weight_kg: number, cbm_per_unit: number | null | undefined): boolean {
  if (!cbm_per_unit || cbm_per_unit <= 0) return false;
  if (!weight_kg || weight_kg <= 0) return false;
  const density = weight_kg / cbm_per_unit;
  return density >= MIN_PLAUSIBLE_DENSITY && density <= MAX_PLAUSIBLE_DENSITY;
}

function computePricing(input: {
  alibaba_cost_zar: number;
  weight_kg: number;
  freight_sea_override?: number | null;
  freight_air_override?: number | null;
  buffer_pct: number;
  commission_pct: number;
  suggested_selling_price_zar: number;
  air_available?: boolean;
  freight_rate_per_cbm?: number | null;
  freight_density_kg_per_cbm?: number | null;
  cbm_per_unit?: number | null;
}) {
  const alibaba = Number(input.alibaba_cost_zar) || 0;
  const weight = Number(input.weight_kg) || 0;
  const buffer = Number(input.buffer_pct) || 0;
  const commission = Number(input.commission_pct) || 0;
  const sell = Number(input.suggested_selling_price_zar) || 0;
  const ratePerCbm = Number(input.freight_rate_per_cbm) > 0 ? Number(input.freight_rate_per_cbm) : DEFAULT_SEA_RATE_PER_CBM;
  const densityKgPerCbm = Number(input.freight_density_kg_per_cbm) > 0 ? Number(input.freight_density_kg_per_cbm) : DEFAULT_SEA_DENSITY_KG_PER_CBM;
  const cbmPerUnit = input.cbm_per_unit != null ? Number(input.cbm_per_unit) : null;

  const adjusted = alibaba * (1 + buffer / 100);

  // Sea freight logic:
  // 1. Manual override wins.
  // 2. Real CBM (if plausible) → CBM × rate.
  // 3. Fallback → weight-estimate (weight / density) × rate.
  const seaOverride = input.freight_sea_override;
  const hasSeaOverride = seaOverride != null && !Number.isNaN(Number(seaOverride)) && Number(seaOverride) > 0;
  const cbmIsPlausible = isPlausibleCbm(weight, cbmPerUnit);
  const dimensionsFlagged = cbmPerUnit != null && cbmPerUnit > 0 && !cbmIsPlausible;
  const usesWeightEstimate = !hasSeaOverride && !cbmIsPlausible;

  let freight_sea_zar: number;
  if (hasSeaOverride) {
    freight_sea_zar = Number(seaOverride);
  } else if (cbmIsPlausible) {
    freight_sea_zar = (cbmPerUnit as number) * ratePerCbm;
  } else {
    freight_sea_zar = (weight / densityKgPerCbm) * ratePerCbm;
  }

  const commission_sea = (adjusted + freight_sea_zar) * (commission / 100);
  const landed_sea = adjusted + freight_sea_zar + commission_sea;
  const margin_sea = sell - landed_sea;
  const margin_sea_pct = sell > 0 ? (margin_sea / sell) * 100 : 0;

  // Air: override-only. If missing/zero, air unavailable.
  const airOverride = input.freight_air_override;
  const hasAirOverride = airOverride != null && !Number.isNaN(Number(airOverride)) && Number(airOverride) > 0;
  const air_available = input.air_available !== false && hasAirOverride;
  const freight_air_zar = hasAirOverride ? Number(airOverride) : 0;
  const commission_air = (adjusted + freight_air_zar) * (commission / 100);
  const landed_air = adjusted + freight_air_zar + commission_air;
  const margin_air = sell - landed_air;
  const margin_air_pct = sell > 0 ? (margin_air / sell) * 100 : 0;

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    freight_sea_zar: r2(freight_sea_zar),
    landed_cost_sea_zar: r2(landed_sea),
    gross_margin_sea_zar: r2(margin_sea),
    margin_sea_pct: r2(margin_sea_pct),
    freight_air_zar: air_available ? r2(freight_air_zar) : 0,
    landed_cost_air_zar: air_available ? r2(landed_air) : 0,
    gross_margin_air_zar: air_available ? r2(margin_air) : 0,
    margin_air_pct: air_available ? r2(margin_air_pct) : 0,
    air_available,
    freight_cost_zar: r2(freight_sea_zar),
    umoja_commission_zar: r2(commission_sea),
    landed_cost_zar: r2(landed_sea),
    gross_margin_zar: r2(margin_sea),
    expected_margin_percentage: r2(margin_sea_pct),
    unit_cost_zar: r2(landed_sea),
    freight_is_override: hasSeaOverride,
    freight_uses_weight_estimate: usesWeightEstimate,
    dimensions_flagged: dimensionsFlagged,
    freight_rate_per_cbm: ratePerCbm,
    freight_density_kg_per_cbm: densityKgPerCbm,
    cbm_per_unit: cbmPerUnit,
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

    // Accept both new fields (freight_sea_override / freight_air_override) and
    // the legacy `freight_override` (treated as sea) for backward compat.
    const legacyOverride = body.freight_override;
    const seaOverrideRaw = body.freight_sea_override !== undefined
      ? body.freight_sea_override
      : legacyOverride;
    const airOverrideRaw = body.freight_air_override;

    const computed = computePricing({
      alibaba_cost_zar: Number(body.alibaba_cost_zar) || 0,
      weight_kg: Number(body.weight_kg) || 0,
      freight_sea_override: seaOverrideRaw === "" || seaOverrideRaw == null ? null : Number(seaOverrideRaw),
      freight_air_override: airOverrideRaw === "" || airOverrideRaw == null ? null : Number(airOverrideRaw),
      buffer_pct: Number(body.buffer_pct) || 0,
      commission_pct: Number(body.commission_pct) || 0,
      suggested_selling_price_zar: Number(body.suggested_selling_price_zar) || 0,
      air_available: body.air_available !== false,
    });

    const memberMinRaw = body.member_min_buyin_zar;
    const memberMinNum = memberMinRaw === "" || memberMinRaw == null ? null : Number(memberMinRaw);

    const updatePayload: Record<string, unknown> = {
      alibaba_cost_zar: Number(body.alibaba_cost_zar) || 0,
      weight_kg: Number(body.weight_kg) || 0,
      buffer_pct: Number(body.buffer_pct) || 0,
      commission_pct: Number(body.commission_pct) || 0,
      suggested_selling_price_zar: Number(body.suggested_selling_price_zar) || 0,
      moq_required: body.moq_required != null ? Number(body.moq_required) : undefined,
      member_min_buyin_zar: memberMinRaw !== undefined
        ? (memberMinNum != null && !Number.isNaN(memberMinNum) ? memberMinNum : null)
        : undefined,
      supplier_name: body.supplier_name ?? undefined,
      ...computed,
      updated_at: new Date().toISOString(),
    };
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
