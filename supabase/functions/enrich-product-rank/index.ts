// Enriches a product with Rainforest type=product data:
// - sales_rank + sales_rank_category (BSR)
// - REAL seller/offer count (overwrites the hardcoded 1 from bulk search)
// - buybox price (currency captured too)
// - image_url fallback
//
// Modes:
//   POST { product_id: "<uuid>" }  -> on-demand enrichment for a single row (used
//                                     by the admin "Fetch competition data" button
//                                     BEFORE approval — row need not be approved).
//   POST { asin: "<ASIN>" }         -> enrich the approved row(s) with that ASIN.
//   POST { limit: N }               -> batch enrich approved rows still missing BSR.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const RAINFOREST_KEY = Deno.env.get("RAINFOREST_API_KEY");

function domainFor(marketplace: string | null): string {
  if (marketplace === "amazon_sa") return "amazon.co.za";
  if (marketplace === "amazon_uk") return "amazon.co.uk";
  if (marketplace === "amazon_de") return "amazon.de";
  return "amazon.com";
}

function extractSellerCount(p: any): number | null {
  // Rainforest type=product returns a variety of shapes depending on the listing.
  // Prefer explicit total offer counts, else derive from buybox + other_sellers list.
  const candidates = [
    p?.buybox_winner?.offers_count,
    p?.buybox_winner?.total_offers,
    p?.offers?.total_offers,
    p?.total_offers,
    p?.offers_count,
    Array.isArray(p?.other_sellers) ? p.other_sellers.length + (p?.buybox_winner ? 1 : 0) : null,
    Array.isArray(p?.offers) ? p.offers.length : null,
  ];
  for (const v of candidates) {
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}

function extractBuybox(p: any): { price: number | null; currency: string | null } {
  const bb = p?.buybox_winner ?? {};
  const price =
    (typeof bb?.price?.value === "number" ? bb.price.value : null) ??
    (typeof bb?.rrp?.value === "number" ? bb.rrp.value : null) ??
    (typeof p?.buybox_price?.value === "number" ? p.buybox_price.value : null) ??
    null;
  const currency =
    bb?.price?.currency ??
    bb?.rrp?.currency ??
    p?.buybox_price?.currency ??
    null;
  return { price, currency };
}

async function fetchProduct(asin: string, marketplace: string | null) {
  if (!RAINFOREST_KEY) throw new Error("RAINFOREST_API_KEY not configured");
  const domain = domainFor(marketplace);
  const productUrl = new URL("https://api.rainforestapi.com/request");
  productUrl.searchParams.set("api_key", RAINFOREST_KEY);
  productUrl.searchParams.set("type", "product");
  productUrl.searchParams.set("amazon_domain", domain);
  productUrl.searchParams.set("asin", asin);
  const res = await fetch(productUrl.toString());
  if (!res.ok) throw new Error(`Rainforest ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const p = data.product ?? {};
  const br = Array.isArray(p.bestsellers_rank) ? p.bestsellers_rank[0] : null;
  const rank = br?.rank ?? (typeof p.sales_rank === "number" ? p.sales_rank : null);
  const cat = br?.category ?? br?.name ?? null;
  const image =
    p.main_image?.link ??
    (Array.isArray(p.images) ? (p.images[0]?.link ?? p.images[0]) : null) ??
    null;
  let sellers = extractSellerCount(p);
  const { price: buybox_price, currency: buybox_currency } = extractBuybox(p);

  // Fallback: type=offers gives an authoritative offer count when the product
  // response omits it (common on Amazon SA listings).
  if (sellers == null) {
    try {
      const offersUrl = new URL("https://api.rainforestapi.com/request");
      offersUrl.searchParams.set("api_key", RAINFOREST_KEY);
      offersUrl.searchParams.set("type", "offers");
      offersUrl.searchParams.set("amazon_domain", domain);
      offersUrl.searchParams.set("asin", asin);
      const or = await fetch(offersUrl.toString());
      if (or.ok) {
        const od = await or.json();
        const t = od?.offers_results?.total_offers ??
                  od?.pagination?.total_results ??
                  (Array.isArray(od?.offers) ? od.offers.length : null);
        if (typeof t === "number" && t > 0) sellers = t;
      }
    } catch (_) { /* ignore fallback failure */ }
  }

  return {
    sales_rank: rank,
    sales_rank_category: cat,
    image_url: image,
    seller_count: sellers,
    buybox_price,
    buybox_currency,
  };
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

  // Build target list.
  let targets: { id: string; asin: string; marketplace: string | null }[] = [];
  if (body.product_id) {
    // On-demand: any status, single row (used pre-approval to see BSR + sellers).
    const { data } = await supabase
      .from("products")
      .select("id, asin, marketplace")
      .eq("id", body.product_id)
      .not("asin", "is", null)
      .maybeSingle();
    if (data) targets = [data as any];
  } else if (body.asin) {
    const { data } = await supabase
      .from("products")
      .select("id, asin, marketplace, validation_status")
      .eq("asin", body.asin)
      .eq("validation_status", "approved_to_queue");
    targets = (data ?? []).map((r: any) => ({ id: r.id, asin: r.asin, marketplace: r.marketplace }));
  } else {
    const limit = Math.min(Number(body.limit ?? 25), 50);
    const { data } = await supabase
      .from("products")
      .select("id, asin, marketplace")
      .eq("validation_status", "approved_to_queue")
      .is("sales_rank", null)
      .not("asin", "is", null)
      .limit(limit);
    targets = (data ?? []) as any;
  }

  let enriched = 0;
  const errors: any[] = [];
  const results: any[] = [];
  for (const t of targets) {
    try {
      const upd = await fetchProduct(t.asin, t.marketplace);
      const patch: any = {
        sales_rank: upd.sales_rank,
        sales_rank_category: upd.sales_rank_category,
      };
      if (upd.image_url) patch.image_url = upd.image_url;
      if (typeof upd.seller_count === "number") {
        patch.seller_count = upd.seller_count;
        patch.seller_count_verified = true;
      }
      if (typeof upd.buybox_price === "number") patch.buybox_price = upd.buybox_price;
      if (upd.buybox_currency) patch.buybox_currency = upd.buybox_currency;
      const { error } = await supabase.from("products").update(patch).eq("id", t.id);
      if (error) throw error;
      enriched++;
      results.push({ id: t.id, asin: t.asin, ...upd });
    } catch (e: any) {
      errors.push({ asin: t.asin, error: e?.message ?? String(e) });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, attempted: targets.length, enriched, results, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
