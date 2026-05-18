// Send web push notifications. Body: { title, message, url?, member_ids? }
// If member_ids omitted, sends to all subscriptions.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUB = Deno.env.get("VAPID_PUBLIC_KEY")!;
const PRIV = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUBJ = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@umoja.app";
webpush.setVapidDetails(SUBJ, PUB, PRIV);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Authorize: require service-role JWT, admin JWT, or CRON_SECRET header
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data, error } = await anon.auth.getClaims(token);
    if (error || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (data.claims.role !== "service_role") {
      const { data: row } = await supabase.from("admin_users").select("user_id").eq("user_id", data.claims.sub).maybeSingle();
      if (!row) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    const { title = "UMOJA", message = "", url = "/", member_ids } = await req.json().catch(() => ({}));
    let q = supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth,member_id");
    if (Array.isArray(member_ids) && member_ids.length) q = q.in("member_id", member_ids);
    const { data: subs, error } = await q;
    if (error) throw error;

    const payload = JSON.stringify({ title, body: message, url });
    let sent = 0, failed = 0;
    const stale: string[] = [];

    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e: any) {
        failed++;
        const code = e?.statusCode;
        if (code === 404 || code === 410) stale.push(s.endpoint);
      }
    }));

    if (stale.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, total: subs?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
