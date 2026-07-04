import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const COMMISSION_PCT = 8;
const DEFAULT_MIN_ITEM_BUYIN_ZAR = 400;
const DEFAULT_MIN_ORDER_TOTAL_ZAR = 2500;

const CAPITAL_BANDS = [2500, 5000, 10000, 20000];

function normalizeTier(raw?: string | null): "buyers_club" | "pro" | "fulfilled" {
  const t = String(raw ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  if (t.includes("fulfilled")) return "fulfilled";
  if (t.includes("pro")) return "pro";
  return "buyers_club";
}
function bufferPctForTier(t: string) {
  const n = normalizeTier(t);
  if (n === "fulfilled") return 0;
  if (n === "pro") return 5;
  return 10;
}
function productLimitForTier(t: string) {
  const n = normalizeTier(t);
  if (n === "fulfilled") return 20;
  if (n === "pro") return 10;
  return 6;
}
function tierLabel(t: string) {
  const n = normalizeTier(t);
  if (n === "fulfilled") return "Fulfilled by UMOJA";
  if (n === "pro") return "Pro Trader";
  return "Buyers Club";
}

function computeLanded(alibaba: number, freight: number, bufferPct: number) {
  if (alibaba <= 0) return 0;
  const adjusted = alibaba * (1 + bufferPct / 100);
  const base = adjusted + freight;
  const commission = base * (COMMISSION_PCT / 100);
  return base + commission;
}

type Opp = {
  id: string;
  product_name: string;
  category: string | null;
  product_image_url: string | null;
  moq_required: number | null;
  alibaba_cost_zar: number | null;
  freight_sea_zar: number | null;
  landed_cost_sea_zar: number | null;
  suggested_selling_price_zar: number | null;
  member_min_buyin_zar: number | null;
  margin_sea_pct: number | null;
};

type BasketItem = {
  opportunity_id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  member_moq_units: number;
  landed_cost_per_unit_zar: number;
  selling_price_zar: number;
  investment_zar: number;
  potential_profit_zar: number;
  margin_pct: number;
  factory_moq: number;
  members_needed: number;
};

function buildBasket(
  opps: Opp[],
  capital: number,
  bufferPct: number,
  productLimit: number,
  globalMinItem: number,
) {
  // Score each product for THIS tier
  const scored = opps
    .map((o) => {
      const alibaba = Number(o.alibaba_cost_zar) || 0;
      const freight = Number(o.freight_sea_zar) || 0;
      let landed = computeLanded(alibaba, freight, bufferPct);
      if (landed <= 0) landed = Number(o.landed_cost_sea_zar) || 0;
      const sell = Number(o.suggested_selling_price_zar) || 0;
      const perUnitProfit = sell > 0 && landed > 0 ? sell - landed : 0;
      const marginPct = sell > 0 && landed > 0 ? (perUnitProfit / sell) * 100 : 0;
      const floor =
        Number(o.member_min_buyin_zar) > 0
          ? Number(o.member_min_buyin_zar)
          : globalMinItem;
      const memberMoqUnits = landed > 0 ? Math.max(1, Math.ceil(floor / landed)) : 1;
      const investment = landed * memberMoqUnits;
      const potentialProfit = perUnitProfit * memberMoqUnits;
      const factoryMoq = Number(o.moq_required) || 0;
      const membersNeeded = factoryMoq > 0 ? Math.ceil(factoryMoq / memberMoqUnits) : 0;
      return {
        o,
        landed,
        sell,
        marginPct,
        memberMoqUnits,
        investment,
        potentialProfit,
        factoryMoq,
        membersNeeded,
      };
    })
    .filter((s) => s.landed > 0 && s.sell > 0 && s.marginPct > 0)
    // Prioritize: best margin, then lowest members-needed (most fillable)
    .sort((a, b) => {
      if (b.marginPct !== a.marginPct) return b.marginPct - a.marginPct;
      const an = a.membersNeeded || 9999;
      const bn = b.membersNeeded || 9999;
      return an - bn;
    });

  // Greedy fit within capital, up to productLimit
  const picks: typeof scored = [];
  let spent = 0;
  for (const s of scored) {
    if (picks.length >= productLimit) break;
    if (spent + s.investment <= capital) {
      picks.push(s);
      spent += s.investment;
    }
  }
  // If nothing fits (extreme edge), add the single cheapest so UI has something
  if (picks.length === 0 && scored.length > 0) {
    const cheapest = [...scored].sort((a, b) => a.investment - b.investment)[0];
    picks.push(cheapest);
    spent = cheapest.investment;
  }

  const items: BasketItem[] = picks.map((s) => ({
    opportunity_id: s.o.id,
    name: s.o.product_name,
    category: s.o.category,
    image_url: s.o.product_image_url,
    member_moq_units: s.memberMoqUnits,
    landed_cost_per_unit_zar: Math.round(s.landed),
    selling_price_zar: Math.round(s.sell),
    investment_zar: Math.round(s.investment),
    potential_profit_zar: Math.round(s.potentialProfit),
    margin_pct: Math.round(s.marginPct),
    factory_moq: s.factoryMoq,
    members_needed: s.membersNeeded,
  }));

  const totalInvestment = items.reduce((n, i) => n + i.investment_zar, 0);
  const totalPotentialProfit = items.reduce((n, i) => n + i.potential_profit_zar, 0);
  const blendedMarginPct =
    totalInvestment > 0
      ? Math.round((totalPotentialProfit / totalInvestment) * 100)
      : 0;

  return {
    items,
    total_investment_zar: totalInvestment,
    potential_gross_profit_zar: totalPotentialProfit,
    blended_margin_pct: blendedMarginPct,
    product_count: items.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized: no token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (userErr || !callerId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid session. Please sign in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const memberId: string = body?.memberId ?? callerId;
    if (memberId !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const capitalInput = Number(body?.capital);
    if (!capitalInput || capitalInput < DEFAULT_MIN_ORDER_TOTAL_ZAR) {
      return new Response(
        JSON.stringify({
          error: `capital is required and must be at least R${DEFAULT_MIN_ORDER_TOTAL_ZAR}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load member (for tier + goal + business type)
    const { data: member } = await admin
      .from("members")
      .select(
        "spark_trade_income_goal, spark_trade_business_type, spark_trade_subscription_tier, spark_trade_subscription_payment_status, buyers_club_tier, buyers_club_status",
      )
      .eq("id", memberId)
      .maybeSingle();

    const m: any = member ?? {};
    const stTier = m.spark_trade_subscription_tier as string | null;
    const stPaid = String(m.spark_trade_subscription_payment_status ?? "").toLowerCase() === "paid";
    const legacy = m.buyers_club_tier as string | null;
    const rawTier = stTier && stPaid ? stTier : legacy;
    const tier = normalizeTier(rawTier);
    const bufferPct = bufferPctForTier(tier);
    const productLimit = productLimitForTier(tier);

    // Persist capital on member (for reuse across the app)
    await admin.from("members").update({ spark_trade_capital: capitalInput }).eq("id", memberId);

    // Global floors (fallback to defaults)
    const { data: settings } = await admin
      .from("spark_trade_settings")
      .select("key, value")
      .in("key", ["min_item_buyin_zar"]);
    const settingsMap = new Map<string, number>();
    ((settings as any[]) ?? []).forEach((r) => settingsMap.set(r.key, Number(r.value)));
    const globalMinItem = settingsMap.get("min_item_buyin_zar") ?? DEFAULT_MIN_ITEM_BUYIN_ZAR;

    // Load curated live catalog
    const { data: catalog, error: catErr } = await admin
      .from("spark_trade_opportunities")
      .select(
        "id, product_name, category, product_image_url, moq_required, alibaba_cost_zar, freight_sea_zar, landed_cost_sea_zar, suggested_selling_price_zar, member_min_buyin_zar, margin_sea_pct",
      )
      .eq("is_spotlight", true)
      .order("spotlight_rank", { ascending: true });

    if (catErr || !catalog || catalog.length === 0) {
      return new Response(
        JSON.stringify({ error: "No live catalog available yet" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const currentBasket = buildBasket(
      catalog as Opp[],
      capitalInput,
      bufferPct,
      productLimit,
      globalMinItem,
    );

    // Next-band basket (Option B upsell)
    const nextBand = CAPITAL_BANDS.find((b) => b > capitalInput) ?? null;
    let nextBandInfo: any = null;
    if (nextBand) {
      const nb = buildBasket(catalog as Opp[], nextBand, bufferPct, productLimit, globalMinItem);
      nextBandInfo = {
        capital_zar: nextBand,
        product_count: nb.product_count,
        total_investment_zar: nb.total_investment_zar,
        potential_gross_profit_zar: nb.potential_gross_profit_zar,
        additional_products: Math.max(0, nb.product_count - currentBasket.product_count),
        additional_profit_zar: Math.max(
          0,
          nb.potential_gross_profit_zar - currentBasket.potential_gross_profit_zar,
        ),
      };
    }

    const bizType = m.spark_trade_business_type || "micro-wholesale";
    const businessName = `${String(bizType).split(/\s+/)[0] || "Umoja"} Trader`;

    const blueprint = {
      version: 2,
      recommended_business_name: businessName,
      tier,
      tier_label: tierLabel(tier),
      product_limit: productLimit,
      capital_zar: capitalInput,
      basket: currentBasket,
      next_band: nextBandInfo,
      estimated_first_stock: "~4-6 weeks (sea)",
      confidence_score: currentBasket.product_count >= Math.min(3, productLimit) ? 90 : 70,
      income_goal_zar: Number(m.spark_trade_income_goal) || 0,
    };

    // Cache (best-effort, ignore errors — schema flexible via blueprint_json)
    await admin.from("spark_trade_blueprints").insert({
      member_id: memberId,
      income_goal: blueprint.income_goal_zar || null,
      recommended_business_name: businessName,
      estimated_startup_capital: currentBasket.total_investment_zar,
      estimated_monthly_revenue: 0,
      estimated_gross_margin: currentBasket.blended_margin_pct || null,
      overall_moq_fill_percentage: null,
      estimated_launch_timeline_days: 42,
      confidence_score: blueprint.confidence_score,
      blueprint_json: blueprint,
    });

    return new Response(JSON.stringify(blueprint), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[blueprint] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
