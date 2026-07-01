import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Realistic entry quantity for capital-fit scoring (fraction of MOQ a member commits to)
const ENTRY_QTY_FRACTION = 0.10; // 10% of MOQ as a group-buy participation stake
const MIN_ENTRY_QTY = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const callerId = userData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const memberId: string = body?.memberId ?? callerId;
    const force: boolean = !!body?.force;

    if (memberId !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!force) {
      const { data: cached } = await admin
        .from("spark_trade_blueprints")
        .select("blueprint_json")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached?.blueprint_json) {
        return new Response(JSON.stringify(cached.blueprint_json), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: member, error: memberErr } = await admin
      .from("members")
      .select(
        "spark_trade_income_goal, spark_trade_capital, spark_trade_business_type, spark_trade_service_area, spark_trade_stock_preference, spark_trade_group_buy_interest, country_code"
      )
      .eq("id", memberId)
      .maybeSingle();
    if (memberErr || !member) {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull ONLY the real curated spotlight catalog
    const { data: catalog, error: catErr } = await admin
      .from("spark_trade_opportunities")
      .select(
        "id, product_name, category, moq_required, unit_cost_zar, landed_cost_zar, landed_cost_sea_zar, landed_cost_air_zar, suggested_selling_price_zar, product_image_url, gross_margin_sea_zar, gross_margin_air_zar, margin_sea_pct, margin_air_pct, air_available, expected_margin_percentage"
      )
      .eq("is_spotlight", true)
      .order("spotlight_rank", { ascending: true });

    if (catErr || !catalog || catalog.length === 0) {
      return new Response(
        JSON.stringify({ error: "No curated catalog available yet" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const capital = Number((member as any).spark_trade_capital) || 0;
    const incomeGoal = Number((member as any).spark_trade_income_goal) || 0;

    // Capital-fit: compute entry cost per product using realistic entry quantity
    type Scored = {
      row: typeof catalog[number];
      entryQty: number;
      entryCost: number;
      fits: boolean;
    };
    const scored: Scored[] = catalog.map((row: any) => {
      const moq = Number(row.moq_required) || 0;
      const landed =
        Number(row.landed_cost_sea_zar) ||
        Number(row.landed_cost_zar) ||
        Number(row.unit_cost_zar) ||
        0;
      const entryQty = Math.max(MIN_ENTRY_QTY, Math.ceil(moq * ENTRY_QTY_FRACTION));
      const entryCost = entryQty * landed;
      const fits = capital > 0 ? entryCost <= capital : true;
      return { row, entryQty, entryCost, fits };
    });

    // Prefer fitting products; if none fit, fall back to cheapest entry cost
    let pool = scored.filter((s) => s.fits);
    if (pool.length === 0) pool = [...scored].sort((a, b) => a.entryCost - b.entryCost);

    // Pick top 5 (or all if fewer), sorted by best sea margin % descending
    const picks = pool
      .sort(
        (a, b) =>
          (Number((b.row as any).margin_sea_pct) || 0) -
          (Number((a.row as any).margin_sea_pct) || 0)
      )
      .slice(0, 5);

    const recommended_products = picks.map((s) => {
      const r: any = s.row;
      return {
        opportunity_id: r.id,
        name: r.product_name,
        category: r.category,
        image_url: r.product_image_url,
        moq: r.moq_required,
        recommended_entry_qty: s.entryQty,
        recommended_entry_cost_zar: Math.round(s.entryCost),
        unit_cost_zar: Number(r.landed_cost_sea_zar) || Number(r.landed_cost_zar) || Number(r.unit_cost_zar),
        suggested_selling_price_zar: Number(r.suggested_selling_price_zar) || null,
        margin_sea_pct: Number(r.margin_sea_pct) || null,
        margin_air_pct: Number(r.margin_air_pct) || null,
        gross_margin_sea_zar: Number(r.gross_margin_sea_zar) || null,
        gross_margin_air_zar: Number(r.gross_margin_air_zar) || null,
        air_available: !!r.air_available,
        fits_capital: s.fits,
      };
    });

    // Aggregate blueprint stats from real numbers
    const totalStartup = recommended_products.reduce(
      (sum, p) => sum + (p.recommended_entry_cost_zar || 0),
      0
    );
    const avgMarginPct =
      recommended_products.length > 0
        ? recommended_products.reduce((s, p) => s + (Number(p.margin_sea_pct) || 0), 0) /
          recommended_products.length
        : 0;
    const estimatedMonthlyRevenue = recommended_products.reduce((sum, p) => {
      const price = Number(p.suggested_selling_price_zar) || 0;
      return sum + price * (p.recommended_entry_qty || 0);
    }, 0);

    const bizType = (member as any).spark_trade_business_type || "micro-wholesale";
    const businessName = `${String(bizType).split(/\s+/)[0] || "Umoja"} Trader`;

    const blueprint = {
      recommended_business_name: businessName,
      recommended_products,
      estimated_startup_capital: Math.round(totalStartup),
      estimated_monthly_revenue: Math.round(estimatedMonthlyRevenue),
      estimated_gross_margin: `${Math.round(avgMarginPct)}%`,
      overall_moq_fill_percentage: null,
      estimated_launch_timeline_days: 42,
      confidence_score: capital > 0 && picks.every((p) => p.fits) ? 90 : 70,
      capital_input_zar: capital,
      income_goal_zar: incomeGoal,
      catalog_source: "spark_trade_opportunities.is_spotlight",
    };

    const grossMarginInt = Math.round(avgMarginPct) || null;

    const { error: insertErr } = await admin.from("spark_trade_blueprints").insert({
      member_id: memberId,
      income_goal: incomeGoal || null,
      recommended_business_name: blueprint.recommended_business_name,
      recommended_products: blueprint.recommended_products,
      estimated_startup_capital: blueprint.estimated_startup_capital,
      estimated_monthly_revenue: blueprint.estimated_monthly_revenue,
      estimated_gross_margin: grossMarginInt,
      overall_moq_fill_percentage: blueprint.overall_moq_fill_percentage,
      estimated_launch_timeline_days: blueprint.estimated_launch_timeline_days,
      confidence_score: blueprint.confidence_score,
      blueprint_json: blueprint,
    });

    if (insertErr) console.error("[blueprint] DB insert failed", insertErr);

    return new Response(JSON.stringify(blueprint), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[blueprint] unexpected error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
