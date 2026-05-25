// Polls HeyGen for video status, updates ai_generated_videos and member_generated_videos
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");
const supabase = createClient(SUPABASE_URL, SERVICE);

async function poll(videoId: string) {
  if (!HEYGEN_API_KEY) return null;
  const r = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: { "X-Api-Key": HEYGEN_API_KEY },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d?.data ?? null;
}

async function processTable(table: string) {
  const { data: rows } = await supabase.from(table).select("id, heygen_video_id")
    .eq("generation_status", "generating").not("heygen_video_id", "is", null).limit(25);
  if (!rows) return 0;
  let updated = 0;
  for (const r of rows) {
    const s = await poll(r.heygen_video_id!);
    if (!s) continue;
    if (s.status === "completed" && s.video_url) {
      await supabase.from(table).update({
        generation_status: "ready",
        video_url: s.video_url,
        thumbnail_url: s.thumbnail_url ?? null,
        duration_seconds: s.duration ? Math.round(s.duration) : null,
      }).eq("id", r.id);
      updated++;
    } else if (s.status === "failed") {
      await supabase.from(table).update({
        generation_status: "failed",
        error_message: (s.error?.message ?? "HeyGen failed").slice(0, 500),
      }).eq("id", r.id);
    }
  }
  return updated;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const _cron = Deno.env.get("CRON_SECRET");
  if (!_cron || req.headers.get("x-cron-secret") !== _cron) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!HEYGEN_API_KEY) {
    return new Response(JSON.stringify({ ok: false, reason: "HEYGEN_API_KEY missing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = await processTable("ai_generated_videos");
  const member = await processTable("member_generated_videos");
  return new Response(JSON.stringify({ ok: true, admin_updated: admin, member_updated: member }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
