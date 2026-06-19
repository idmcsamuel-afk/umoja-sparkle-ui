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
import { formatCurrencyForMember, fetchMemberCountry } from "../_shared/format-currency.ts";

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

async function applyToDrive(
  userId: string,
  ref: string,
  amountZar: number,
  enrollmentId?: string,
) {
  // Find target enrollment: prefer explicit metadata, else most recent active for member
  let enrId = enrollmentId;
  if (!enrId) {
    const { data: enr } = await sb
      .from("drive_enrollments")
      .select("id")
      .eq("member_id", userId)
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    enrId = enr?.id;
  }
  if (!enrId) return { kind: "drive", applied: false, reason: "no_drive_enrollment" };

  // Idempotency: if this reference is already recorded, skip
  const { data: existing } = await sb
    .from("drive_contributions")
    .select("id")
    .eq("payment_ref", ref)
    .maybeSingle();
  if (existing) return { kind: "drive", applied: true, row_id: existing.id, reason: "already_recorded" };

  const { data: enr } = await sb
    .from("drive_enrollments")
    .select("id, member_id, total_contributed, weeks_contributed, weeks_paid_on_time")
    .eq("id", enrId)
    .maybeSingle();
  if (!enr || enr.member_id !== userId) {
    return { kind: "drive", applied: false, reason: "enrollment_not_owned" };
  }

  const { data: lastWk } = await sb
    .from("drive_contributions")
    .select("week_number")
    .eq("enrollment_id", enrId)
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextWeek = (lastWk?.week_number ?? 0) + 1;

  const ins = await sb.from("drive_contributions").insert({
    enrollment_id: enrId,
    member_id: userId,
    amount: amountZar,
    week_number: nextWeek,
    payment_date: new Date().toISOString().slice(0, 10),
    is_on_time: true,
    payment_method: "paystack",
    payment_ref: ref,
    status: "completed",
  }).select("id").maybeSingle();
  if (ins.error) return { kind: "drive", applied: false, error: ins.error.message };

  await sb.from("drive_enrollments").update({
    total_contributed: Number(enr.total_contributed) + amountZar,
    weeks_contributed: (enr.weeks_contributed ?? 0) + 1,
    weeks_paid_on_time: (enr.weeks_paid_on_time ?? 0) + 1,
    status: "active",
  }).eq("id", enrId);

  await sb.rpc("calculate_drive_score", { p_enrollment_id: enrId });

  const memberCountry = await fetchMemberCountry(sb, userId);
  const localAmount = formatCurrencyForMember(amountZar, memberCountry);
  await sb.from("notifications").insert({
    member_id: userId,
    title: "Drive payment confirmed ✓",
    body: `Week ${nextWeek} payment of ${localAmount} received. Score updated.`,
    kind: "drive",
    link: "/drive/dashboard",
  });

  return { kind: "drive", applied: true, row_id: ins.data?.id, week: nextWeek };
}

async function applyToSparkTradeSubscription(
  userId: string,
  tier: string,
  ref: string,
  amountZar: number,
  localAmount?: number,
  localCcy?: string,
) {
  const nextPayment = new Date();
  nextPayment.setMonth(nextPayment.getMonth() + 1);
  const upd = await sb.from("members").update({
    spark_trade_subscription_tier: tier,
    spark_trade_subscription_payment_status: "paid",
    spark_trade_subscription_paid_at: new Date().toISOString(),
    spark_trade_paystack_reference: ref,
    spark_trade_onboarding_complete: true,
    spark_trade_onboarding_completed_at: new Date().toISOString(),
  } as any).eq("id", userId);
  if (upd.error) return { kind: "spark_trade_subscription", applied: false, error: upd.error.message };

  const pmTier = tier.replace(/-/g, "_");
  await sb.from("product_memberships").upsert({
    user_id: userId,
    product: "spark_trade",
    tier: pmTier,
    status: "active",
    membership_start_date: new Date().toISOString(),
    next_payment_date: nextPayment.toISOString(),
    paystack_reference: ref,
    payment_status: "success",
    amount_paid_zar: amountZar,
    amount_local_currency: localAmount ?? amountZar,
    local_currency_code: localCcy ?? "ZAR",
  } as any, { onConflict: "user_id,product" });

  await sb.from("spark_trade_subscriptions").upsert(
    { member_id: userId, tier, status: "active" } as any,
    { onConflict: "member_id" },
  );

  await sb.from("notifications").insert({
    member_id: userId,
    title: "Spark Trade activated 🎉",
    body: `Welcome — your ${tier} subscription is live.`,
    kind: "spark_trade",
    link: "/spark-trade/dashboard",
  });

  return { kind: "spark_trade_subscription", applied: true, tier };
}

async function applyToSparkTradeReservation(
  userId: string,
  ref: string,
  amountZar: number,
  opportunityId: number,
  units: number,
) {
  const { data: existing } = await sb
    .from("spark_trade_inventory_reservations")
    .select("id")
    .eq("payment_reference", ref)
    .maybeSingle();
  if (existing) {
    return { kind: "spark_trade_reservation", applied: true, row_id: (existing as any).id, reason: "already_recorded" };
  }

  const ins = await sb.from("spark_trade_inventory_reservations").insert({
    member_id: userId,
    opportunity_id: opportunityId,
    units_reserved: units,
    total_capital_allocated: amountZar,
    reservation_status: "paid",
    paid_at: new Date().toISOString(),
    payment_reference: ref,
  } as any).select("id").maybeSingle();

  if (ins.error) return { kind: "spark_trade_reservation", applied: false, error: ins.error.message };

  await sb.from("notifications").insert({
    member_id: userId,
    title: "Reservation confirmed ✓",
    body: `Your reservation of ${units} units is confirmed.`,
    kind: "spark_trade",
    link: "/spark-trade/dashboard",
  });

  return { kind: "spark_trade_reservation", applied: true, row_id: (ins.data as any)?.id };
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
      ? (metaPaymentType.includes("spark_trade_subscription") || metaPaymentType === "spark_trade_membership" ? "STSUB"
        : metaPaymentType.includes("spark_trade_reservation") || metaPaymentType.includes("inventory_reservation") ? "STRES"
        : metaPaymentType.includes("circle") ? "CIRCLE"
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
      else if (kind === "DRIVE") result = await applyToDrive(u.user.id, reference, amountZar, clientMeta.enrollment_id);
      else if (kind === "STSUB") result = await applyToSparkTradeSubscription(
        u.user.id,
        (metaTier || "buyers-club").toString(),
        reference,
        amountZar,
        clientMeta.amount_local_currency ? Number(clientMeta.amount_local_currency) : undefined,
        clientMeta.local_currency_code,
      );
      else if (kind === "STRES") {
        const oppId = Number(clientMeta.opportunity_id);
        const units = Number(clientMeta.units_reserved ?? clientMeta.units);
        if (!oppId || !units) result = { kind: "spark_trade_reservation", applied: false, reason: "missing_opportunity_or_units" };
        else result = await applyToSparkTradeReservation(u.user.id, reference, amountZar, oppId, units);
      }
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
      raw: { tx, result, clientMeta },
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
