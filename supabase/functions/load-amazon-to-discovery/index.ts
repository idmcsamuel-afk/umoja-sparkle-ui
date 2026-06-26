// Loads all rows from amazon_products into product_discovery.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: amazon, error: readErr } = await supabase
      .from("amazon_products")
      .select("asin, title, image_url, rating, review_count, category, price_zar")
      .limit(10000);

    if (readErr) throw readErr;
    const rows = amazon ?? [];
    console.log(`Found ${rows.length} amazon_products rows`);

    let loaded = 0;
    let skipped = 0;
    let errors = 0;
    let firstError: string | null = null;

    for (const p of rows) {
      const product_name = (p as any).title;
      if (!product_name) { skipped++; continue; }

      const asin = (p as any).asin;
      const amazon_product_url = asin ? `https://www.amazon.com/dp/${asin}` : null;

      const payload = {
        source: "amazon_products",
        product_name,
        category: (p as any).category ?? null,
        status: "discovered",
        data_validation_status: "pending_review",
        amazon_product_url,
        amazon_rating: (p as any).rating ?? null,
        amazon_reviews_count: (p as any).review_count ?? null,
        amazon_price_zar: (p as any).price_zar ?? null,
        // supplier_name + product_image_url have no dedicated columns; persist in validation_notes JSON.
        validation_notes: JSON.stringify({
          supplier_name: "Amazon",
          supplier_rating: (p as any).rating ?? null,
          product_image_url: (p as any).image_url ?? null,
        }),
      };

      // Avoid duplicates by product_name.
      const { data: existing } = await supabase
        .from("product_discovery")
        .select("id")
        .eq("product_name", product_name)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("product_discovery")
          .update(payload)
          .eq("id", (existing as any).id);
        if (error) { errors++; if (!firstError) firstError = error.message; continue; }
      } else {
        const { error } = await supabase.from("product_discovery").insert(payload);
        if (error) { errors++; if (!firstError) firstError = error.message; continue; }
      }
      loaded++;
    }

    const message = `Loaded ${loaded} products`;
    console.log(message, JSON.stringify({ skipped, errors, firstError }));

    return new Response(
      JSON.stringify({ ok: true, message, loaded, skipped, errors, firstError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("load-amazon-to-discovery error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
