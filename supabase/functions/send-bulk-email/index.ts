// Bulk email sender for admin broadcasts.
// Sends to ALL members with a valid email via Resend.
// Actions: { preview: true } → returns recipient count.
//          { subject, body } → sends to all members.

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

function wrap(subject: string, bodyHtml: string) {
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
      <tr><td style="padding:20px 28px;border-top:1px solid #eee;color:#888;font-size:12px;">
        <strong style="color:#0f3d2e;">UMOJA</strong> — <a href="https://umojarise.com" style="color:#0f3d2e;">umojarise.com</a>
      </td></tr>
    </table></body></html>`;
}

async function fetchValidMembers() {
  const { data, error } = await sb.from("members")
    .select("id, email, full_name")
    .not("email", "is", null).neq("email", "");
  if (error) throw error;
  return (data ?? []).filter((m: any) => typeof m.email === "string" && EMAIL_REGEX.test(m.email));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("[Bulk Email] Request received");

    if (!await isAdmin(req)) {
      return new Response(JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { subject, body, preview } = await req.json();

    if (preview) {
      const members = await fetchValidMembers();
      console.log(`[Bulk Email] Preview: ${members.length} valid recipients`);
      return new Response(JSON.stringify({ count: members.length, preview: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!subject || !body) throw new Error("subject and body required");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const members = await fetchValidMembers();
    const html = wrap(subject, String(body).replace(/\n/g, "<br>"));
    console.log(`[Bulk Email] Sending to ${members.length} members`);

    let sent = 0, failed = 0;
    const failedEmails: string[] = [];

    for (const m of members) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [m.email], reply_to: REPLY_TO, subject, html }),
        });
        const out = await r.json();
        if (!r.ok) throw new Error(out?.message || `Resend ${r.status}`);
        await sb.from("email_log").insert({
          recipient_email: m.email, recipient_member: m.id,
          template: "custom", subject, status: "sent", resend_id: out?.id ?? null,
        });
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Bulk Email] Failed ${m.email}:`, msg);
        await sb.from("email_log").insert({
          recipient_email: m.email, recipient_member: m.id,
          template: "custom", subject, status: "failed", error: msg,
        });
        failed++; failedEmails.push(m.email);
      }
    }

    console.log(`[Bulk Email] Complete: ${sent} sent, ${failed} failed`);
    return new Response(JSON.stringify({ sent, failed, failedEmails, total: members.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Bulk Email] Error:", msg);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
