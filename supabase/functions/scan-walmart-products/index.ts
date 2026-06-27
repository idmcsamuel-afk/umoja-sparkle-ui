import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const DEFAULT_CATEGORIES = [
  "wireless earbuds",
  "power banks",
  "laptop stands",
  "usb cables",
  "phone cases",
  "keyboard mouse combo",
  "bluetooth speakers",
  "screen protectors",
  "led bulbs",
  "laptop cooling pads",
];

const RAINFOREST_KEY = Deno.env.get("RAINFOREST_API_KEY");
const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");

interface ScanResult {
  category: string;
  count: number;
  error?: string;
}

function classifyProfit(price: number | null, reviews: number, rank: number | null): string {
  if (!price) return "unknown";
  if (price >= 30 && reviews >= 500 && (rank ?? 999999) <= 5000) return "high";
  if (price >= 15 && reviews >= 100) return "medium";
  return "low";
}

// Rainforest's Walmart product data API uses host bluecart, not rainforest.
// https://www.bluecartapi.com/docs/product-data-api/overview
async function fetchWalmart(category: string): Promise<any[]> {
  if (!RAINFOREST_KEY) throw new Error("RAINFOREST_API_KEY not configured");
  const url = new URL("https://api.bluecartapi.com/request");
  url.searchParams.set("api_key", RAINFOREST_KEY);
  url.searchParams.set("type", "search");
  url.searchParams.set("search_term", category);
  url.searchParams.set("sort_by", "best_seller");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`BlueCart ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data.search_results) ? data.search_results : [];
}

async function fetchSerpTrends(category: string) {
  if (!SERPAPI_KEY) return { related: [], competition: "unknown", volume: null };
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", category);
    url.searchParams.set("api_key", SERPAPI_KEY);
    const res = await fetch(url.toString());
    if (!res.ok) return { related: [], competition: "unknown", volume: null };
    const data = await res.json();
    const related = (data.related_searches ?? []).map((r: any) => r.query).slice(0, 10);
    const adsCount = (data.ads ?? []).length;
    const competition = adsCount >= 4 ? "high" : adsCount >= 2 ? "medium" : "low";
    return { related, competition, volume: data.search_information?.total_results ?? null };
  } catch (e) {
    console.error("[SerpAPI] error", e);
    return { related: [], competition: "unknown", volume: null };
  }
}

async function scanCategory(
  supabase: ReturnType<typeof createClient>,
  category: string,
): Promise<ScanResult> {
  try {
    const raw = await fetchWalmart(category);
    const trends = await fetchSerpTrends(category);

    const products = raw
      .slice(0, 30)
      .map((p: any) => {
        const product = p.product ?? p;
        const itemId = product.item_id ?? product.us_item_id ?? p.item_id ?? null;
        const link = product.link ?? p.link ?? (itemId ? `https://www.walmart.com/ip/${itemId}` : null);
        return {
          item_id: itemId,
          title: product.title ?? p.title,
          rating: typeof product.rating === "number" ? product.rating : (typeof p.rating === "number" ? p.rating : null),
          review_count: typeof product.ratings_total === "number" ? product.ratings_total : (typeof p.ratings_total === "number" ? p.ratings_total : 0),
          price: product.price?.value ?? p.price?.value ?? p.offers?.primary?.price ?? null,
          monthly_rank: p.position ?? null,
          image_url: product.main_image ?? product.image ?? p.image ?? null,
          product_url: link,
        };
      })
      .filter((p: any) => p.item_id && p.title && (p.rating ?? 0) >= 4.0 && (p.review_count ?? 0) >= 50)
      .slice(0, 20);

    if (products.length === 0) {
      console.log(`[WALMART] 0 products for ${category}`);
      return { category, count: 0 };
    }

    const rows = products.map((p: any) => ({
      category,
      region: "US",
      asin: p.item_id, // reuse asin column as source_item_id
      title: p.title,
      rating: p.rating,
      review_count: p.review_count,
      price_usd: p.price,
      price_zar: null,
      monthly_rank: p.monthly_rank,
      seller_count: 1,
      search_volume: trends.volume,
      related_keywords: trends.related,
      competition_level: trends.competition,
      profit_potential: classifyProfit(p.price, p.review_count, p.monthly_rank),
      marketplace: "walmart_us",
      product_url: p.product_url,
      image_url: p.image_url,
    }));

    const { error } = await supabase
      .from("products")
      .upsert(rows, { onConflict: "asin,category,region" });
    if (error) throw error;

    console.log(`[WALMART] Found ${rows.length} products for ${category}`);
    return { category, count: rows.length };
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : (typeof e === "object" ? JSON.stringify(e) : String(e));
    console.error(`[WALMART] scan failed for ${category}: ${msg}`);
    return { category, count: 0, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
  }
  const url = new URL(req.url);
  const single = body.category ?? url.searchParams.get("category");
  const categories: string[] = single ? [single] : (body.categories ?? DEFAULT_CATEGORIES);

  const results: ScanResult[] = [];
  for (const cat of categories) {
    results.push(await scanCategory(supabase, cat));
  }

  const total = results.reduce((s, r) => s + r.count, 0);
  return new Response(
    JSON.stringify({ ok: true, total, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
