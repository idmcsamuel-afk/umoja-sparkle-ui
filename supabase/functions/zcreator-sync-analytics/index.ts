// Sync ZCreator analytics from platform APIs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YT_CLIENT_ID = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
const YT_CLIENT_SECRET = Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "";

// Estimated SA revenue: R0.30 per 1000 views
const SA_RPM_RANDS = 0.3;

async function refreshYouTubeAccessToken(refreshToken: string): Promise<string | null> {
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return (await res.json()).access_token as string;
}

async function fetchYouTubeStats(accessToken: string, videoId: string) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`YT stats failed: ${res.status}`);
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  const s = item.statistics ?? {};
  const views = Number(s.viewCount ?? 0);
  const likes = Number(s.likeCount ?? 0);
  const comments = Number(s.commentCount ?? 0);
  // Approximate watch time using duration * views (no Analytics API call -> avoids OAuth scope churn)
  const dur = item.contentDetails?.duration ?? "PT0S";
  const m = dur.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  const seconds = (Number(m?.[1] ?? 0) * 60) + Number(m?.[2] ?? 0);
  const watch_time_minutes = Math.round((views * seconds) / 60);
  const estimated_revenue_rands = (views / 1000) * SA_RPM_RANDS;
  return { views, likes, comments, shares: 0, watch_time_minutes, estimated_revenue_rands };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { userId } = await req.json().catch(() => ({}));
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: queue } = await admin
      .from("zcreator_content_queue")
      .select("id")
      .eq("user_id", userId);
    const ids = (queue ?? []).map((q) => q.id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ synced: 0, totalViews: 0, totalRevenue: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: published } = await admin
      .from("zcreator_published_content")
      .select("content_id, platform, platform_video_id")
      .in("content_id", ids);

    const { data: tokRow } = await admin
      .from("zcreator_youtube_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    let ytAccessToken: string | null = null;
    if (tokRow?.refresh_token) {
      ytAccessToken = await refreshYouTubeAccessToken(tokRow.refresh_token);
    }

    let synced = 0;
    let totalViews = 0;
    let totalRevenue = 0;

    for (const p of published ?? []) {
      let stats = { views: 0, likes: 0, comments: 0, shares: 0, watch_time_minutes: 0, estimated_revenue_rands: 0 };
      try {
        if (p.platform === "youtube" && ytAccessToken && p.platform_video_id) {
          const s = await fetchYouTubeStats(ytAccessToken, p.platform_video_id);
          if (s) stats = s;
        }
        // tiktok / instagram -> zeros placeholder
      } catch (e) {
        console.error("stat fetch error", p, e);
      }

      // upsert by (content_id, platform)
      const { data: existing } = await admin
        .from("zcreator_analytics")
        .select("id")
        .eq("content_id", p.content_id)
        .eq("platform", p.platform)
        .maybeSingle();
      if (existing) {
        await admin.from("zcreator_analytics").update({ ...stats, synced_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await admin.from("zcreator_analytics").insert({ content_id: p.content_id, platform: p.platform, ...stats });
      }

      synced++;
      totalViews += stats.views;
      totalRevenue += stats.estimated_revenue_rands;
    }

    return new Response(JSON.stringify({ synced, totalViews, totalRevenue }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-analytics error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
