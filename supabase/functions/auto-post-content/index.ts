// Auto-poster - STUB MODE (marks scheduled posts as "posted" without calling social APIs)
// When you wire IG/TikTok/FB tokens, replace the stub block with the real platform calls.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const _cron = Deno.env.get("CRON_SECRET");
  if (!_cron || req.headers.get("x-cron-secret") !== _cron) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const now = new Date();
  const horizon = new Date(now.getTime() + 15 * 60 * 1000);
  const { data: posts } = await supabase
    .from("ai_scheduled_posts")
    .select("id, platform, video_id, ai_generated_videos(video_url, video_caption)")
    .eq("post_status", "scheduled")
    .lte("scheduled_for", horizon.toISOString());

  let posted = 0;
  for (const p of posts ?? []) {
    // STUB: pretend post succeeded. Replace with real platform API call when tokens added.
    const ok = true;
    const postUrl = `https://stub.local/${p.platform}/${p.id}`;
    if (ok) {
      await supabase.from("ai_scheduled_posts").update({
        post_status: "posted",
        posted_at: new Date().toISOString(),
        post_url: postUrl,
        engagement_metrics: { likes: 0, comments: 0, shares: 0, views: 0, stub: true },
      }).eq("id", p.id);
      posted++;
    }
  }
  return new Response(JSON.stringify({ ok: true, posted, mode: "stub" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
