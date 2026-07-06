// Diagnostic: check Resend domain + recent email delivery status.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const out: any = { has_key: !!RESEND_API_KEY, key_prefix: RESEND_API_KEY.slice(0, 6) };

  try {
    const dom = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    out.domains = await dom.json();
  } catch (e) { out.domains_err = String(e); }

  out.emails = [];
  for (const id of ids) {
    try {
      const r = await fetch(`https://api.resend.com/emails/${id}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      out.emails.push({ id, status: r.status, body: await r.json() });
    } catch (e) { out.emails.push({ id, err: String(e) }); }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
