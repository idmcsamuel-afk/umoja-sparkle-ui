// Public unsubscribe endpoint. Handles:
//   GET  /email-unsubscribe?email=...   -> HTML confirmation page (one-click link)
//   POST /email-unsubscribe             -> RFC 8058 List-Unsubscribe-Post (form-encoded body)
//                                          also accepts JSON { email }
// Records an unsubscribe row in public.email_unsubscribes. Bulk sender skips these.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, list-unsubscribe",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe · UMOJA</title></head>
    <body style="font-family:Arial,sans-serif;background:#f3f1ec;margin:0;padding:48px 16px;color:#1c1c1c;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;box-shadow:0 8px 24px rgba(8,43,33,0.08);">
        <div style="font-family:Georgia,serif;font-size:22px;color:#0f3d2e;font-weight:700;letter-spacing:2px;">UMOJA</div>
        <hr style="border:none;border-top:1px solid #eee;margin:18px 0;">
        ${body}
        <p style="font-size:12px;color:#888;margin-top:24px;">If this was a mistake, email <a href="mailto:support@umojarise.com" style="color:#0f3d2e;">support@umojarise.com</a> and we'll re-subscribe you.</p>
      </div>
    </body></html>`,
    { status, headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function recordUnsubscribe(email: string, reason: string) {
  const clean = email.trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return { ok: false, error: "invalid email" };
  const { error } = await sb.from("email_unsubscribes")
    .upsert({ email: clean, reason }, { onConflict: "email" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  try {
    if (req.method === "POST") {
      // RFC 8058 one-click POST: body is form-encoded "List-Unsubscribe=One-Click"
      const ct = req.headers.get("content-type") ?? "";
      let email = url.searchParams.get("email") ?? "";
      if (!email && ct.includes("application/json")) {
        try { email = ((await req.json()) as any)?.email ?? ""; } catch { /* ignore */ }
      }
      if (!email) {
        return new Response(JSON.stringify({ error: "email required" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const res = await recordUnsubscribe(email, "one-click");
      return new Response(JSON.stringify(res), {
        status: res.ok ? 200 : 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // GET: confirmation page
    const email = url.searchParams.get("email") ?? "";
    if (!email) return html(`<h1 style="color:#0f3d2e;">Missing email</h1><p>This unsubscribe link is incomplete.</p>`, 400);
    const res = await recordUnsubscribe(email, "link");
    if (!res.ok) {
      return html(`<h1 style="color:#0f3d2e;">Couldn't unsubscribe</h1><p>${res.error}</p>`, 400);
    }
    return html(`<h1 style="color:#0f3d2e;">You're unsubscribed</h1>
      <p><strong>${email}</strong> will no longer receive marketing emails from UMOJA.</p>
      <p>Important account emails (payments, security, KYC) will still be sent.</p>`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
