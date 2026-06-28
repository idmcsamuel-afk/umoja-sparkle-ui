// UMOJA email sender via Resend.
// Templates: welcome, referral_success, payment_verified, allocation_winner,
// kyc_approved, kyc_rejected, custom (admin blast).
// Logs every send to public.email_log and respects members.email_preferences for non-critical kinds.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM = "UMOJA <hello@umojarise.com>";
const REPLY_TO = "support@umojarise.com";
const APP_URL = "https://umoja-sparkle-ui.lovable.app";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ---- branded layout ---------------------------------------------------------
const GREEN = "#0f3d2e";
const GREEN_DARK = "#082b21";
const GOLD = "#d4a857";
const TEXT = "#1c1c1c";

function shell(title: string, inner: string, ctaLabel?: string, ctaUrl?: string) {
  const button = ctaLabel && ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
         <tr><td bgcolor="${GOLD}" style="border-radius:12px;">
           <a href="${ctaUrl}" style="display:inline-block;padding:14px 26px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#1c1200;text-decoration:none;border-radius:12px;">${ctaLabel}</a>
         </td></tr>
       </table>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
  <body style="margin:0;padding:0;background:#f3f1ec;font-family:Arial,Helvetica,sans-serif;color:${TEXT};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f1ec;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(8,43,33,0.08);">
          <tr><td style="background:linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%);padding:24px 28px;">
            <div style="font-family:Georgia,serif;font-size:22px;color:${GOLD};letter-spacing:2px;font-weight:700;">UMOJA</div>
            <div style="color:#cfd8d2;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Community wealth · South Africa</div>
          </td></tr>
          <tr><td style="padding:28px 28px 8px;">
            <h1 style="margin:0 0 14px;font-size:22px;color:${GREEN};font-weight:700;">${title}</h1>
            <div style="font-size:15px;line-height:1.55;color:${TEXT};">${inner}</div>
            ${button}
          </td></tr>
          <tr><td style="padding:24px 28px 28px;border-top:1px solid #eee;color:#888;font-size:12px;line-height:1.6;">
            Have questions? Reply to this email or contact us at
            <a href="mailto:${REPLY_TO}" style="color:${GREEN};">${REPLY_TO}</a>.<br><br>
            <strong style="color:${GREEN};">UMOJA</strong> — Community Wealth Platform<br>
            <a href="https://umojarise.com" style="color:${GREEN};">umojarise.com</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );

// Sanitize a small allowlist of safe HTML for the `custom` admin template.
// Strips <script>/<style>, on* event handlers, and javascript:/data: URLs.
function sanitizeHtml(input: string): string {
  let s = String(input ?? "");
  // Drop dangerous blocks entirely (including content)
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "");
  // Strip inline event handlers: onclick=, onerror=, etc.
  s = s.replace(/\son[a-z]+\s*=\s*"(?:[^"\\]|\\.)*"/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*'(?:[^'\\]|\\.)*'/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  // Neutralize dangerous URL schemes in href/src
  s = s.replace(/(href|src)\s*=\s*"(\s*(?:javascript|data|vbscript):[^"]*)"/gi, '$1="#"');
  s = s.replace(/(href|src)\s*=\s*'(\s*(?:javascript|data|vbscript):[^']*)'/gi, "$1='#'");
  return s;
}

