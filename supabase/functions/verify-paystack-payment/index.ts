// Verifies a Paystack transaction by reference and applies it to the right
// domain object based on the reference prefix:
//   CIRCLE-<tier>-<membercode>-<ts>     → circle_bids row
//   PROP-<property_id>-<membercode>-<ts>→ reit_units row
//   DRIVE-<tier>-<membercode>-<ts>      → drive_members row
//   BC-<tier>-<membercode>-<ts>         → members.buyers_club_*
//
// Resilient: if Paystack confirms the payment, we ALWAYS return 200 even if
// the row update fails — we just log and flag it for manual reconciliation.

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

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function paystackVerify(reference: string) {
  const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  const j = await r.json();
  console.log("[verify] paystack response", { ok: r.ok, status: j?.status, message: j?.message, txStatus: j?.data?.status });
  if (!r.ok || !j?.status) throw new Error(j?.message || `Paystack HTTP ${r.status}`);
  return j.data;
}

async function applyToCircle(userId: string, tier: string, ref: string) {
  const { data: bid, error } = await sb
    .from("circle_bids")
    .select("id,status")
    .eq("member_id", userId)
    .eq("tier", tier)
    .in("status", ["pending", "payment_pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log("[verify] circle bid lookup", { userId, tier, found: bid?.id, error: error?.message });
  if (!bid) return { kind: "circle", applied: false, reason: "no_pending_bid" };
  const upd = await sb.from("circle_bids").update({
    status: "active",
    payment_method: "paystack",
    paystack_reference: ref,
    payment_reference: ref,
    payment_confirmed_at: new Date().toISOString(),
  }).eq("id", bid.id);
  return { kind: "circle", applied: !upd.error, row_id: bid.id, error: upd.error?.message };
}

async function applyToProperty(userId: string, propertyId: string, ref: string) {
  const { data: row } = await sb
    .from("reit_units")
    .select("id")
    .eq("member_id", userId)
    .eq("property_id", propertyId)
    .in("status", ["payment_pending", "pending"])
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return { kind: "property", applied: false, reason: "no_pending_investment" };
  const upd = await sb.from("reit_units").update({
    status: "active",
    payment_method: "paystack",
    paystack_reference: ref,
    payment_reference: ref,
    confirmed_at: new Date().toISOString(),
  }).eq("id", row.id);
  return { kind: "property", applied: !upd.error, row_id: row.id, error: upd.error?.message };
}

async function applyToBuyersClub(userId: string, tier: string, ref: string) {
  const upd = await sb.from("members").update({
    has_buyers_club_access: true,
    buyers_club_status: "active",
    buyers_club_tier: tier,
    buyers_club_payment_method: "paystack",
    paystack_reference: ref,
    buyers_club_approved_at: new Date().toISOString(),
    buyers_club_started_at: new Date().toISOString(),
    buyers_club_renewal_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
  }).eq("id", userId);
  if (!upd.error) {
    await sb.from("notifications").insert({
      member_id: userId,
      title: "Buyers Club active 🎉",
      body: `Welcome — your ${tier} membership is live.`,
      kind: "buyers_club",
      link: "/dashboard",
    });
  }
  return { kind: "buyers_club", applied: !upd.error, error: upd.error?.message };
}

async function applyToDrive(userId: string, ref: string) {
  const { data: m } = await sb
    .from("drive_members")
    .select("id")
    .eq("member_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!m) return { kind: "drive", applied: false, reason: "no_drive_membership" };
  const upd = await sb.from("drive_members").update({
    payment_method: "paystack",
    paystack_reference: ref,
    payment_ref: ref,
    status: "active",
  }).eq("id", m.id);
  return { kind: "drive", applied: !upd.error, row_id: m.id, error: upd.error?.message };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!PAYSTACK_SECRET) {
      console.error("[verify] missing PAYSTACK_SECRET_KEY");
      return json(500, { ok: false, error: "PAYSTACK_SECRET_KEY not configured" });
    }

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u, error: authErr } = await userClient.auth.getUser();
    if (authErr || !u?.user) {
      console.error("[verify] auth failed", authErr?.message);
      return json(401, { ok: false, error: "auth required" });
    }

    const body = await req.json().catch(() => ({}));
    const reference = body?.reference;
    const clientMeta: Record<string, any> = (body?.metadata && typeof body.metadata === "object") ? body.metadata : {};
    if (!reference || typeof reference !== "string") {
      return json(400, { ok: false, error: "reference required" });
    }
    console.log("[verify] start", { user: u.user.id, reference, clientMeta });

    let tx: any;
    try {
      tx = await paystackVerify(reference);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[verify] paystack verify error", msg);
      return json(200, { ok: false, error: `Paystack verify failed: ${msg}`, reference });
    }

    if (tx.status !== "success") {
      console.warn("[verify] paystack tx not success", tx.status);
      return json(200, { ok: false, error: `Paystack status=${tx.status}`, reference });
    }

    const amountZar = Number(tx.amount) / 100;
    const parts = String(reference).split("-");
    const prefix = parts[0];
    // Prefer explicit client-provided metadata fields, fall back to reference parsing
    const metaPaymentType: string | undefined = clientMeta.payment_type;
    const metaMemberId: string | undefined = clientMeta.member_id;
    const metaTier: string | undefined = clientMeta.tier || clientMeta.circle_tier || clientMeta.buyers_club_tier;
    const metaPropertyId: string | undefined = clientMeta.property_id;
    // Auth user is the source of truth for security; only log mismatch
    if (metaMemberId && metaMemberId !== u.user.id) {
      console.warn("[verify] metadata member_id mismatch", { metaMemberId, authUser: u.user.id });
    }

    const kind = metaPaymentType
      ? (metaPaymentType.includes("circle") ? "CIRCLE"
        : metaPaymentType.includes("propert") || metaPaymentType.includes("reit") ? "PROP"
        : metaPaymentType.includes("buyers") || metaPaymentType.includes("club") ? "BC"
        : metaPaymentType.includes("drive") ? "DRIVE"
        : prefix)
      : prefix;

    let result: any = { kind: "unknown", applied: false };
    try {
      if (kind === "CIRCLE") result = await applyToCircle(u.user.id, metaTier || parts[1], reference);
      else if (kind === "PROP") result = await applyToProperty(u.user.id, metaPropertyId || parts[1], reference);
      else if (kind === "BC" || kind === "CLUB") result = await applyToBuyersClub(u.user.id, (metaTier || parts[1] || "bronze").toLowerCase(), reference);
      else if (kind === "DRIVE") result = await applyToDrive(u.user.id, reference);
      else result = { kind: "unknown", applied: false, reason: `unknown_prefix:${prefix}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[verify] apply error", msg);
      result = { kind, applied: false, error: msg };
    }
    console.log("[verify] apply result", result);

    await sb.from("paystack_events").insert({
      event: "manual.verify",
      reference,
      member_id: u.user.id,
      raw: { tx, result },
      processed: !!result.applied,
      error: result.applied ? null : (result.error || result.reason || "not_applied"),
    });

    // Always 200 if Paystack confirmed success — frontend treats !ok as soft warning
    return json(200, { ok: true, amount: amountZar, reference, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[verify] fatal", msg);
    return json(500, { ok: false, error: msg });
  }
});
