import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function shouldGenerate(frequency: string | null, lastAt: Date): boolean {
  const hours = (Date.now() - lastAt.getTime()) / 3_600_000;
  const f = (frequency ?? "daily").toLowerCase();
  if (f === "daily") return hours >= 23;
  if (f === "weekly") return hours >= 24 * 6;
  if (f === "3x_week" || f === "3x-week" || f === "3xweek") {
    const day = new Date().getUTCDay(); // 0=Sun
    const slotDay = day === 1 || day === 3 || day === 5; // Mon/Wed/Fri
    return slotDay && hours >= 20;
  }
  return hours >= 23;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const _cron = Deno.env.get("CRON_SECRET");
  if (!_cron || req.headers.get("x-cron-secret") !== _cron) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Sweep stuck "generating" jobs older than 15 minutes
    const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data: stuck } = await supabase
      .from("zcreator_content_queue")
      .select("id")
      .eq("status", "generating")
      .lt("updated_at", cutoff);
    if (stuck && stuck.length) {
      await supabase
        .from("zcreator_content_queue")
        .update({
          status: "failed",
          error_message: "[system] Generation timeout - exceeded 15 minutes. This may indicate the service is stuck. Click retry with a different style.",
          updated_at: new Date().toISOString(),
        })
        .in("id", stuck.map((s) => s.id));
      console.log(`[auto-generate] timed out ${stuck.length} stuck jobs`);
    }


    const { data: agents, error } = await supabase
      .from("zcreator_story_agents")
      .select("*")
      .eq("active", true)
      .eq("auto_generate", true);

    if (error) return json({ error: error.message }, 500);

    let scriptsGenerated = 0;
    let agentsProcessed = 0;
    const results: any[] = [];

    for (const a of agents ?? []) {
      agentsProcessed++;
      const lastAt = new Date(a.updated_at ?? a.created_at);
      if (!shouldGenerate(a.content_frequency, lastAt)) {
        results.push({ agentId: a.id, skipped: true, reason: "not_due" });
        continue;
      }

      try {
        const genRes = await supabase.functions.invoke("zcreator-story-agent", {
          body: { agentId: a.id, manualTrigger: false },
        });
        if (genRes.error || (genRes.data as any)?.error) {
          results.push({ agentId: a.id, error: genRes.error?.message ?? (genRes.data as any)?.error });
          continue;
        }
        scriptsGenerated++;
        const contentId = (genRes.data as any)?.contentId;

        if (a.auto_publish && contentId) {
          await supabase.functions.invoke("zcreator-generate-video", {
            body: { contentId, videoStyle: "talking_head" },
          });
        }
        results.push({ agentId: a.id, contentId, autoPublish: !!a.auto_publish });
      } catch (e: any) {
        results.push({ agentId: a.id, error: e?.message ?? "invoke failed" });
      }
    }

    // Refresh analytics for all touched users
    const userIds = Array.from(new Set((agents ?? []).map((a) => a.user_id).filter(Boolean)));
    for (const uid of userIds) {
      try {
        await supabase.functions.invoke("zcreator-sync-analytics", { body: { userId: uid } });
      } catch (e) {
        console.error("sync-analytics invoke failed", uid, e);
      }
    }

    return json({ agentsProcessed, scriptsGenerated, results });
  } catch (e: any) {
    console.error("auto-generate error", e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
