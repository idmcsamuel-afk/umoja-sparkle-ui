// Fetches Takealot product data via Bright Data Web Unlocker hitting Takealot's
// own JSON search API. The website is a Next.js SPA (renders products
// client-side), so scraping the HTML returns only a loader shell. Hitting the
// JSON API through Web Unlocker gives us real product data directly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BRIGHT_DATA_API_KEY = Deno.env.get("BRIGHT_DATA_API_KEY");
const BRIGHT_DATA_UNLOCKER_ZONE =
  Deno.env.get("BRIGHT_DATA_UNLOCKER_ZONE") || "umoja_web_unlocker1";

// Category label -> search query used against Takealot's search API.
// (Category-page HTML is client-rendered, so we drive the search endpoint
// instead. Query terms broad enough to yield the top ~40 products per category.)
const DEFAULT_CATEGORIES: Record<string, string> = {
  "fashion": "clothing",
  "electronics": "electronics",
  "computers-tablets": "laptop",
  "home-kitchen": "kitchen",
  "sports-outdoors": "sports",
  "beauty": "beauty",
  "toys": "toys",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ParsedProduct {
  takealot_name: string;
  takealot_price: number;
  takealot_url: string;
  image_url: string;
  category: string;
  seller_count: number;
  rating: number | null;
  scraped_at: string;
  search_rank: number;
}

async function fetchViaUnlocker(url: string): Promise<string> {
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      zone: BRIGHT_DATA_UNLOCKER_ZONE,
      url,
      format: "raw",
      country: "za",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Unlocker ${res.status}: ${body.slice(0, 300)}`);
  }
  return await res.text();
}

function buildImageUrl(raw: string | undefined): string {
  if (!raw) return "";
  // Gallery images use `{size}` placeholder, e.g. .../s-{size}.file
  return raw.replace("{size}", "pdpxl");
}

function parseSearchJson(json: string, category: string): ParsedProduct[] {
  let doc: any;
  try { doc = JSON.parse(json); } catch { return []; }

  const results: any[] = doc?.sections?.products?.results ?? [];
  const now = new Date().toISOString();
  const out: ParsedProduct[] = [];

  for (const r of results) {
    const pv = r?.product_views;
    const core = pv?.core;
    const buybox = pv?.buybox_summary;
    const gallery = pv?.gallery;
    if (!core || !buybox) continue;

    const id = core.id;
    const title = (core.title || "").trim();
    const slug = core.slug || "";
    const priceNum =
      Array.isArray(buybox.prices) && buybox.prices.length
        ? Number(buybox.prices[0])
        : 0;
    if (!title || !priceNum || !id) continue;

    out.push({
      takealot_name: title,
      takealot_price: priceNum,
      takealot_url: slug
        ? `https://www.takealot.com/${slug}/PLID${id}`
        : `https://www.takealot.com/PLID${id}`,
      image_url: buildImageUrl(gallery?.images?.[0]),
      category,
      seller_count: 1,
      rating:
        typeof core.star_rating === "number" ? core.star_rating : null,
      scraped_at: now,
    });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (!BRIGHT_DATA_API_KEY) {
      return new Response(
        JSON.stringify({ error: "BRIGHT_DATA_API_KEY is not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let categories: Record<string, string> = DEFAULT_CATEGORIES;
    let rows = 40;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.categories && typeof body.categories === "object") {
          categories = body.categories;
        }
        if (typeof body?.rows === "number") rows = body.rows;
      } catch { /* no body */ }
    }

    const perCategory: Array<{
      category: string;
      query: string;
      fetched: number;
      inserted: number;
      error?: string;
    }> = [];
    let totalInserted = 0;
    const samples: ParsedProduct[] = [];

    for (const [category, query] of Object.entries(categories)) {
      const apiUrl =
        `https://api.takealot.com/rest/v-1-13-0/searches/products,filters,facets,sort_options,breadcrumbs,slots_audience,context` +
        `?newsearch=true&qsearch=${encodeURIComponent(query)}&rows=${rows}&detail=mlisting`;
      try {
        console.log(`[unlocker] ${category} <- ${query}`);
        const json = await fetchViaUnlocker(apiUrl);
        const parsed = parseSearchJson(json, category);
        console.log(`[unlocker] ${category}: parsed ${parsed.length}`);

        if (parsed.length === 0) {
          perCategory.push({
            category, query, fetched: 0, inserted: 0,
            error: "0 products in API response",
          });
          continue;
        }

        const { error } = await supabase.from("takealot_products").insert(parsed);
        if (error) {
          perCategory.push({
            category, query, fetched: parsed.length, inserted: 0,
            error: error.message,
          });
        } else {
          totalInserted += parsed.length;
          perCategory.push({
            category, query, fetched: parsed.length, inserted: parsed.length,
          });
          samples.push(...parsed.slice(0, 2));
        }
      } catch (e) {
        console.error(`[unlocker] ${category} error:`, e);
        perCategory.push({
          category, query, fetched: 0, inserted: 0,
          error: (e as Error).message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        total_inserted: totalInserted,
        per_category: perCategory,
        samples: samples.slice(0, 5),
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scrape-takealot-unlocker fatal:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
