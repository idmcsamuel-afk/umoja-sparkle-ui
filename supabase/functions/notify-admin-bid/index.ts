// Sends ONE admin email when a Circle bid enters the approval queue.
// Called by the DB trigger notify_admin_bid_needs_approval. Safe to call publicly:
// it only sends for bids that have a queued, unsent alert row and are payment_pending.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "UMOJA <hello@umojarise.com>";
const APP_URL = "https://umoja-sparkle-ui.lovable.app";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { bid_id } = await req.json().catch(() => ({}));
    if (typeof bid_id !== "string" || !UUID.test(bid_id)) return json({ error: "bid_id required" }, 400);

    // Claim the alert atomically (prevents duplicates even on retries)
    const { data: claimed } = await sb.from("circle_bid_admin_alerts")
      .update({ sent_at: new Date().toISOString() })
      .eq("bid_id", bid_id).is("sent_at", null).select("bid_id").maybeSingle();
    if (!claimed) return json({ skipped: "already sent or not queued" });

    const { data: bid } = await sb.from("circle_bids")
      .select("id, member_id, tier, fiat_amount, payment_reference, payment_submitted_at, status")
      .eq("id", bid_id).maybeSingle();
    if (!bid || bid.status !== "payment_pending") {
      await sb.from("circle_bid_admin_alerts").update({ error: "bid not pending" }).eq("bid_id", bid_id);
      return json({ skipped: "bid not pending" });
    }
    const [{ data: m }, { data: s }] = await Promise.all([
      sb.from("members").select("full_name, email").eq("id", bid.member_id).maybeSingle(),
      sb.from("platform_settings").select("admin_notification_emails").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const to = ((s?.admin_notification_emails as string[] | null) ?? []).filter(Boolean);
    if (!to.length) {
      await sb.from("circle_bid_admin_alerts").update({ error: "no admin recipients" }).eq("bid_id", bid_id);
      return json({ skipped: "no recipients" });
    }

    const tier = String(bid.tier ?? "").replace(/^./, (c) => c.toUpperCase());
    const amount = "R" + Math.round(Number(bid.fiat_amount ?? 0)).toLocaleString("en-ZA");
    const when = new Date(bid.payment_submitted_at ?? Date.now()).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) + " SAST";
    const link = `${APP_URL}/admin/circles?tab=pending&bid=${bid.id}`;
    const subject = `Bid needs approval: ${tier} ${amount} — ${m?.full_name ?? "Member"}`;
    const row = (k: string, v: string) => `<tr><td style="padding:6px 12px 6px 0;color:#666">${k}</td><td style="padding:6px 0"><strong>${esc(v)}</strong></td></tr>`;
    const html = `<div style="font-family:Arial,sans-serif;color:#1c1c1c;max-width:560px">
      <h2 style="color:#0f3d2e">A Circle bid is waiting for your approval</h2>
      <table>${row("Member", m?.full_name ?? "Member")}${row("Email", m?.email ?? "—")}${row("Tier", tier)}
      ${row("Reference", bid.payment_reference ?? "—")}${row("Amount", amount)}${row("Submitted", when)}</table>
      <p style="margin:24px 0"><a href="${link}" style="background:#d4a857;color:#1c1200;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700">Review this bid</a></p></div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    const out = await r.json().catch(() => ({}));
    await sb.from("circle_bid_admin_alerts").update({ recipients: to, error: r.ok ? null : JSON.stringify(out).slice(0, 500) }).eq("bid_id", bid_id);
    await sb.from("email_log").insert({
      template: "admin_bid_approval", recipient_email: to.join(","), subject,
      status: r.ok ? "sent" : "failed", resend_id: (out as { id?: string }).id ?? null,
      error: r.ok ? null : JSON.stringify(out).slice(0, 500), metadata: { bid_id },
    });
    return json({ ok: r.ok });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
