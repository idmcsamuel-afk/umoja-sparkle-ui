// TEMPORARY self-test harness for generate-fit-check. Delete after verification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const secret = req.headers.get("x-test-secret");
  if (secret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const { email, tender_id } = await req.json();
  const admin = createClient(url, service);

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) return new Response(JSON.stringify({ step: "link", error: linkErr.message }), { status: 500 });

  const pub = createClient(url, anon);
  const { data: sess, error: otpErr } = await pub.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpErr) return new Response(JSON.stringify({ step: "otp", error: otpErr.message }), { status: 500 });

  const token = sess.session!.access_token;
  const res = await fetch(`${url}/functions/v1/generate-fit-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: anon },
    body: JSON.stringify({ p_tender_id: tender_id }),
  });
  const body = await res.text();
  return new Response(JSON.stringify({ status: res.status, body: JSON.parse(body) }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
