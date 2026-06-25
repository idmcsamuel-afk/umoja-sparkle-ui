// Queue high-margin discovered products for the supplier office.
// Runs daily at 02:00 UTC.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPPLIER_EMAIL = Deno.env.get("SUPPLIER_OFFICE_EMAIL") ?? "idmcsamuel@gmail.com";
const SUPPLIER_DASHBOARD_URL =
  Deno.env.get("SUPPLIER_DASHBOARD_URL") ?? "https://umojarise.com/admin/supplier-dashboard";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function buildCsv(rows: any[]): string {
  const header = "product_name,category,est_sell_price,est_cost,margin_pct";
  const lines = rows.map((r) => {
    const name = String(r.product_name ?? "").replace(/,/g, " ");
    const cat = String(r.category ?? "").replace(/,/g, " ");
    return [name, cat, r.amazon_price_zar ?? "", r.china_api_price_zar ?? "", r.estimated_margin_pct ?? ""].join(",");
  });
  return [header, ...lines].join("\n");
}

async function sendSupplierEmail(csv: string, count: number) {
  const subject = `${count} Products Pending MOQ/Price Response - ${new Date().toISOString().slice(0, 10)}`;
  const body = `Hi Supplier Team,

Please respond to the following ${count} products with:
- MOQ (minimum order quantity)
- Final negotiated price (ZAR)
- Lead time (days)

Use the Supplier Dashboard to confirm: ${SUPPLIER_DASHBOARD_URL}

CSV attached.`;
  if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
    console.log("[email skipped: RESEND_API_KEY not configured]", { subject, to: SUPPLIER_EMAIL });
    return { skipped: true };
  }
  const attachment = btoa(csv);
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: "Umoja Supplier <notify@umojarise.com>",
      to: [SUPPLIER_EMAIL],
      subject,
      text: body,
      attachments: [{ filename: "pending-products.csv", content: attachment }],
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { data: products, error } = await supabase
      .from("product_discovery")
      .select("id, product_name, category, amazon_price_zar, china_api_price_zar, estimated_margin_pct")
      .eq("status", "discovered")
      .gt("estimated_margin_pct", 30)
      .order("estimated_margin_pct", { ascending: false });
    if (error) throw error;

    if (!products || products.length === 0) {
      console.log("No products to queue");
      return new Response(JSON.stringify({ success: true, products_queued: 0, message: "No products to queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csv = buildCsv(products);
    const emailResult = await sendSupplierEmail(csv, products.length);

    const ids = products.map((p) => p.id);
    const { error: upErr } = await supabase
      .from("product_discovery")
      .update({ status: "queued_for_supplier", date_sent_to_supplier: new Date().toISOString() })
      .in("id", ids);
    if (upErr) throw upErr;

    const totalMarginValue = products.reduce(
      (s, p) =>
        s +
        (Number(p.amazon_price_zar ?? 0) - Number(p.china_api_price_zar ?? 0)),
      0,
    );

    const summary = {
      success: true,
      products_queued: products.length,
      total_margin_value: totalMarginValue,
      email: emailResult,
      timestamp: new Date().toISOString(),
      message: `${products.length} products queued for supplier response`,
    };
    console.log("queue-products-for-supplier summary:", summary);
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("queue-products-for-supplier error:", e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
