// Automation cron — runs every minute, fires time-based automations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "Africa/Johannesburg";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function nowInTZ() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const wd = get("weekday").toLowerCase().slice(0, 3); // mon, tue...
  const hh = get("hour").padStart(2, "0");
  const mm = get("minute").padStart(2, "0");
  return { weekday: wd, hhmm: `${hh}:${mm}` };
}

function applyVars(template: string, vars: Record<string, string | number>) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { weekday, hhmm } = nowInTZ();
  const { data: autos, error } = await supabase
    .from("automated_messages")
    .select("*")
    .eq("enabled", true)
    .eq("trigger_type", "time_based");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Member count for variable substitution
  const { count: memberCount } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true });
  const total = memberCount || 0;
  const vars = {
    member_count: total,
    remaining_members: Math.max(0, 100 - total),
  };

  const fired: string[] = [];
  const skipped: string[] = [];

  for (const a of autos || []) {
    const cfg = (a.trigger_config || {}) as any;
    if (cfg.time !== hhmm) continue;
    const days: string[] = (cfg.days || []).map((d: string) => d.toLowerCase());
    if (days.length && !days.includes(weekday)) continue;
    if (typeof cfg.min_members === "number" && total < cfg.min_members) continue;

    // Idempotency: skip if already triggered in the last 90s
    if (a.last_triggered_at) {
      const ageSec = (Date.now() - new Date(a.last_triggered_at).getTime()) / 1000;
      if (ageSec < 90) { skipped.push(a.name); continue; }
    }

    // Pick template (rotate if configured)
    let template = a.message_template;
    if (Array.isArray(cfg.rotate) && cfg.rotate.length > 0) {
      const idx = Math.floor(Date.now() / (24 * 3600 * 1000)) % cfg.rotate.length;
      template = cfg.rotate[idx];
    }
    const message = applyVars(template, vars);
    const channels: string[] = Array.isArray(a.channels) ? a.channels : ["community_chat"];

    let recipients = 0;
    let status: "sent" | "failed" = "sent";
    const errs: string[] = [];
    const stats: Record<string, { sent: number; failed: number }> = {};

    if (channels.includes("community_chat")) {
      try {
        const { error: insErr } = await supabase.from("chat_messages").insert({
          member_id: null, message, message_type: "system",
        });
        if (insErr) throw insErr;
        stats.chat = { sent: 1, failed: 0 };
        recipients = Math.max(recipients, total);
      } catch (e: any) {
        stats.chat = { sent: 0, failed: 1 };
        errs.push(`chat:${e.message || e}`);
      }
    }

    if (channels.includes("push")) {
      try {
        const title = (cfg.push_title as string) || "UMOJA";
        const url = (cfg.push_url as string) || "/community";
        const { data: pr, error: pErr } = await supabase.functions.invoke("send-push", {
          body: { title, message, url },
        });
        if (pErr) throw pErr;
        stats.push = { sent: pr?.sent || 0, failed: pr?.failed || 0 };
        recipients = Math.max(recipients, pr?.total || 0);
      } catch (e: any) {
        stats.push = { sent: 0, failed: 1 };
        errs.push(`push:${e.message || e}`);
      }
    }

    if (errs.length && Object.values(stats).every((s) => s.sent === 0)) status = "failed";
    const errMsg = errs.length ? errs.join(" | ") : null;

    await supabase.from("scheduled_messages").insert({
      automated_message_id: a.id,
      scheduled_for: new Date().toISOString(),
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      recipient_count: recipients,
      channel: channels.join(","),
      error: errMsg,
      delivery_stats: stats,
    });

    await supabase
      .from("automated_messages")
      .update({ last_triggered_at: new Date().toISOString() })
      .eq("id", a.id);

    fired.push(a.name);
  }

  return new Response(
    JSON.stringify({ ok: true, time: hhmm, weekday, fired, skipped, total }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
