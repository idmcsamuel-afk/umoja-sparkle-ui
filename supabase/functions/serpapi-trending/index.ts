// SerpAPI trending finder — searches Google Shopping in US/UK/AU for trending
// products across key categories, then compares against Takealot.co.za to
// surface "Buy Soon" opportunities (popular abroad, scarce locally).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MARKETS = [
  { gl: "us", flag: "🇺🇸", label: "US" },
  { gl: "uk", flag: "🇬🇧", label: "UK" },
  { gl: "au", flag: "🇦🇺", label: "AU" },
];

const CATEGORIES = [
  "trending electronics gadgets",
  "trending kitchen home",
  "trending beauty personal care",
  "trending fitness wellness",
];

interface Candidate {
  title: string;
  category: string;
  markets: string[]; // labels like "US","UK"
  flags: string[];
  avg_price_usd: number;
  takealot_count: number;
  estimated_margin_zar: number;
  sale_price_zar: number;
  cost_price_zar: number;
  thumbnail?: string;
}

const ZAR_PER_USD = 18.5;

async function serpShopping(key: string, q: string, gl: string) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", q);
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", "en");
  url.searchParams.set("num", "10");
  url.searchParams.set("api_key", key);
  const r = await fetch(url.toString());
  if (!r.ok) return [];
  const j = await r.json();
  return (j.shopping_results ?? []) as any[];
}

async function takealotCount(key: string, q: string) {
  // Use Google search restricted to takealot.co.za as a proxy for availability.
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", `site:takealot.co.za ${q}`);
  url.searchParams.set("gl", "za");
  url.searchParams.set("num", "5");
  url.searchParams.set("api_key", key);
  const r = await fetch(url.toString());
  if (!r.ok) return 99;
  const j = await r.json();
  const organic = (j.organic_results ?? []) as any[];
  return organic.length;
}

function categoryLabel(q: string): string {
  if (q.includes("electronics")) return "Electronics";
  if (q.includes("kitchen")) return "Kitchen & Home";
  if (q.includes("beauty")) return "Beauty";
  if (q.includes("fitness")) return "Fitness & Wellness";
  return "General";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("SERPAPI_KEY");
    if (!apiKey) throw new Error("SERPAPI_KEY not configured");

    // title -> aggregate
    const agg = new Map<string, Candidate>();

    for (const cat of CATEGORIES) {
      for (const m of MARKETS) {
        const items = await serpShopping(apiKey, cat, m.gl);
        for (const it of items.slice(0, 6)) {
          const title = String(it.title ?? "").trim();
          if (!title) continue;
          const key = title.toLowerCase().slice(0, 80);
          const priceNum = Number(
            String(it.extracted_price ?? it.price ?? "0").replace(/[^0-9.]/g, ""),
          ) || 0;
          const existing = agg.get(key);
          if (existing) {
            if (!existing.markets.includes(m.label)) {
              existing.markets.push(m.label);
              existing.flags.push(m.flag);
            }
            existing.avg_price_usd = (existing.avg_price_usd + priceNum) / 2;
          } else {
            agg.set(key, {
              title,
              category: categoryLabel(cat),
              markets: [m.label],
              flags: [m.flag],
              avg_price_usd: priceNum,
              takealot_count: -1,
              estimated_margin_zar: 0,
              sale_price_zar: 0,
              cost_price_zar: 0,
              thumbnail: it.thumbnail,
            });
          }
        }
      }
    }

    // Filter: must be popular in 2+ markets to be a real signal.
    const shortlist = Array.from(agg.values())
      .filter((c) => c.markets.length >= 2 && c.avg_price_usd > 0)
      .slice(0, 20);

    // Check Takealot for each. Keep only low/no listings.
    const opportunities: Candidate[] = [];
    for (const c of shortlist) {
      const cnt = await takealotCount(apiKey, c.title);
      c.takealot_count = cnt;
      if (cnt <= 2) {
        c.sale_price_zar = Math.round(c.avg_price_usd * ZAR_PER_USD * 1.4);
        c.cost_price_zar = Math.round(c.avg_price_usd * ZAR_PER_USD * 0.85);
        c.estimated_margin_zar = c.sale_price_zar - c.cost_price_zar;
        opportunities.push(c);
      }
      if (opportunities.length >= 12) break;
    }

    return new Response(
      JSON.stringify({ ok: true, count: opportunities.length, opportunities }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
