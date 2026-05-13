// SerpAPI trending finder — searches Google Shopping in US/UK/AU/CA across
// 5 categories, then compares against Takealot.co.za to surface "Buy Soon"
// opportunities (popular abroad, scarce locally).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MARKETS = [
  { gl: "us", flag: "🇺🇸", label: "US" },
  { gl: "uk", flag: "🇬🇧", label: "UK" },
  { gl: "au", flag: "🇦🇺", label: "AU" },
  { gl: "ca", flag: "🇨🇦", label: "CA" },
];

const CATEGORIES: { q: string; label: string }[] = [
  { q: "trending electronics", label: "Electronics" },
  { q: "trending home gadgets", label: "Home Gadgets" },
  { q: "trending beauty products", label: "Beauty" },
  { q: "trending kitchen tools", label: "Kitchen" },
  { q: "trending fitness gear", label: "Fitness" },
];

interface Candidate {
  title: string;
  category: string;
  markets: string[];
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
  url.searchParams.set("num", "5");
  url.searchParams.set("api_key", key);
  const r = await fetch(url.toString());
  if (!r.ok) return [];
  const j = await r.json();
  return (j.shopping_results ?? []) as any[];
}

async function takealotCount(key: string, q: string) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", `site:takealot.co.za ${q}`);
  url.searchParams.set("gl", "za");
  url.searchParams.set("num", "3");
  url.searchParams.set("api_key", key);
  const r = await fetch(url.toString());
  if (!r.ok) return 99;
  const j = await r.json();
  return ((j.organic_results ?? []) as any[]).length;
}

async function fetchAccount(key: string) {
  try {
    const r = await fetch(`https://serpapi.com/account.json?api_key=${key}`);
    if (!r.ok) return null;
    const j = await r.json();
    return {
      plan: j.plan_name ?? "Free",
      searches_used: j.this_month_usage ?? null,
      searches_left: j.total_searches_left ?? j.searches_per_month ?? null,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Admin auth gate — this endpoint burns paid SerpAPI quota.
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const adminClient = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdm } = await adminClient.from("admin_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!isAdm) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("SERPAPI_KEY");
    if (!apiKey) throw new Error("SERPAPI_KEY not configured");

    const accountBefore = await fetchAccount(apiKey);

    const candidates: Candidate[] = [];

    // 5 categories × 4 markets = 20 shopping searches → top 1 per combo
    for (const cat of CATEGORIES) {
      for (const m of MARKETS) {
        const items = await serpShopping(apiKey, cat.q, m.gl);
        const top = items[0];
        if (!top) continue;
        const title = String(top.title ?? "").trim();
        if (!title) continue;
        const priceNum = Number(
          String(top.extracted_price ?? top.price ?? "0").replace(/[^0-9.]/g, ""),
        ) || 0;
        candidates.push({
          title,
          category: cat.label,
          markets: [m.label],
          flags: [m.flag],
          avg_price_usd: priceNum,
          takealot_count: -1,
          estimated_margin_zar: 0,
          sale_price_zar: 0,
          cost_price_zar: 0,
          thumbnail: top.thumbnail,
        });
      }
    }

    // Dedupe by lowercased prefix; merge market flags
    const dedup = new Map<string, Candidate>();
    for (const c of candidates) {
      const key = c.title.toLowerCase().slice(0, 60);
      const existing = dedup.get(key);
      if (existing) {
        for (let i = 0; i < c.markets.length; i++) {
          if (!existing.markets.includes(c.markets[i])) {
            existing.markets.push(c.markets[i]);
            existing.flags.push(c.flags[i]);
          }
        }
        existing.avg_price_usd = (existing.avg_price_usd + c.avg_price_usd) / 2;
      } else {
        dedup.set(key, c);
      }
    }

    const shortlist = Array.from(dedup.values())
      .filter((c) => c.avg_price_usd > 0)
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
      if (opportunities.length >= 20) break;
    }

    const accountAfter = await fetchAccount(apiKey);

    return new Response(
      JSON.stringify({
        ok: true,
        count: opportunities.length,
        opportunities,
        usage: accountAfter ?? accountBefore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("serpapi-trending error", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
