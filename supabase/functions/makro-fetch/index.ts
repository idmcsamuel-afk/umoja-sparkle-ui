// Makro product fetch edge function.
// Pulls trending Makro SKUs and upserts them into spark_trade_shortlist.
//
// NOTE: Makro's affiliate/seller API endpoint contract isn't publicly documented
// in a stable form. This function attempts a real call when MAKRO_API_BASE is set,
// otherwise it falls back to a curated seed list so the rest of the pipeline works.
// Swap the fetch block for the real endpoint once available.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MakroProduct {
  sku: string;
  product_name: string;
  category: string;
  sell_price: number;
  cost_price: number;
  monthly_sales?: number;
  reviews?: number;
  rating?: number;
  stock?: number;
}

const SEED: MakroProduct[] = [
  { sku: "MKR-1001", product_name: "Defy 9kg Top Loader Washing Machine", category: "Appliances", sell_price: 5499, cost_price: 4100, reviews: 240, rating: 4.4, stock: 35 },
  { sku: "MKR-1002", product_name: "Hisense 50\" 4K Smart TV", category: "Electronics", sell_price: 6999, cost_price: 5400, reviews: 480, rating: 4.6, stock: 60 },
  { sku: "MKR-1003", product_name: "Russell Hobbs Air Fryer 5L", category: "Kitchen", sell_price: 1299, cost_price: 820, reviews: 1200, rating: 4.7, stock: 200 },
  { sku: "MKR-1004", product_name: "Sunbeam Microwave 28L", category: "Kitchen", sell_price: 1799, cost_price: 1200, reviews: 340, rating: 4.3, stock: 90 },
  { sku: "MKR-1005", product_name: "Logik Bar Fridge 92L", category: "Appliances", sell_price: 2299, cost_price: 1650, reviews: 110, rating: 4.1, stock: 25 },
  { sku: "MKR-1006", product_name: "JBL Go 3 Bluetooth Speaker", category: "Audio", sell_price: 699, cost_price: 410, reviews: 2200, rating: 4.8, stock: 500 },
  { sku: "MKR-1007", product_name: "Samsung 32\" HD TV", category: "Electronics", sell_price: 3499, cost_price: 2700, reviews: 380, rating: 4.5, stock: 70 },
  { sku: "MKR-1008", product_name: "Defy Steam Iron 2400W", category: "Home", sell_price: 549, cost_price: 320, reviews: 540, rating: 4.4, stock: 150 },
];

// Estimate monthly sales when API doesn't return it.
// Heuristic: blend reviews (recent buyers), rating (quality), and stock (depth).
function estimateMonthlySales(p: MakroProduct): number {
  if (p.monthly_sales && p.monthly_sales > 0) return Math.round(p.monthly_sales);
  const reviews = Number(p.reviews ?? 0);
  const rating = Number(p.rating ?? 3.5);
  const stock = Number(p.stock ?? 0);
  // Reviews are ~5-10% of buyers; weight by rating; add stock turnover signal.
  const fromReviews = reviews * 8 * (rating / 5);
  const fromStock = stock * 4;
  const est = Math.round(fromReviews + fromStock);
  return Math.max(50, est);
}

let LAST_REAL = false;

async function fetchFromMakro(): Promise<MakroProduct[]> {
  const base = Deno.env.get("MAKRO_API_BASE");
  const appId = Deno.env.get("MAKRO_APP_ID");
  const appSecret = Deno.env.get("MAKRO_APP_SECRET");
  if (!base || !appId || !appSecret) { LAST_REAL = false; return SEED; }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/products?limit=20`, {
      headers: { "x-app-id": appId, "x-app-secret": appSecret, Accept: "application/json" },
    });
    if (!res.ok) { LAST_REAL = false; return SEED; }
    const json = await res.json();
    const list: any[] = json.products ?? json.items ?? json.data ?? [];
    if (!list.length) { LAST_REAL = false; return SEED; }
    LAST_REAL = true;
    return list.map((p) => ({
      sku: String(p.sku ?? p.id ?? p.product_id ?? crypto.randomUUID()),
      product_name: String(p.name ?? p.title ?? p.product_name ?? "Makro Product"),
      category: String(p.category ?? p.dept ?? "General"),
      sell_price: Number(p.sell_price ?? p.price ?? p.retail_price ?? 0),
      cost_price: Number(p.cost_price ?? p.wholesale_price ?? p.cost ?? 0),
      monthly_sales: Number(p.monthly_sales ?? p.units_sold_30d ?? p.sales_30d ?? 0) || undefined,
      reviews: Number(p.reviews ?? p.review_count ?? 0) || undefined,
      rating: Number(p.rating ?? p.stars ?? 0) || undefined,
      stock: Number(p.stock ?? p.inventory ?? p.qty_available ?? 0) || undefined,
    }));
  } catch {
    LAST_REAL = false;
    return SEED;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Admin auth gate — this endpoint mutates spark_trade_shortlist with service role.
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdm } = await supabase.from("admin_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!isAdm) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const products = await fetchFromMakro();

    const rows = products.map((p) => {
      const margin = p.sell_price - p.cost_price;
      const marginPct = p.sell_price > 0 ? (margin / p.sell_price) * 100 : 0;
      const monthly = estimateMonthlySales(p);
      return {
        asin: p.sku,
        product_name: p.product_name,
        category: p.category,
        sale_price: p.sell_price,
        cost_price: p.cost_price,
        estimated_margin: margin,
        margin_pct: Number(marginPct.toFixed(2)),
        estimated_monthly_sales: monthly,
        sales_velocity: Math.max(1, Math.round(monthly / 30)),
        data_source: LAST_REAL ? "makro" : "makro_seed",
        status: "open",
        target_slots: 50,
        moq: 5,
      };
    });

    // Upsert by asin (sku)
    const { data, error } = await supabase
      .from("spark_trade_shortlist")
      .upsert(rows, { onConflict: "asin" })
      .select("id, asin");

    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, inserted: data?.length ?? 0, products: rows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
