// One-shot backfill: pulls image_url for amazon_us rows where image is missing.
// Uses Rainforest type=product (cheapest per-ASIN call returning main_image).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const RAINFOREST_KEY = Deno.env.get("RAINFOREST_API_KEY");

async function fetchImage(asin: string, domain: string): Promise<string | null> {
  const url = new URL("https://api.rainforestapi.com/request");
  url.searchParams.set("api_key", RAINFOREST_KEY!);
  url.searchParams.set("type", "product");
  url.searchParams.set("amazon_domain", domain);
  url.searchParams.set("asin", asin);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const p = data.product ?? {};
  return (
    p.main_image?.link ??
    (Array.isArray(p.images) ? (p.images[0]?.link ?? p.images[0]) : null) ??
    null
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!RAINFOREST_KEY) {
    return new Response(JSON.stringify({ error: "RAINFOREST_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch {}
  const marketplace = body.marketplace ?? "amazon_us";
  const limit = Math.min(Number(body.limit ?? 50), 100);
  const domain = marketplace === "amazon_sa" ? "amazon.co.za" : "amazon.com";

  const { data } = await supabase
    .from("products")
    .select("id, asin")
    .eq("marketplace", marketplace)
    .or("image_url.is.null,image_url.not.ilike.http%")
    .not("asin", "is", null)
    .limit(limit);

  const rows = (data ?? []) as { id: string; asin: string }[];
  let updated = 0;
  const errors: any[] = [];
  for (const r of rows) {
    try {
      const img = await fetchImage(r.asin, domain);
      if (img) {
        const { error } = await supabase.from("products").update({ image_url: img }).eq("id", r.id);
        if (error) throw error;
        updated++;
      }
    } catch (e: any) {
      errors.push({ asin: r.asin, error: e?.message ?? String(e) });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: rows.length, updated, errors: errors.slice(0, 5) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