function safeUrl(u: unknown): string | undefined {
  if (!u) return undefined;
  const str = String(u).trim();
  if (!/^https?:\/\//i.test(str)) return undefined;
  // HTML-escape for safe attribute interpolation
  return esc(str);
}

type TemplateName =
  | "welcome"
  | "referral_success"
  | "payment_verified"
  | "allocation_winner"
  | "kyc_approved"
  | "kyc_rejected"
  | "kyc_reminder"
  | "contact_form"
  | "custom";

const CRITICAL: TemplateName[] = [
  "payment_verified",
  "allocation_winner",
  "kyc_approved",
  "kyc_rejected",
  "kyc_reminder",
  "contact_form",
];

const PREF_MAP: Record<string, "circle" | "spark_trade" | "marketing" | "weekly_digest" | null> = {
  welcome: null,
  referral_success: "marketing",
  custom: "marketing",
  payment_verified: null,
  allocation_winner: null,
  kyc_approved: null,
  kyc_rejected: null,
  kyc_reminder: null,
  contact_form: null,
};

function buildEmail(template: TemplateName, data: Record<string, any>) {
  const name = esc(data.name ?? "Member");
  switch (template) {
    case "welcome": {
      const code = esc(data.referral_code ?? "");
      const link = `${APP_URL}/signup?ref=${encodeURIComponent(code)}`;
      const subject = "Welcome to UMOJA 🎉";
      const html = shell(
        `Sawubona ${name}! 🎉`,
        `<p>You've joined <strong>South Africa's most powerful community wealth platform</strong>.</p>
         <p style="margin-top:18px;"><strong>Your member code:</strong> <span style="color:${GREEN};font-family:monospace;">${code || "—"}</span></p>
         <p><strong>Your referral link:</strong><br><a href="${link}" style="color:${GREEN};word-break:break-all;">${link}</a></p>
         <p style="margin-top:18px;background:#f6efdc;border-left:4px solid ${GOLD};padding:12px 14px;border-radius:8px;">
           ✨ <strong>50 Sparks</strong> have been credited to your account.
         </p>`,
        "Explore Dashboard",
        `${APP_URL}/dashboard`,
      );
      return { subject, html };
    }
    case "referral_success": {
      const subject = "You earned 200 Sparks! 🎁";
      const html = shell(
        "You earned 200 Sparks 🎁",
        `<p><strong>${name}</strong> joined UMOJA using your referral link.</p>
         <p style="background:#f6efdc;border-left:4px solid ${GOLD};padding:12px 14px;border-radius:8px;">
           +200 Sparks added to your account.
         </p>
         <p>Total referrals so far: <strong>${esc(data.total_referrals ?? 0)}</strong></p>`,
        "View Referrals",
        `${APP_URL}/referrals`,
      );
      return { subject, html };
    }
    case "payment_verified": {
      const subject = "Payment confirmed - Bid is active ✅";
      const html = shell(
        "Payment confirmed ✅",
        `<p>Your <strong>R${esc(data.amount)}</strong> payment for <strong>${esc(data.circle_name)}</strong> is verified.</p>
         <ul style="line-height:1.8;padding-left:18px;">
           <li>Bid status: <strong style="color:${GREEN};">Active in queue</strong></li>
           <li>Priority score: <strong>${esc(data.score ?? "—")}</strong></li>
           <li>Current rank: <strong>#${esc(data.rank ?? "—")} of ${esc(data.total ?? "—")}</strong></li>
         </ul>`,
        "Check Queue Position",
        `${APP_URL}/circle`,
      );
      return { subject, html };
    }
    case "allocation_winner": {
      const subject = "🏆 Congratulations - You won this round!";
      const html = shell(
        "🏆 You won this round!",
        `<p>You've been selected for payout!</p>
         <ul style="line-height:1.8;padding-left:18px;">
           <li>Circle: <strong>${esc(data.circle_name)}</strong></li>
           <li>Payout amount: <strong style="color:${GREEN};">R${esc(data.amount)}</strong></li>
           <li>Priority score: <strong>${esc(data.score ?? "—")}</strong></li>
           <li>Payout date: <strong>${esc(data.payout_date ?? "Soon")}</strong></li>
         </ul>`,
        "View Details",
        `${APP_URL}/circle`,
      );
      return { subject, html };
    }
    case "kyc_approved": {
      const subject = "Verification complete ✅";
      const html = shell(
        "Verification complete ✅",
        `<p>Your KYC verification is <strong>approved</strong>.</p>
         <ul style="line-height:1.8;padding-left:18px;">
           <li>You can now receive payouts</li>
           <li>Level 3 verification unlocked</li>
         </ul>`,
        "View Dashboard",
        `${APP_URL}/dashboard`,
      );
      return { subject, html };
    }
    case "kyc_rejected": {
      const subject = "Action required - Verification";
      const html = shell(
        "Action required",
        `<p>Your KYC submission needs attention.</p>
         <p style="background:#fdecec;border-left:4px solid #c0392b;padding:12px 14px;border-radius:8px;">
           <strong>Reason:</strong> ${esc(data.reason ?? "Please contact support.")}
         </p>
         <p>Please resubmit with the correct documents.</p>`,
        "Upload Documents",
        `${APP_URL}/kyc`,
      );
      return { subject, html };
    }
    case "kyc_reminder": {
      const subject = "Complete Your UMOJA Verification";
      const missing: string[] = Array.isArray(data.missing) ? data.missing : [];
      const items = missing.length
        ? missing.map((m) => `<li style="margin:6px 0;">☐ ${esc(m)}</li>`).join("")
        : `<li>☐ Finish your remaining KYC steps</li>`;
      const html = shell(
        `Hi ${name},`,
        `<p>Your KYC verification is incomplete. Please complete these steps to unlock payouts and full platform features:</p>
         <ul style="line-height:1.8;padding-left:18px;list-style:none;">${items}</ul>
         <p style="margin-top:16px;">Once complete, you can receive payouts and access full platform features.</p>
         <p style="color:#666;font-size:13px;">Questions? Reply to this email.</p>`,
        "Complete Verification",
        `${APP_URL}/profile?tab=kyc`,
      );
      return { subject, html };
    }
    case "contact_form": {
      const subject = `Contact form: ${esc(data.subject ?? "New message")}`;
      const html = shell(
        "New contact form submission",
        `<p><strong>From:</strong> ${esc(data.from_name)} &lt;${esc(data.from_email)}&gt;</p>
         <p><strong>Message:</strong></p>
         <p style="background:#f6efdc;border-left:4px solid ${GOLD};padding:12px 14px;border-radius:8px;white-space:pre-wrap;">${esc(data.message)}</p>`,
      );
      return { subject, html };
    }
    case "custom": {
      const subject = String(data.subject ?? "A message from UMOJA");
      const body = sanitizeHtml(String(data.body_html ?? ""));
      const safeCtaUrl = safeUrl(data.cta_url);
      const safeCtaLabel = data.cta_label ? esc(data.cta_label) : undefined;
      const html = shell(esc(data.title ?? subject), body, safeCtaLabel, safeCtaUrl);
      return { subject, html };
    }
  }
}

async function sendOne(args: {
  template: TemplateName;
  to: string;
  data: Record<string, any>;
  member_id?: string | null;
  blast_id?: string | null;
  bypass_prefs?: boolean;
}) {
  const { template, to, data, member_id, blast_id, bypass_prefs } = args;

  // Preference gate (non-critical only)
  const prefKey = PREF_MAP[template];
  if (prefKey && !bypass_prefs && member_id) {
    const { data: m } = await sb
      .from("members")
      .select("email_preferences")
      .eq("id", member_id)
      .maybeSingle();
    const prefs = (m?.email_preferences ?? {}) as Record<string, boolean>;
    if (prefs[prefKey] === false) {
      await sb.from("email_log").insert({
        recipient_email: to,
        recipient_member: member_id,
        template,
        subject: "(suppressed by member preference)",
        status: "suppressed",
        blast_id,
      });
      return { ok: true, suppressed: true };
    }
  }

  const built = buildEmail(template, data);
  if (!built) return { ok: false, error: "unknown_template" };

  const { data: logRow } = await sb
    .from("email_log")
    .insert({
      recipient_email: to,
      recipient_member: member_id ?? null,
      template,
      subject: built.subject,
      status: "pending",
      blast_id: blast_id ?? null,
    })
    .select("id")
    .single();

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: REPLY_TO,
        subject: built.subject,
        html: built.html,
      }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body?.message || `Resend ${r.status}`);
    if (logRow?.id) {
      await sb.from("email_log").update({ status: "sent", resend_id: body?.id ?? null }).eq("id", logRow.id);
    }
    return { ok: true, id: body?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (logRow?.id) {
      await sb.from("email_log").update({ status: "failed", error: msg }).eq("id", logRow.id);
    }
    return { ok: false, error: msg };
  }
}

