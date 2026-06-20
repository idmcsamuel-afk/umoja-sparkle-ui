import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const COUNTRY_MAP: Record<string, { country: string; currency: string; marketplaces: string[] }> = {
  SA: { country: "SA", currency: "ZAR", marketplaces: ["Takealot", "Makro", "Amazon.sa"] },
  NG: { country: "Nigeria", currency: "NGN", marketplaces: ["Jumia"] },
  KE: { country: "Kenya", currency: "KES", marketplaces: ["Jumia Kenya"] },
  ZW: { country: "Zimbabwe", currency: "ZWL", marketplaces: [] },
  ZM: { country: "Zambia", currency: "ZMW", marketplaces: [] },
  MZ: { country: "Mozambique", currency: "MZN", marketplaces: [] },
};

const COUNTRY_TO_CODE: Record<string, string> = {
  SA: "SA",
  Nigeria: "NG",
  Kenya: "KE",
  Zimbabwe: "ZW",
  Zambia: "ZM",
  Mozambique: "MZ",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub;

    // Always derive country from authenticated user, ignore tampered query param
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("country, country_code, currency_code, marketplace_preference")
      .eq("id", userId)
      .maybeSingle();

    if (memberError) {
      console.error("member lookup failed", memberError);
      return json({ success: false, error: "Database error" }, 500);
    }
    if (!member) return json({ success: false, error: "Member not found" }, 404);

    const code = (member.country_code as string) || COUNTRY_TO_CODE[member.country as string] || "SA";
    const profile = COUNTRY_MAP[code];
    if (!profile) return json({ success: false, error: "Country not supported yet" }, 400);

    const userMarketplaces = Array.isArray(member.marketplace_preference)
      ? (member.marketplace_preference as string[])
      : profile.marketplaces;

    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
    const tierFilter = url.searchParams.get("tier_filter");
    const categoryFilter = url.searchParams.get("category_filter");

    // No marketplaces configured (Zimbabwe, Zambia, Mozambique)
    if (userMarketplaces.length === 0) {
      return json({
        success: true,
        country: profile.country,
        currency: profile.currency,
        marketplaces: [],
        total_products: 0,
        page: { limit, offset, returned: 0 },
        products: [],
        message: `Coming soon to ${profile.country}`,
      });
    }

    let countQuery = supabase
      .from("product_feeds")
      .select("id", { count: "exact", head: true })
      .eq("country", profile.country)
      .in("local_marketplace", userMarketplaces);

    const allowedTiers = tierFilter && ["BUY_NOW", "BUY_SOON"].includes(tierFilter)
      ? [tierFilter]
      : ["BUY_NOW", "BUY_SOON"];
    countQuery = countQuery.in("tier", allowedTiers);
    if (categoryFilter) countQuery = countQuery.eq("category", categoryFilter);

    const { count, error: countError } = await countQuery;
    if (countError) {
      console.error("count failed", countError);
      return json({ success: false, error: "Database error" }, 500);
    }

    let query = supabase
      .from("product_feeds")
      .select(
        "id, product_name, category, supplier_cost, local_retail_price, local_marketplace, local_search_volume, local_competition_count, trend_direction, trend_percentage, ai_score, ai_confidence, tier, recommendation, moq, stock_available, image_url, monthly_search_volume",
      )
      .eq("country", profile.country)
      .in("local_marketplace", userMarketplaces)
      .in("tier", allowedTiers);
    if (categoryFilter) query = query.eq("category", categoryFilter);
    query = query
      .order("ai_score", { ascending: false })
      .order("trend_percentage", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: rows, error: rowsError } = await query;
    if (rowsError) {
      console.error("products fetch failed", rowsError);
      return json({ success: false, error: "Database error" }, 500);
    }

    const products = (rows ?? []).map((r: any) => {
      const cost = Number(r.supplier_cost ?? 0);
      const retail = Number(r.local_retail_price ?? 0);
      const profit = retail - cost;
      const margin = cost > 0 ? (profit / cost) * 100 : 0;
      return {
        product_id: r.id,
        id: r.id,
        name: r.product_name,
        category: r.category,
        cost,
        retail_price: retail,
        marketplace: r.local_marketplace,
        search_volume: r.local_search_volume,
        competitors: r.local_competition_count,
        trend: r.trend_direction,
        trend_direction: r.trend_direction,
        trend_percent: Number(r.trend_percentage ?? 0),
        ai_score: r.ai_score,
        confidence: Number(r.ai_confidence ?? 0),
        tier: r.tier,
        profit_per_unit: Math.round(profit * 100) / 100,
        margin_percent: Math.round(margin * 100) / 100,
        margin_percentage: Math.round(margin * 100) / 100,
        recommendation: r.recommendation,
        moq: r.moq ?? 0,
        stock_available: r.stock_available ?? 0,
        image_url: r.image_url ?? null,
        monthly_search_volume: r.monthly_search_volume ?? r.local_search_volume ?? 0,
        competitor_count: r.local_competition_count ?? 0,
      };
    });

    return json({
      success: true,
      country: profile.country,
      currency: profile.currency,
      marketplaces: userMarketplaces,
      total_products: count ?? products.length,
      page: { limit, offset, returned: products.length },
      products,
      ...(products.length === 0 ? { message: `No products for ${profile.country} yet` } : {}),
    });
  } catch (e) {
    console.error("get-localized-products error", e);
    return json({ success: false, error: "Database error" }, 500);
  }
});
