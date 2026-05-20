// Publish ZCreator content to YouTube/TikTok/Instagram
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

async function refreshYouTubeAccessToken(refreshToken: string): Promise<string> {
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
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

async function publishToYouTube(opts: {
  accessToken: string;
  videoBlob: Blob;
  title: string;
  description: string;
  tags: string[];
  privacy: string;
}) {
  const metadata = {
    snippet: {
      title: opts.title.slice(0, 100),
      description: opts.description.slice(0, 5000),
      tags: opts.tags?.slice(0, 30) ?? [],
      categoryId: "22",
    },
    status: { privacyStatus: opts.privacy || "unlisted", selfDeclaredMadeForKids: false },
  };

  const boundary = "----LovableBoundary" + crypto.randomUUID();
  const enc = new TextEncoder();
  const pre = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: video/*\r\n\r\n`,
  );
  const post = enc.encode(`\r\n--${boundary}--`);
  const videoBytes = new Uint8Array(await opts.videoBlob.arrayBuffer());
  const body = new Uint8Array(pre.length + videoBytes.length + post.length);
  body.set(pre, 0);
  body.set(videoBytes, pre.length);
  body.set(post, pre.length + videoBytes.length);

  const res = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`YouTube upload failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { videoId: data.id as string, url: `https://youtu.be/${data.id}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { contentId, platforms, publishNow } = await req.json();
    if (!contentId || !Array.isArray(platforms) || platforms.length === 0) {
      return new Response(JSON.stringify({ error: "contentId and platforms required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: content, error: cErr } = await admin
      .from("zcreator_content_queue")
      .select("*")
      .eq("id", contentId)
      .maybeSingle();
    if (cErr || !content) throw new Error(cErr?.message ?? "Content not found");

    const userId = content.user_id;

    // Subscription quota check
    const { data: sub } = await admin
      .from("zcreator_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (sub && sub.videos_used_this_month >= sub.videos_per_month) {
      throw new Error("Monthly video quota reached");
    }
    const enabled: string[] = sub?.platforms_enabled ?? ["youtube", "tiktok", "instagram"];

    const meta = (content.platform_metadata ?? {}) as Record<string, any>;
    const published: Array<{ platform: string; url?: string; videoId?: string; note?: string }> = [];

    for (const platform of platforms) {
      if (!enabled.includes(platform)) {
        published.push({ platform, note: "Platform not enabled in subscription" });
        continue;
      }

      try {
        if (platform === "youtube") {
          if (!content.video_url) throw new Error("No video_url on content");
          if (!YT_CLIENT_ID || !YT_CLIENT_SECRET)
            throw new Error("YouTube OAuth secrets not configured");

          const { data: tokRow } = await admin
            .from("zcreator_youtube_tokens")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          if (!tokRow) throw new Error("User has not connected YouTube");

          const accessToken = await refreshYouTubeAccessToken(tokRow.refresh_token);

          const videoRes = await fetch(content.video_url);
          if (!videoRes.ok) throw new Error("Could not fetch stored video");
          const blob = await videoRes.blob();

          const ytMeta = meta.youtube ?? {};
          const result = await publishToYouTube({
            accessToken,
            videoBlob: blob,
            title: ytMeta.title ?? content.title,
            description: ytMeta.description ?? content.script ?? "",
            tags: ytMeta.tags ?? [],
            privacy: ytMeta.privacy ?? tokRow.default_privacy ?? "unlisted",
          });

          await admin.from("zcreator_published_content").insert({
            content_id: contentId,
            platform,
            platform_url: result.url,
            platform_video_id: result.videoId,
          });
          await admin.from("zcreator_analytics").insert({
            content_id: contentId,
            platform,
          });
          published.push({ platform, ...result });
        } else if (platform === "tiktok") {
          const note = "TikTok API requires business account verification";
          await admin
            .from("zcreator_published_content")
            .insert({ content_id: contentId, platform, platform_url: null });
          published.push({ platform, note });
        } else if (platform === "instagram") {
          const note = "Instagram Graph API integration coming";
          await admin
            .from("zcreator_published_content")
            .insert({ content_id: contentId, platform, platform_url: null });
          published.push({ platform, note });
        } else {
          published.push({ platform, note: "Unknown platform" });
        }
      } catch (perr) {
        console.error(`[${platform}] publish error`, perr);
        published.push({ platform, note: (perr as Error).message });
      }
    }

    await admin
      .from("zcreator_content_queue")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", contentId);

    if (sub) {
      await admin
        .from("zcreator_subscriptions")
        .update({ videos_used_this_month: sub.videos_used_this_month + 1 })
        .eq("user_id", userId);
    }

    return new Response(JSON.stringify({ success: true, published, publishNow: !!publishNow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-content error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
