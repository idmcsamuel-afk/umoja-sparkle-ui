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
// Broader net (more sub-categories) so we can safely keep only rank<=10
// per query without losing catalog coverage.
// Expanded category coverage — 1 Unlocker request per category (~50 requests/scrape).
const DEFAULT_CATEGORIES: Record<string, string> = {
  // Fashion
  "fashion-clothing": "clothing",
  "fashion-shoes": "shoes",
  "fashion-bags": "handbags",
  "fashion-accessories": "belt wallet",
  "fashion-jewellery": "jewellery",
  "fashion-watches": "watch",
  // Electronics
  "electronics": "electronics",
  "cellphones": "cellphone",
  "cellphone-accessories": "phone case charger",
  "headphones": "headphones",
  "tv-audio": "smart tv",
  "audio-speakers": "bluetooth speaker",
  "computers-laptops": "laptop",
  "computers-accessories": "keyboard mouse",
  "computers-storage": "external hard drive",
  "gaming": "gaming console",
  "gaming-accessories": "gaming headset controller",
  "photo-video": "camera",
  // Home
  "home-kitchen-appliances": "kitchen appliance",
  "home-cookware": "cookware",
  "home-storage": "storage container",
  "home-organization": "closet organizer",
  "home-decor": "home decor",
  "home-lighting": "lamp lighting",
  "home-cleaning": "cleaning supplies",
  "home-bedding": "bedding duvet",
  "home-bathroom": "bathroom accessories",
  "home-small-appliances": "small kitchen appliance",
  // Health & Beauty
  "beauty-skincare": "skincare",
  "beauty-haircare": "hair care",
  "beauty-makeup": "makeup",
  "beauty-fragrance": "perfume",
  "health-personal-care": "personal care",
  "health-supplements": "vitamins supplements",
  // Kids & Baby
  "toys": "toys",
  "toys-educational": "educational toys",
  "baby": "baby products",
  "baby-feeding": "baby feeding bottle",
  "baby-diapers": "diapers",
  // Sports & Outdoors
  "sports-outdoors": "sports",
  "sports-fitness": "fitness equipment",
  "sports-cycling": "bicycle",
  "camping-outdoor": "camping gear",
  // Auto
  "automotive": "car accessories",
  "automotive-tools": "car tools",
  // Tools & DIY
  "tools-diy": "tools DIY",
  "tools-hardware": "hardware tools",
  "power-tools": "power tools",
  // Garden
  "garden-outdoor": "garden tools",
  "garden-patio": "patio furniture",
  // Office
  "office-stationery": "stationery",
  "office-supplies": "office supplies",
  // Pets
  "pet": "pet supplies",
  "pet-food": "dog food",
  // Luggage
  "luggage-bags": "luggage suitcase",
};

// Brand detection — used to flag branded products (not sourceable from Alibaba).
// Branded rows are KEPT as category demand signals; we source generic equivalents.
const BRAND_LIST = [
  "NIVEA","Puma","ASUS","HP","Lenovo","Dell","Samsung","Apple","Sony","LG",
  "Bosch","Philips","Adidas","Nike","Huawei","Xiaomi","Canon","Nikon","JBL",
  "Logitech","Colgate","Sunlight","Sta-Soft","OMO","Handy Andy","Dettol",
  "Vaseline","Pantene","Dove","Garnier","L'Oreal","Maybelline","Revlon",
  "Gillette","Braun","Remington","Russell Hobbs","Kenwood","Defy","Hisense",
  "TCL","Acer","MSI","Microsoft","Xbox","PlayStation","Nintendo","Fitbit",
  "Garmin","GoPro","Kodak","New Balance","Reebok","Under Armour","Converse",
  "Vans","Skechers","Crocs","Timberland","Levi's","Guess","Polo","Fossil",
  "Casio","Seiko","Fujifilm","DJI","Anker","Belkin","TP-Link","D-Link",
  "Netgear","Mikrotik","Ubiquiti","Epson","Brother","WD","Seagate","Kingston",
  "SanDisk","Crucial","Corsair","Razer","SteelSeries","HyperX","Bose",
  "Sennheiser","Marshall","Beats","Skullcandy","Harman Kardon","Yamaha",
  "Panasonic","Sharp","Whirlpool","KitchenAid","Ninja","NutriBullet",
  "Instant Pot","Le Creuset","Tefal","Pyrex","Tupperware",
].sort((a,b) => b.length - a.length); // match longest first

function detectBrand(title: string): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  for (const b of BRAND_LIST) {
    if (t.includes(b.toLowerCase())) return b;
  }
  return null;
}

