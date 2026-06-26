// Publish supplier-confirmed products into spark_trade_opportunities as spotlights.
// Runs daily at 03:00 UTC.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IDARA_EMAIL = Deno.env.get("IDARA_EMAIL") ?? "idmcsamuel@gmail.com";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function notifyIdara(published: Array<{ id: number; product_name: string; final_moq: number; final_supplier_price_zar: number }>) {
  if (published.length === 0) return { skipped: true };
  const list = published
    .map((p, i) => `${i + 1}. ${p.product_name} - MOQ ${p.final_moq} units, R${Number(p.final_supplier_price_zar).toFixed(2)}/unit`)
    .join("\n");
  const subject = `🎉 ${published.length} New Products Published to Spark Trade`;
  const body = `Hi Idara,

${published.length} products have been automatically published to Browse tab:

${list}

Members can now reserve these products.

Next: Products will launch orders when MOQ is reached.

Dashboard: https://umojarise.com/admin/spark-trade`;
  if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
    console.log("[email skipped: RESEND_API_KEY not configured]", { subject, to: IDARA_EMAIL });
    return { skipped: true };
  }
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: "Umoja Spark Trade <notify@umojarise.com>",
      to: [IDARA_EMAIL],
      subject,
      text: body,
    }),
  });
  if (!res.ok) {
    console.warn("idara notify failed:", res.status, await res.text());
    return { sent: false };
  }
  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { data: confirmed, error } = await supabase
      .from("product_discovery")
      .select("id, product_name, category, final_moq, final_supplier_price_zar, lead_time_days, estimated_margin_pct")
      .eq("status", "confirmed")
      .eq("is_published", false)
      .order("date_supplier_responded", { ascending: true });
    if (error) throw error;

    if (!confirmed || confirmed.length === 0) {
      return new Response(JSON.stringify({ success: true, products_published: 0, message: "No products to publish" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current max spotlight rank once.
    const { data: maxRow } = await supabase
      .from("spark_trade_opportunities")
      .select("spotlight_rank")
      .eq("is_spotlight", true)
      .order("spotlight_rank", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextRank = Number((maxRow as any)?.spotlight_rank ?? 0) + 1;

    const newIds: number[] = [];
    const publishedDetails: any[] = [];

    for (const p of confirmed) {
      const cost = Number(p.final_supplier_price_zar ?? 0);
      const margin = Number(p.estimated_margin_pct ?? 0);
      const sellPrice = cost > 0 ? Math.round(cost * (1 + margin / 100) * 100) / 100 : 0;

      const { data: inserted, error: insErr } = await supabase
        .from("spark_trade_opportunities")
        .insert({
          product_name: p.product_name,
          category: p.category,
          unit_cost_zar: cost,
          suggested_selling_price_zar: sellPrice,
          moq_required: p.final_moq ?? 100,
          expected_margin_percentage: Math.round(margin),
          supplier_name: "china_supplier",
          supplier_country: "CN",
          is_spotlight: true,
          spotlight_rank: nextRank,
          spotlight_title: `New: ${p.product_name}`,
          group_buy_status: "open",
          stock_quantity: 99999,
          is_approved_for_ai_recommendation: true,
        })
        .select("id")
        .single();
      if (insErr) {
        console.error("insert opportunity failed for", p.id, insErr.message);
        continue;
      }
      const newId = (inserted as any).id as number;
      newIds.push(newId);
      nextRank++;

      const { error: updErr } = await supabase
        .from("product_discovery")
        .update({
          status: "published",
          backend_id: newId,
          is_published: true,
          date_published: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (updErr) console.error("update product_discovery failed for", p.id, updErr.message);
      else publishedDetails.push({ id: newId, product_name: p.product_name, final_moq: p.final_moq, final_supplier_price_zar: cost });
    }

    const emailResult = await notifyIdara(publishedDetails);

    const summary = {
      success: true,
      products_published: publishedDetails.length,
      new_backend_ids: newIds,
      email: emailResult,
      timestamp: new Date().toISOString(),
      message: `${publishedDetails.length} confirmed products published to spark_trade_opportunities`,
    };
    console.log("publish-confirmed-products summary:", summary);
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-confirmed-products error:", e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
