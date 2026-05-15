// Daily cron: warn at-risk members, suspend non-compliant on month-end,
// restore compliant ones, reset counters on day 1 of month.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function notify(member_id: string, title: string, body: string) {
  await sb.from("notifications").insert({ member_id, title, body, kind: "purchase", link: "/trending" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const today = new Date();
  const day = today.getUTCDate();
  const lastDay = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 0).getUTCDate();
  const isLastDay = day === lastDay;
  const isFirstDay = day === 1;

  const summary: Record<string, number> = { warned: 0, suspended: 0, restored: 0, reset: 0 };

  const { data: members } = await sb.from("member_purchase_requirements").select("*");
  if (!members) return new Response(JSON.stringify({ ok: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  for (const m of members as any[]) {
    const spend = Number(m.current_month_spend ?? 0);
    const min = Number(m.min_monthly_spend ?? 0);
    const ratio = min > 0 ? spend / min : 1;

    if (isFirstDay) {
      const next = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 0).toISOString().slice(0, 10);
      await sb.from("member_purchase_requirements").update({
        current_month_spend: 0,
        current_month_units: 0,
        next_review_date: next,
        warning_sent_at: null,
      }).eq("id", m.id);
      summary.reset++;
      continue;
    }

    if (day === 23 && ratio < 0.5 && !m.warning_sent_at) {
      await sb.from("member_purchase_requirements").update({
        compliance_status: "warning",
        warning_sent_at: new Date().toISOString(),
      }).eq("id", m.id);
      await notify(m.member_id, "⚠️ Purchase requirement at risk", `You've spent R${spend} of R${min} this month. 7 days left.`);
      summary.warned++;
    }

    if (isLastDay) {
      const { data: setting } = await sb.from("purchase_requirement_settings").select("auto_enforce").eq("tier", m.tier ?? "default").maybeSingle();
      const auto = setting?.auto_enforce ?? true;
      if (ratio < 1 && auto && m.compliance_status !== "suspended") {
        await sb.from("member_purchase_requirements").update({
          compliance_status: "suspended",
          access_revoked_at: new Date().toISOString(),
        }).eq("id", m.id);
        await notify(m.member_id, "🚫 Access suspended", `Minimum monthly purchase not met (R${spend}/R${min}). Restore access by purchasing R${min} through the platform.`);
        summary.suspended++;
      } else if (ratio >= 1 && m.compliance_status === "suspended") {
        await sb.from("member_purchase_requirements").update({
          compliance_status: "compliant",
          access_revoked_at: null,
        }).eq("id", m.id);
        await notify(m.member_id, "✅ Access restored", "Welcome back — your trending products access is restored.");
        summary.restored++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
