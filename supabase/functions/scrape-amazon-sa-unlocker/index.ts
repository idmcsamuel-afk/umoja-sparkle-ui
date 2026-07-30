// Amazon.co.za scraper running on Bright Data Web Unlocker (same account/zone
// as the Takealot scraper). Replaces the Rainforest API path for amazon_sa,
// which ran out of credit.
//
// Captures: title, price (ZAR -> price_zar directly), rating, review_count,
// image, category, region=ZA, marketplace=amazon_sa.
// Dedupe: upsert on (asin, category, region), same pattern as Takealot.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BRIGHT_DATA_API_KEY = Deno.env.get("BRIGHT_DATA_API_KEY");
const BRIGHT_DATA_UNLOCKER_ZONE =
  Deno.env.get("BRIGHT_DATA_UNLOCKER_ZONE") || "umoja_web_unlocker1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Same category coverage shape as the Takealot scraper: label -> search query.
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

// Brand detection — branded rows are KEPT as category demand signals.
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
].sort((a, b) => b.length - a.length);

function detectBrand(title: string): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  for (const b of BRAND_LIST) if (t.includes(b.toLowerCase())) return b;
  return null;
}

// Keep rules (any-of), mirroring Takealot: reviews are the primary signal.
const DEFAULT_MIN_REVIEWS = 100;
const DEFAULT_MAX_RANK = 10;
const DEFAULT_MIN_RATING = 3.5;
const DEFAULT_PAGES = 1;

interface ParsedProduct {
  asin: string;
  title: string;
  price_zar: number | null;
  rating: number | null;
  review_count: number | null;
  image_url: string | null;
  product_url: string;
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

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/\s/g, "");
  // ZA formats: 1 234,56 / 1,234.56 / 1234
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    normalized = parts[parts.length - 1].length === 2
      ? cleaned.replace(",", ".")
      : cleaned.replace(/,/g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Split the search page into per-result blocks keyed by data-asin. */
function splitResultBlocks(html: string): Array<{ asin: string; block: string }> {
  const out: Array<{ asin: string; block: string }> = [];
  const re = /data-asin="([A-Z0-9]{10})"/g;
  const marks: Array<{ asin: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) marks.push({ asin: m[1], index: m.index });
  const seen = new Set<string>();
  for (let i = 0; i < marks.length; i++) {
    const { asin, index } = marks[i];
    if (seen.has(asin)) continue;
    seen.add(asin);
    const end = i + 1 < marks.length ? marks[i + 1].index : Math.min(html.length, index + 12000);
    out.push({ asin, block: html.slice(index, end) });
  }
  return out;
}

function parseSearchHtml(html: string, startRank: number): ParsedProduct[] {
  const out: ParsedProduct[] = [];
  let rank = startRank;

  for (const { asin, block } of splitResultBlocks(html)) {
    // Title: h2 text, or the image alt as fallback
    let title =
      stripTags(block.match(/<h2[^>]*>([\s\S]{1,600}?)<\/h2>/i)?.[1] ?? "") ||
      decodeEntities(block.match(/class="s-image"[^>]*alt="([^"]{5,400})"/i)?.[1] ?? "") ||
      decodeEntities(block.match(/<img[^>]+alt="([^"]{5,400})"[^>]*class="s-image"/i)?.[1] ?? "");
    title = title.replace(/^Sponsored Ad\s*-\s*/i, "").trim();
    if (!title || title.length < 5) continue;

    // Price: prefer a-offscreen inside a-price, else whole-fraction pair
    const offscreen = block.match(/<span class="a-offscreen">([^<]{1,40})<\/span>/i)?.[1];
    let price = toNumber(offscreen);
    if (price == null) {
      const whole = block.match(/class="a-price-whole">([^<]{1,20})</i)?.[1];
      const frac = block.match(/class="a-price-fraction">([^<]{1,5})</i)?.[1];
      if (whole) price = toNumber(frac ? `${whole}.${frac}` : whole);
    }

    // Rating: "4.5 out of 5 stars"
    const rating = (() => {
      const r =
        block.match(/([0-9](?:[.,][0-9])?)\s+out of 5 stars/i)?.[1] ??
        block.match(/a-icon-star-small a-star-small-(\d)(?:-(\d))?/i)?.slice(1).filter(Boolean).join(".");
      if (!r) return null;
      const n = Number(r.replace(",", "."));
      return Number.isFinite(n) && n > 0 && n <= 5 ? n : null;
    })();

    // Review count: aria-label on the ratings link, or the s-underline-text span
    const reviewCount = (() => {
      const candidates = [
        block.match(/aria-label="([\d\s.,]+)\s*ratings?"/i)?.[1],
        block.match(/s-underline-text">([\d\s.,]+)</i)?.[1],
        block.match(/aria-label="([\d\s.,]+)"[^>]*>\s*<span[^>]*class="a-size-base[^"]*"/i)?.[1],
      ].filter(Boolean) as string[];
      for (const c of candidates) {
        const n = toNumber(c);
        if (n != null) return Math.round(n);
      }
      return null;
    })();

    const image =
      block.match(/class="s-image"[^>]*src="([^"]+)"/i)?.[1] ??
      block.match(/<img[^>]+src="(https:\/\/m\.media-amazon\.com[^"]+)"/i)?.[1] ??
      null;

    out.push({
      asin,
      title,
      price_zar: price,
      rating,
      review_count: reviewCount,
      image_url: image ? decodeEntities(image) : null,
      product_url: `https://www.amazon.co.za/dp/${asin}`,
      search_rank: rank++,
      brand: detectBrand(title),
    });
  }
  return out;
}

