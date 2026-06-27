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
const CRON_SECRET = Deno.env.get("CRON_SECRET");

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

async function fetchRainforest(category: string, domain: string): Promise<{ results: any[]; domain: string }> {
  if (!RAINFOREST_KEY) throw new Error("RAINFOREST_API_KEY not configured");
  const url = new URL("https://api.rainforestapi.com/request");
  url.searchParams.set("api_key", RAINFOREST_KEY);
  url.searchParams.set("type", "search");
  url.searchParams.set("amazon_domain", domain);
  url.searchParams.set("search_term", category);
  url.searchParams.set("sort_by", "featured");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Rainforest ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { results: Array.isArray(data.search_results) ? data.search_results : [], domain };
}

function marketplaceFor(domain: string): string {
  if (domain.endsWith(".co.za")) return "amazon_sa";
  if (domain.endsWith(".co.uk")) return "amazon_uk";
  if (domain.endsWith(".de")) return "amazon_de";
  return "amazon_us";
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
  region: string,
  domain: string,
): Promise<ScanResult> {
  try {
    const { results: raw } = await fetchRainforest(category, domain);
    const marketplace = marketplaceFor(domain);
    const isZA = domain.endsWith(".co.za");
    const trends = await fetchSerpTrends(category);

    const products = raw
      .slice(0, 30)
      .map((p: any) => ({
        asin: p.asin,
        title: p.title,
        rating: typeof p.rating === "number" ? p.rating : null,
        review_count: typeof p.ratings_total === "number" ? p.ratings_total : 0,
        price: p.price?.value ?? null,
        monthly_rank: p.bestsellers_rank?.[0]?.rank ?? p.sales_rank ?? null,
        image_url: p.image ?? p.images?.[0] ?? null,
        product_url: p.link ?? (p.asin ? `https://www.${domain}/dp/${p.asin}` : null),
      }))
      .filter(
        (p: any) =>
          p.asin && p.title && (p.rating ?? 0) >= 4.0 && (p.review_count ?? 0) >= 50,
      )
      .slice(0, 20);

    if (products.length === 0) {
      console.log(`[PRODUCTS] Found 0 products in category ${category} (${marketplace})`);
      return { category, count: 0 };
    }

    const rows = products.map((p: any) => ({
      category,
      region,
      asin: p.asin,
      title: p.title,
      rating: p.rating,
      review_count: p.review_count,
      price_usd: isZA ? null : p.price,
      price_zar: isZA ? p.price : null,
      monthly_rank: p.monthly_rank,
      seller_count: 1,
      search_volume: trends.volume,
      related_keywords: trends.related,
      competition_level: trends.competition,
      profit_potential: classifyProfit(p.price, p.review_count, p.monthly_rank),
      marketplace,
      product_url: isZA ? `https://www.amazon.co.za/dp/${p.asin}` : p.product_url,
      image_url: p.image_url,
    }));

    const { error } = await supabase
      .from("products")
      .upsert(rows, { onConflict: "asin,category,region" });
    if (error) throw error;

    console.log(`[PRODUCTS] Found ${rows.length} products in category ${category} (${marketplace})`);
    return { category, count: rows.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[PRODUCTS] scan failed for ${category}: ${msg}`);
    return { category, count: 0, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Internal-only function, invoked by pg_cron. No auth required.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );




  let body: any = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
  }
  const url = new URL(req.url);
  const domain = body.amazon_domain ?? url.searchParams.get("amazon_domain") ?? "amazon.com";
  const defaultRegion = domain.endsWith(".co.za") ? "ZA" : "US";
  const region = body.region ?? url.searchParams.get("region") ?? defaultRegion;
  const single = body.category ?? url.searchParams.get("category");
  const categories: string[] = single ? [single] : (body.categories ?? DEFAULT_CATEGORIES);

  const results: ScanResult[] = [];
  for (const cat of categories) {
    results.push(await scanCategory(supabase, cat, region, domain));
  }

  const total = results.reduce((s, r) => s + r.count, 0);
  return new Response(
    JSON.stringify({ ok: true, total, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