const ANON_ALLOWED_TEMPLATES = new Set<TemplateName>(["contact_form"]);
const ADMIN_ONLY_TEMPLATES = new Set<TemplateName>(["custom"]);
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function getCaller(req: Request): Promise<{ user_id: string | null; is_admin: boolean }> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  // Treat the public anon key as "no user" — supabase-js attaches it by default.
  if (!token || token === ANON_KEY) return { user_id: null, is_admin: false };
  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return { user_id: null, is_admin: false };
    const { data: isAdm } = await sb
      .from("admin_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
    return { user_id: u.user.id, is_admin: !!isAdm };
  } catch {
    return { user_id: null, is_admin: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body.action ?? "send";
    const caller = await getCaller(req);

    const forbid = (msg = "forbidden") =>
      new Response(JSON.stringify({ ok: false, error: msg }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    const unauthed = () =>
      new Response(JSON.stringify({ ok: false, error: "auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (action === "retry") {
      if (!caller.is_admin) return forbid();
      const { log_id } = body;
      const { data: row } = await sb.from("email_log").select("*").eq("id", log_id).maybeSingle();
      if (!row) throw new Error("log not found");
      // Re-render with stored metadata if any
      const data = (row.metadata as Record<string, any>) ?? {};
      const result = await sendOne({
        template: row.template as TemplateName,
        to: row.recipient_email,
        data,
        member_id: row.recipient_member,
        bypass_prefs: true,
      });
      await sb.from("email_log")
        .update({ retry_count: (row.retry_count ?? 0) + 1, retried_at: new Date().toISOString() })
        .eq("id", log_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: build the recipient list for blasts (used by `blast` and `preview_recipients`).
    const buildBlastRecipients = async (audience: string, tier?: string | null, member_ids?: string[] | null) => {
      const emailRegex = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$";
      let q = sb.from("members")
        .select("id, email, full_name, email_preferences, has_buyers_club_access, created_at")
        .not("email", "is", null).neq("email", "").filter("email", "~*", emailRegex);
      if (audience === "buyers_club") q = q.eq("has_buyers_club_access", true);
      else if (audience === "custom") {
        const ids = (member_ids ?? []) as string[];
        if (!ids.length) throw new Error("no member_ids provided");
        q = q.in("id", ids);
      }
      const { data: rows, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      let scoped = (rows ?? []) as Array<{ id: string; email: string; full_name: string; email_preferences: Record<string, boolean> | null }>;
      if (audience === "circle" || audience === "tier") {
        let bq = sb.from("circle_bids").select("member_id").eq("is_valid_contribution", true);
        if (audience === "tier" && tier) bq = bq.eq("tier", tier);
        const { data: bids } = await bq;
        const bidderIds = new Set((bids ?? []).map((b: any) => b.member_id));
        scoped = scoped.filter((m) => bidderIds.has(m.id));
      }
      const total_members = rows?.length ?? 0;
      const eligible = scoped.filter((m) => (m.email_preferences ?? {}).marketing !== false);
      return { total_members, after_audience: scoped.length, recipients: eligible };
    };

    if (action === "preview_recipients") {
      if (!caller.is_admin) return forbid();
      const { audience, tier, member_ids } = body;
      const r = await buildBlastRecipients(audience, tier, member_ids);
      return new Response(JSON.stringify({
        ok: true,
        total_members: r.total_members,
        after_audience_filter: r.after_audience,
        recipient_count: r.recipients.length,
        recipients: r.recipients.map((m) => ({ id: m.id, email: m.email, full_name: m.full_name })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "blast") {
      if (!caller.is_admin) return forbid();
      const { subject, body_html, audience, tier, member_ids } = body;
      // Create blast row
      const { data: blast } = await sb.from("email_blasts").insert({
        subject, body_html, audience, status: "running",
        audience_filter: { tier, member_ids },
      }).select("id").single();

      const built = await buildBlastRecipients(audience, tier, member_ids);
      const list = built.recipients;
      console.log(`[blast] audience=${audience} tier=${tier ?? "-"} total_members=${built.total_members} after_audience=${built.after_audience} after_marketing=${list.length}`);

      const failures: Array<{ email: string; error: string }> = [];
      let sent = 0, failed = 0, suppressed = 0;
      for (const r of list) {
        const res = await sendOne({
          template: "custom",
          to: r.email,
          data: { subject, title: subject, body_html, name: r.full_name },
          member_id: r.id,
          blast_id: blast?.id,
        });
        if (res.ok && res.suppressed) suppressed++;
        else if (res.ok) sent++;
        else { failed++; failures.push({ email: r.email, error: res.error ?? "unknown" }); }
      }
      await sb.from("email_blasts")
        .update({ recipient_count: list.length, sent_count: sent, failed_count: failed,
                  status: "completed", completed_at: new Date().toISOString() })
        .eq("id", blast!.id);
      return new Response(JSON.stringify({
        ok: true, blast_id: blast?.id,
        total_members: built.total_members,
        recipients: list.length, sent, failed, suppressed, failures,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // default: single send
    const { template, to, data = {}, member_id, bypass_prefs } = body;
    if (!template || !to) throw new Error("template and to are required");
    const tpl = template as TemplateName;

    // Admin-only templates (custom HTML body)
    if (ADMIN_ONLY_TEMPLATES.has(tpl) && !caller.is_admin) return forbid();

    // All other templates require an authenticated caller, except a small public allowlist.
    if (!caller.user_id && !ANON_ALLOWED_TEMPLATES.has(tpl)) return unauthed();

    const result = await sendOne({ template: tpl, to, data, member_id, bypass_prefs });
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