function classifyProfit(price: number | null, reviews: number | null, rank: number | null): string {
  if (!price) return "unknown";
  if (price >= 500 && (reviews ?? 0) >= 500 && (rank ?? 999999) <= 20) return "high";
  if (price >= 250 && (reviews ?? 0) >= 100) return "medium";
  return "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!BRIGHT_DATA_API_KEY) {
      return new Response(JSON.stringify({ error: "BRIGHT_DATA_API_KEY is not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let categories: Record<string, string> = DEFAULT_CATEGORIES;
    let pages = DEFAULT_PAGES;
    let maxRank = DEFAULT_MAX_RANK;
    let minReviews = DEFAULT_MIN_REVIEWS;
    let minRating = DEFAULT_MIN_RATING;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.categories && typeof body.categories === "object") categories = body.categories;
        if (typeof body?.pages === "number") pages = Math.max(1, Math.min(3, body.pages));
        if (typeof body?.max_rank === "number") maxRank = body.max_rank;
        if (typeof body?.min_reviews === "number") minReviews = body.min_reviews;
        if (typeof body?.min_rating === "number") minRating = body.min_rating;
      } catch { /* no body */ }
    }

    const perCategory: Array<{
      category: string; query: string; fetched: number; kept: number; upserted: number; error?: string;
    }> = [];
    let totalUpserted = 0;
    const samples: ParsedProduct[] = [];

    for (const [category, query] of Object.entries(categories)) {
      try {
        let parsed: ParsedProduct[] = [];
        for (let page = 1; page <= pages; page++) {
          const url =
            `https://www.amazon.co.za/s?k=${encodeURIComponent(query)}` +
            `&page=${page}&language=en_ZA`;
          console.log(`[amazon-sa] ${category} p${page} <- ${query}`);
          const html = await fetchViaUnlocker(url);
          parsed = parsed.concat(parseSearchHtml(html, parsed.length + 1));
        }
        // dedupe by asin within the category
        const byAsin = new Map<string, ParsedProduct>();
        for (const p of parsed) if (!byAsin.has(p.asin)) byAsin.set(p.asin, p);
        parsed = [...byAsin.values()];

        if (parsed.length === 0) {
          perCategory.push({ category, query, fetched: 0, kept: 0, upserted: 0, error: "0 products parsed" });
          continue;
        }

        // Always re-upsert rows we already track (keeps times_seen/days_seen counting)
        const { data: existing } = await supabase
          .from("products")
          .select("asin")
          .eq("marketplace", "amazon_sa")
          .eq("category", category)
          .eq("region", "ZA")
          .in("asin", parsed.map((p) => p.asin));
        const existingSet = new Set((existing ?? []).map((r: any) => r.asin));

        const kept = parsed.filter((p) =>
          p.price_zar != null &&
          (p.rating == null || p.rating >= minRating) &&
          (
            (p.review_count != null && p.review_count >= minReviews) ||
            p.search_rank <= maxRank ||
            existingSet.has(p.asin)
          )
        );
        console.log(`[amazon-sa] ${category}: fetched ${parsed.length}, kept ${kept.length}`);

        let upserted = 0;
        let lastErr: string | undefined;
        if (kept.length) {
          const rows = kept.map((p) => ({
            asin: p.asin,
            category,
            region: "ZA",
            marketplace: "amazon_sa",
            title: p.title,
            // Amazon.co.za prices are already ZAR — never convert.
            price_zar: p.price_zar,
            rating: p.rating,
            review_count: p.review_count ?? 0,
            monthly_rank: p.search_rank,
            sales_rank: p.search_rank,
            seller_count: 1,
            image_url: p.image_url,
            product_url: p.product_url,
            brand: p.brand,
            is_branded: p.brand != null,
            profit_potential: classifyProfit(p.price_zar, p.review_count, p.search_rank),
          }));
          const { error } = await supabase
            .from("products")
            .upsert(rows, { onConflict: "asin,category,region" });
          if (error) { lastErr = error.message; console.error("[amazon-sa] upsert err:", error.message); }
          else upserted = rows.length;
        }

        totalUpserted += upserted;
        perCategory.push({ category, query, fetched: parsed.length, kept: kept.length, upserted, error: lastErr });
        samples.push(...kept.slice(0, 2));
      } catch (e) {
        console.error(`[amazon-sa] ${category} error:`, e);
        perCategory.push({
          category, query, fetched: 0, kept: 0, upserted: 0, error: (e as Error).message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        marketplace: "amazon_sa",
        source: "bright_data_web_unlocker",
        pages_per_category: pages,
        max_rank: maxRank,
        min_reviews: minReviews,
        total_upserted: totalUpserted,
        per_category: perCategory,
        samples: samples.slice(0, 5),
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scrape-amazon-sa-unlocker fatal:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