// Keep rules (any-of): reviews are the PRIMARY signal.
//   review_count >= MIN_REVIEWS  -> proven demand (primary)
//   search_rank  <= MAX_RANK     -> currently trending
//   days_seen    >= MIN_DAYS     -> consistent presence (checked in DB, always upserts existing)
const DEFAULT_MIN_REVIEWS = 100;
const DEFAULT_MAX_RANK = 10;
const DEFAULT_ROWS = 50; // fetch deeper so heavily-reviewed items below rank 10 are captured

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ParsedProduct {
  plid: string;
  takealot_name: string;
  takealot_price: number;
  takealot_url: string;
  image_url: string;
  category: string;
  rating: number | null;
  review_count: number | null;
  search_rank: number;
  brand: string | null;
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

    const rank = out.length + 1;

    const reviewSummary = pv?.review_summary;
    const reviewCount =
      typeof reviewSummary?.review_count === "number"
        ? reviewSummary.review_count
        : typeof core.reviews === "number"
        ? core.reviews
        : null;
    const starRating =
      typeof reviewSummary?.star_rating === "number"
        ? reviewSummary.star_rating
        : typeof core.star_rating === "number"
        ? core.star_rating
        : null;

    out.push({
      plid: String(id),
      takealot_name: title,
      takealot_price: priceNum,
      takealot_url: slug
        ? `https://www.takealot.com/${slug}/PLID${id}`
        : `https://www.takealot.com/PLID${id}`,
      image_url: buildImageUrl(gallery?.images?.[0]),
      category,
      rating: starRating,
      review_count: reviewCount,
      search_rank: rank,
      brand: detectBrand(title),
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
    let rows = DEFAULT_ROWS;
    let maxRank = DEFAULT_MAX_RANK;
    let minReviews = DEFAULT_MIN_REVIEWS;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.categories && typeof body.categories === "object") {
          categories = body.categories;
        }
        if (typeof body?.rows === "number") rows = body.rows;
        if (typeof body?.max_rank === "number") maxRank = body.max_rank;
        if (typeof body?.min_reviews === "number") minReviews = body.min_reviews;
      } catch { /* no body */ }
    }

    const perCategory: Array<{
      category: string;
      query: string;
      fetched: number;
      kept: number;
      upserted: number;
      error?: string;
    }> = [];
    let totalUpserted = 0;
    const samples: ParsedProduct[] = [];

    for (const [category, query] of Object.entries(categories)) {
      const apiUrl =
        `https://api.takealot.com/rest/v-1-13-0/searches/products,filters,facets,sort_options,breadcrumbs,slots_audience,context` +
        `?newsearch=true&qsearch=${encodeURIComponent(query)}&rows=${rows}&detail=mlisting`;
      try {
        console.log(`[unlocker] ${category} <- ${query}`);
        const json = await fetchViaUnlocker(apiUrl);
        const parsed = parseSearchJson(json, category);

        if (parsed.length === 0) {
          perCategory.push({
            category, query, fetched: 0, kept: 0, upserted: 0,
            error: "0 products in API response",
          });
          continue;
        }

        // Always re-upsert products we've already seen (so days_seen keeps counting).
        const plids = parsed.map((p) => p.plid);
        const { data: existing } = await supabase
          .from("takealot_products")
          .select("plid")
          .in("plid", plids);
        const existingSet = new Set((existing ?? []).map((r: any) => r.plid));

        // Keep = reviews (primary) OR rank OR already-tracked
        const kept = parsed.filter((p) =>
          (p.review_count != null && p.review_count >= minReviews) ||
          p.search_rank <= maxRank ||
          existingSet.has(p.plid)
        );
        console.log(`[unlocker] ${category}: fetched ${parsed.length}, kept ${kept.length} (reviews>=${minReviews} OR rank<=${maxRank} OR existing)`);

        let upserted = 0;
        let lastErr: string | undefined;
        for (const p of kept) {
          const { error } = await supabase.rpc("upsert_takealot_product", {
            _plid: p.plid,
            _name: p.takealot_name,
            _price: p.takealot_price,
            _url: p.takealot_url,
            _image: p.image_url,
            _category: p.category,
            _rating: p.rating,
            _rank: p.search_rank,
            _review_count: p.review_count,
            _brand: p.brand,
          });
          if (error) { lastErr = error.message; console.error("upsert err:", error.message); }
          else upserted++;
        }
        totalUpserted += upserted;
        perCategory.push({
          category, query, fetched: parsed.length, kept: kept.length, upserted,
          error: lastErr,
        });
        samples.push(...kept.slice(0, 2));
      } catch (e) {
        console.error(`[unlocker] ${category} error:`, e);
        perCategory.push({
          category, query, fetched: 0, kept: 0, upserted: 0,
          error: (e as Error).message,
        });
      }
    }


    return new Response(
      JSON.stringify({
        status: "ok",
        max_rank: maxRank,
        min_reviews: minReviews,
        rows_per_category: rows,
        total_upserted: totalUpserted,
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
