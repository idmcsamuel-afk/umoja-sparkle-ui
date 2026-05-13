// Verifies a Paystack transaction by reference and applies it to the right
// domain object based on the reference prefix:
//   CIRCLE-<tier>-<membercode>-<ts>     → circle_bids row (most recent for this member+tier)
//   PROP-<property_id>-<membercode>-<ts>→ reit_units row (most recent for this member+property)
//   DRIVE-<tier>-<membercode>-<ts>      → drive_members (latest for this member)
//   BC-<tier>-<membercode>-<ts>         → members.buyers_club_*
//
// Auth: requires a signed-in member's JWT (caller must own the row).
// Server-side it then uses the service role to flip the row to active.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE);

async function paystackVerify(reference: string) {
  const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  const json = await r.json();
  if (!r.ok || !json?.status) throw new Error(json?.message || `Paystack ${r.status}`);
  return json.data;
}

async function applyToCircle(userId: string, tier: string, ref: string, amountZar: number) {
  // Find the most recent pending/active bid for this member+tier
  const { data: bid } = await sb
    .from("circle_bids")
    .select("id")
    .eq("member_id", userId)
    .eq("tier", tier)
    .in("status", ["pending", "payment_pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!bid) throw new Error("No pending circle bid found for this member/tier");
  await sb.from("circle_bids").update({
    status: "active",
    payment_method: "paystack",
    paystack_reference: ref,
    payment_reference: ref,
    payment_confirmed_at: new Date().toISOString(),
  }).eq("id", bid.id);
  return { kind: "circle", row_id: bid.id };
}

async function applyToProperty(userId: string, propertyId: string, ref: string) {
  const { data: row } = await sb
    .from("reit_units")
    .select("id")
    .eq("member_id", userId)
    .eq("property_id", propertyId)
    .eq("status", "payment_pending")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) throw new Error("No pending property investment found");
  await sb.from("reit_units").update({
    status: "active",
    payment_method: "paystack",
    paystack_reference: ref,
    payment_reference: ref,
    confirmed_at: new Date().toISOString(),
  }).eq("id", row.id);
  return { kind: "property", row_id: row.id };
}

async function applyToBuyersClub(userId: string, tier: string, ref: string) {
  await sb.from("members").update({
    has_buyers_club_access: true,
    buyers_club_status: "active",
    buyers_club_tier: tier,
    buyers_club_payment_method: "paystack",
    paystack_reference: ref,
    buyers_club_approved_at: new Date().toISOString(),
    buyers_club_started_at: new Date().toISOString(),
    buyers_club_renewal_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
  }).eq("id", userId);
  await sb.from("notifications").insert({
    member_id: userId,
    title: "Buyers Club active 🎉",
    body: `Welcome — your ${tier} membership is live.`,
    kind: "buyers_club",
    link: "/dashboard",
  });
  return { kind: "buyers_club" };
}

async function applyToDrive(userId: string, ref: string) {
  const { data: m } = await sb
    .from("drive_members")
    .select("id")
    .eq("member_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!m) throw new Error("No drive membership found");
  await sb.from("drive_members").update({
    payment_method: "paystack",
    paystack_reference: ref,
    payment_ref: ref,
    status: "active",
  }).eq("id", m.id);
  return { kind: "drive", row_id: m.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ ok: false, error: "auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { reference } = await req.json();
    if (!reference || typeof reference !== "string") throw new Error("reference required");

    const tx = await paystackVerify(reference);
    if (tx.status !== "success") {
      return new Response(JSON.stringify({ ok: false, error: `Paystack status=${tx.status}` }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountZar = Number(tx.amount) / 100;
    const parts = String(reference).split("-");
    const prefix = parts[0];
    let result: any;
    if (prefix === "CIRCLE") {
      result = await applyToCircle(u.user.id, parts[1], reference, amountZar);
    } else if (prefix === "PROP") {
      result = await applyToProperty(u.user.id, parts[1], reference);
    } else if (prefix === "BC" || prefix === "CLUB") {
      result = await applyToBuyersClub(u.user.id, parts[1] || "bronze", reference);
    } else if (prefix === "DRIVE") {
      result = await applyToDrive(u.user.id, reference);
    } else {
      throw new Error(`unknown reference prefix: ${prefix}`);
    }

    await sb.from("paystack_events").insert({
      event: "manual.verify",
      reference,
      member_id: u.user.id,
      raw: tx,
      processed: true,
    });

    return new Response(JSON.stringify({ ok: true, amount: amountZar, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
