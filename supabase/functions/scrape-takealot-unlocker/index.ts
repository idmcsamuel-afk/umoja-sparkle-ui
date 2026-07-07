// Fetches Takealot category pages via Bright Data Web Unlocker, parses the
// product grid in-code using stable data-ref selectors, and inserts rows into
// takealot_products. Replaces the black-box Bright Data collector approach.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BRIGHT_DATA_API_KEY = Deno.env.get("BRIGHT_DATA_API_KEY");
// Web Unlocker zone name in the Bright Data account (e.g. "web_unlocker1").
const BRIGHT_DATA_UNLOCKER_ZONE =
  Deno.env.get("BRIGHT_DATA_UNLOCKER_ZONE") || "web_unlocker1";

const DEFAULT_CATEGORIES = [
  "fashion",
  "electronics",
  "computers-tablets",
  "home-kitchen",
  "sports-outdoors",
];

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
    throw new Error(
      `Unlocker fetch failed ${res.status}: ${body.slice(0, 300)}`,
    );
  }
  return await res.text();
}

function parsePrice(text: string | null | undefined): number {
  if (!text) return 0;
  // "R 2,799" or "R2 799" → 2799
  const digits = text.replace(/[^\d.]/g, "");
  const n = parseFloat(digits);
  return Number.isFinite(n) ? n : 0;
}

function parseHtml(html: string, category: string): ParsedProduct[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];

  const cards = doc.querySelectorAll('article[data-ref="product-card"]');
  const now = new Date().toISOString();
  const out: ParsedProduct[] = [];

  cards.forEach((node) => {
    const card = node as unknown as Element;

    // Name: prefer h4 textContent, fallback to product-image alt
    const h4 = card.querySelector("h4");
    const img = card.querySelector('img[data-ref="product-image"]');
    const name =
      (h4?.textContent || img?.getAttribute("alt") || "").trim();

    // Price
    const priceEl = card.querySelector(
      '[data-ref="price"] span.currency, [data-ref="buybox-price"] span.currency, span.currency',
    );
    const price = parsePrice(priceEl?.textContent);

    // Image
    const image = img?.getAttribute("src") || "";

    // Link
    const linkEl = card.querySelector('a[href*="/"]');
    let href = linkEl?.getAttribute("href") || "";
    if (href && !href.startsWith("http")) {
      href = `https://www.takealot.com${href}`;
    }

    // Rating (optional)
    const ratingEl = card.querySelector(".rating-module_score, .score");
    const ratingText = ratingEl?.textContent?.trim();
    const rating = ratingText ? parseFloat(ratingText) : null;

    if (!name || !price) return;

    out.push({
      takealot_name: name,
      takealot_price: price,
      takealot_url: href,
      image_url: image,
      category: category.replace(/-/g, " "),
      seller_count: 1,
      rating: rating && Number.isFinite(rating) ? rating : null,
      scraped_at: now,
    });
  });

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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let categories = DEFAULT_CATEGORIES;
    let maxPerCategory = 60;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (Array.isArray(body?.categories) && body.categories.length) {
          categories = body.categories;
        }
        if (typeof body?.max_per_category === "number") {
          maxPerCategory = body.max_per_category;
        }
      } catch {
        // no body, use defaults
      }
    }

    const perCategory: Array<{
      category: string;
      fetched: number;
      inserted: number;
      error?: string;
      sample?: ParsedProduct[];
    }> = [];

    let totalInserted = 0;
    const allSamples: ParsedProduct[] = [];

    for (const category of categories) {
      const url = `https://www.takealot.com/${category}`;
      try {
        console.log(`[unlocker] fetching ${url}`);
        const html = await fetchViaUnlocker(url);
        const parsed = parseHtml(html, category).slice(0, maxPerCategory);
        console.log(`[unlocker] ${category}: parsed ${parsed.length} cards`);

        if (parsed.length === 0) {
          perCategory.push({
            category,
            fetched: 0,
            inserted: 0,
            error: "0 cards parsed (selectors may have changed)",
          });
          continue;
        }

        const { error } = await supabase
          .from("takealot_products")
          .insert(parsed);

        if (error) {
          perCategory.push({
            category,
            fetched: parsed.length,
            inserted: 0,
            error: error.message,
          });
        } else {
          totalInserted += parsed.length;
          perCategory.push({
            category,
            fetched: parsed.length,
            inserted: parsed.length,
            sample: parsed.slice(0, 2),
          });
          allSamples.push(...parsed.slice(0, 2));
        }
      } catch (e) {
        console.error(`[unlocker] ${category} error:`, e);
        perCategory.push({
          category,
          fetched: 0,
          inserted: 0,
          error: (e as Error).message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        total_inserted: totalInserted,
        per_category: perCategory,
        samples: allSamples.slice(0, 5),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("scrape-takealot-unlocker fatal:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
