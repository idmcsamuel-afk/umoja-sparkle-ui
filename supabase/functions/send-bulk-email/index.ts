// Bulk email sender for admin broadcasts — with batching & per-campaign dedup.
// Sends to members with a valid email via Resend.
// Actions:
//   { preview: true, subject, campaign_id?, batch_size? }
//     → { total, already_sent, remaining, next_batch_size, campaign_id }
//   { subject, body, campaign_id?, batch_size?, throttle_ms? }
//     → sends up to batch_size members who haven't received this campaign yet.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "UMOJA <hello@umojarise.com>";
const REPLY_TO = "support@umojarise.com";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const DEFAULT_BATCH = 100;
const DEFAULT_THROTTLE_MS = 600; // ~100 sends/minute
const MAX_BATCH = 500;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function isAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token || token === ANON_KEY) return false;
  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return false;
    const { data: row } = await sb.from("admin_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
    return !!row;
  } catch { return false; }
}

function wrap(subject: string, bodyHtml: string, unsubUrl: string) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f1ec;font-family:Arial,sans-serif;color:#1c1c1c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(8,43,33,0.08);">
      <tr><td style="background:linear-gradient(135deg,#0f3d2e 0%,#082b21 100%);padding:24px 28px;">
        <div style="font-family:Georgia,serif;font-size:22px;color:#d4a857;letter-spacing:2px;font-weight:700;">UMOJA</div>
        <div style="color:#cfd8d2;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Community wealth · South Africa</div>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 14px;font-size:22px;color:#0f3d2e;">${subject}</h1>
        <div style="font-size:15px;line-height:1.55;">${bodyHtml}</div>
      </td></tr>
      <tr><td style="padding:20px 28px;border-top:1px solid #eee;color:#888;font-size:12px;line-height:1.6;">
        <strong style="color:#0f3d2e;">UMOJA</strong> — <a href="https://umojarise.com" style="color:#0f3d2e;">umojarise.com</a><br>
        You're receiving this because you're a member of UMOJA.<br>
        <a href="${unsubUrl}" style="color:#0f3d2e;">Unsubscribe from marketing emails</a> ·
        <a href="mailto:unsubscribe@umojarise.com?subject=unsubscribe" style="color:#0f3d2e;">Email opt-out</a>
      </td></tr>
    </table></body></html>`;
}

function personalize(text: string, fullName: string | null | undefined) {
  const first = (fullName ?? "").trim().split(/\s+/)[0] || "there";
  const name = (fullName ?? "").trim() || "there";
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*name\s*\}\}/gi, name);
}

async function fetchValidMembers() {
  const { data, error } = await sb.from("members")
    .select("id, email, full_name")
    .not("email", "is", null).neq("email", "");
  if (error) throw error;
  const valid = (data ?? []).filter((m: any) => typeof m.email === "string" && EMAIL_REGEX.test(m.email));
  const { data: unsubs } = await sb.from("email_unsubscribes").select("email");
  const blocked = new Set((unsubs ?? []).map((u: any) => String(u.email).toLowerCase()));
  return valid.filter((m: any) => !blocked.has(String(m.email).toLowerCase()));
}

// Members already sent this campaign (status=sent, subject=campaign_id).
async function fetchAlreadySentEmails(campaignId: string): Promise<Set<string>> {
  const sent = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb.from("email_log")
      .select("recipient_email")
      .eq("subject", campaignId)
      .eq("status", "sent")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const r of data ?? []) sent.add(String(r.recipient_email).toLowerCase());
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!await isAdmin(req)) {
      return new Response(JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = await req.json();
    const { subject, body, preview } = payload;
    const campaignId: string = (payload.campaign_id || subject || "").toString().trim();
    const batchSize = Math.max(1, Math.min(MAX_BATCH, Number(payload.batch_size) || DEFAULT_BATCH));
    const throttleMs = Math.max(0, Math.min(10000, Number(payload.throttle_ms ?? DEFAULT_THROTTLE_MS)));

    if (!campaignId) throw new Error("subject (or campaign_id) required");

    const members = await fetchValidMembers();
    const alreadySent = await fetchAlreadySentEmails(campaignId);
    const remaining = members.filter((m: any) => !alreadySent.has(String(m.email).toLowerCase()));

    if (preview) {
      return new Response(JSON.stringify({
        count: members.length,
        total: members.length,
        already_sent: alreadySent.size,
        remaining: remaining.length,
        next_batch_size: Math.min(batchSize, remaining.length),
        campaign_id: campaignId,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!body) throw new Error("body required");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const batch = remaining.slice(0, batchSize);
    const unsubBase = `${SUPABASE_URL}/functions/v1/email-unsubscribe`;
    console.log(`[Bulk Email] Campaign="${campaignId}" batch=${batch.length}/${remaining.length} remaining (total ${members.length}, throttle=${throttleMs}ms)`);

    let sent = 0, failed = 0;
    const failedEmails: string[] = [];

    for (let i = 0; i < batch.length; i++) {
      const m = batch[i];
      try {
        const unsubUrl = `${unsubBase}?email=${encodeURIComponent(m.email)}`;
        const personalizedSubject = personalize(subject, m.full_name);
        const personalizedBody = personalize(String(body), m.full_name).replace(/\n/g, "<br>");
        const html = wrap(personalizedSubject, personalizedBody, unsubUrl);
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM,
            to: [m.email],
            reply_to: REPLY_TO,
            subject: personalizedSubject,
            html,
            headers: {
              "List-Unsubscribe": `<${unsubUrl}>, <mailto:unsubscribe@umojarise.com?subject=unsubscribe%20${encodeURIComponent(m.email)}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              "List-Id": "UMOJA Marketing <marketing.umojarise.com>",
              "Precedence": "bulk",
            },
          }),
        });
        const out = await r.json();
        if (!r.ok) throw new Error(out?.message || `Resend ${r.status}`);
        // IMPORTANT: log with subject=campaignId so future batches dedup correctly.
        await sb.from("email_log").insert({
          recipient_email: m.email, recipient_member: m.id,
          template: "custom", subject: campaignId, status: "sent", resend_id: out?.id ?? null,
        });
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Bulk Email] Failed ${m.email}:`, msg);
        await sb.from("email_log").insert({
          recipient_email: m.email, recipient_member: m.id,
          template: "custom", subject: campaignId, status: "failed", error: msg,
        });
        failed++; failedEmails.push(m.email);
      }
      if (throttleMs > 0 && i < batch.length - 1) {
        await new Promise((res) => setTimeout(res, throttleMs));
      }
    }

    const remainingAfter = remaining.length - sent;
    console.log(`[Bulk Email] Batch complete: ${sent} sent, ${failed} failed, ${remainingAfter} remaining`);
    return new Response(JSON.stringify({
      sent, failed, failedEmails,
      total: members.length,
      already_sent: alreadySent.size + sent,
      remaining: Math.max(0, remainingAfter),
      batch_size: batch.length,
      campaign_id: campaignId,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Bulk Email] Error:", msg);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
