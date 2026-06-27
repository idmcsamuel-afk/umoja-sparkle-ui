// Enriches approved products with sales_rank + sales_rank_category via Rainforest type=product.
// Trigger per-ASIN on approval, or batch over all approved rows missing sales_rank.
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

async function enrichOne(asin: string, marketplace: string | null) {
  if (!RAINFOREST_KEY) throw new Error("RAINFOREST_API_KEY not configured");
  const url = new URL("https://api.rainforestapi.com/request");
  url.searchParams.set("api_key", RAINFOREST_KEY);
  url.searchParams.set("type", "product");
  url.searchParams.set("amazon_domain", domainFor(marketplace));
  url.searchParams.set("asin", asin);
  const res = await fetch(url.toString());
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
  return { sales_rank: rank, sales_rank_category: cat, image_url: image };
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

  // Build target list — strictly approved rows only.
  let targets: { id: string; asin: string; marketplace: string | null }[] = [];
  if (body.asin) {
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
  for (const t of targets) {
    try {
      const upd = await enrichOne(t.asin, t.marketplace);
      const patch: any = { sales_rank: upd.sales_rank, sales_rank_category: upd.sales_rank_category };
      if (upd.image_url) patch.image_url = upd.image_url;
      const { error } = await supabase.from("products").update(patch).eq("id", t.id);
      if (error) throw error;
      enriched++;
    } catch (e: any) {
      errors.push({ asin: t.asin, error: e?.message ?? String(e) });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, attempted: targets.length, enriched, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
