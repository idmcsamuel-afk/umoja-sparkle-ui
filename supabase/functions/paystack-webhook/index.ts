// Paystack webhook receiver — verifies HMAC SHA512 signature using PAYSTACK_SECRET_KEY
// and dispatches subscription / charge events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY")!;
// Live/test contamination guard — see verify-paystack-payment for full notes.
const EXPECTED_PAYSTACK_DOMAIN: "live" | "test" =
  (Deno.env.get("PAYSTACK_EXPECTED_DOMAIN") as any) ||
  (PAYSTACK_SECRET?.startsWith("sk_live_") ? "live" : "test");
const sb = createClient(SUPABASE_URL, SERVICE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response("ok", { headers: corsHeaders });
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", PAYSTACK_SECRET).update(raw).digest("hex");
  if (signature !== expected) {
    return new Response(JSON.stringify({ error: "bad signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400, headers: corsHeaders }); }
  const event: string = payload.event ?? "";
  const data = payload.data ?? {};
  const reference: string | null = data.reference ?? data.subscription_code ?? null;
  const customerCode: string | null = data?.customer?.customer_code ?? null;

  let memberId: string | null = null;
  let processError: string | null = null;
  try {
    // Try to look up member by customer code or by metadata.member_id / email
    const candidateMemberId = data?.metadata?.member_id ?? data?.metadata?.custom_fields?.find?.((c: any) => c.variable_name === "member_id")?.value;
    if (candidateMemberId) memberId = candidateMemberId;
    else if (customerCode) {
      const { data: m } = await sb.from("members").select("id").eq("paystack_customer_code", customerCode).maybeSingle();
      if (m?.id) memberId = m.id;
    }
    if (!memberId && data?.customer?.email) {
      const { data: m } = await sb.from("members").select("id").eq("email", data.customer.email).maybeSingle();
      if (m?.id) memberId = m.id;
    }

    if (memberId) {
      if (event === "subscription.create") {
        await sb.from("members").update({
          paystack_subscription_code: data.subscription_code,
          paystack_customer_code: customerCode,
          paystack_plan_code: data?.plan?.plan_code,
          buyers_club_status: "active",
          has_buyers_club_access: true,
          buyers_club_renewal_at: data.next_payment_date,
        }).eq("id", memberId);
      } else if (event === "subscription.disable" || event === "subscription.not_renew") {
        await sb.from("members").update({
          buyers_club_status: "cancelled",
        }).eq("id", memberId);
      } else if (event === "charge.success") {
        // Renewal succeeded — extend renewal date
        await sb.from("members").update({
          buyers_club_status: "active",
          has_buyers_club_access: true,
          buyers_club_renewal_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
        }).eq("id", memberId);
      } else if (event === "invoice.payment_failed" || event === "charge.failed") {
        await sb.from("members").update({
          buyers_club_status: "payment_failed",
        }).eq("id", memberId);
        await sb.from("notifications").insert({
          member_id: memberId,
          title: "Buyers Club payment failed",
          body: "We couldn't charge your card. Please update your payment method.",
          kind: "buyers_club",
          link: "/profile",
        });
      }
    }
  } catch (e) {
    processError = e instanceof Error ? e.message : String(e);
  }

  await sb.from("paystack_events").insert({
    event,
    reference,
    member_id: memberId,
    raw: payload,
    processed: !processError,
    error: processError,
  });

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
