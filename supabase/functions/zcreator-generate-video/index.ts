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
const HEYGEN_KEY = Deno.env.get("HEYGEN_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function uploadToStorage(path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await supabase.storage
    .from("zcreator-videos")
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error("Upload failed: " + error.message);
  const { data } = supabase.storage.from("zcreator-videos").getPublicUrl(path);
  return data.publicUrl;
}

async function generateTalkingHead(content: any) {
  if (!HEYGEN_KEY) throw new Error("HEYGEN_API_KEY not configured");

  // Create video — use default HeyGen avatar/voice (can be customised later)
  const createRes = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "X-Api-Key": HEYGEN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: "Daisy-inskirt-20220818", avatar_style: "normal" },
          voice: { type: "text", input_text: content.script_content?.slice(0, 1500) ?? "Hello", voice_id: "1bd001e7e50f421d891986aad5158bc8" },
        },
      ],
      dimension: { width: 720, height: 1280 },
    }),
  });

  if (!createRes.ok) {
    const t = await createRes.text();
    throw new Error("HeyGen create failed: " + t);
  }
  const created = await createRes.json();
  const videoId = created?.data?.video_id;
  if (!videoId) throw new Error("HeyGen returned no video_id");

  // Poll up to ~3 min
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
      { headers: { "X-Api-Key": HEYGEN_KEY } },
    );
    const status = await statusRes.json();
    const s = status?.data?.status;
    if (s === "completed") {
      const url = status.data.video_url as string;
      const thumb = status.data.thumbnail_url as string | undefined;
      const duration = status.data.duration as number | undefined;

      const vid = await fetch(url);
      const bytes = new Uint8Array(await vid.arrayBuffer());
      const path = `${content.user_id}/${content.id}.mp4`;
      const videoUrl = await uploadToStorage(path, bytes, "video/mp4");

      let thumbnailUrl: string | null = null;
      if (thumb) {
        try {
          const tImg = await fetch(thumb);
          const tBytes = new Uint8Array(await tImg.arrayBuffer());
          thumbnailUrl = await uploadToStorage(`${content.user_id}/${content.id}.jpg`, tBytes, "image/jpeg");
        } catch (_) { /* ignore */ }
      }
      return { videoUrl, thumbnailUrl, duration: duration ?? null };
    }
    if (s === "failed") throw new Error("HeyGen video failed: " + (status?.data?.error?.message ?? "unknown"));
  }
  throw new Error("HeyGen polling timed out");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { contentId, videoStyle } = await req.json();
    if (!contentId) return json({ error: "contentId required" }, 400);

    const { data: content, error: cErr } = await supabase
      .from("zcreator_content_queue")
      .select("*")
      .eq("id", contentId)
      .single();
    if (cErr || !content) return json({ error: "Content not found" }, 404);

    const style = videoStyle || content.video_style || "talking_head";

    await supabase
      .from("zcreator_content_queue")
      .update({ status: "generating", video_style: style, updated_at: new Date().toISOString() })
      .eq("id", contentId);

    let videoUrl: string | null = null;
    let thumbnailUrl: string | null = null;
    let duration: number | null = null;
    let finalStatus = "ready";
    let errorMsg: string | null = null;

    try {
      if (style === "talking_head") {
        const r = await generateTalkingHead(content);
        videoUrl = r.videoUrl;
        thumbnailUrl = r.thumbnailUrl;
        duration = r.duration;
      } else if (style === "cinematic") {
        finalStatus = "script_ready";
        errorMsg = "Kling integration coming";
      } else if (style === "stock") {
        finalStatus = "script_ready";
        errorMsg = "Stock footage assembly coming (requires external worker)";
      } else if (style === "animation") {
        finalStatus = "script_ready";
        errorMsg = "Animation workflow coming";
      } else {
        throw new Error("Unknown video style: " + style);
      }
    } catch (e: any) {
      finalStatus = "failed";
      errorMsg = e?.message ?? "Video generation failed";
    }

    const updates: Record<string, unknown> = {
      status: finalStatus,
      updated_at: new Date().toISOString(),
    };
    if (videoUrl) updates.video_url = videoUrl;
    if (thumbnailUrl) updates.thumbnail_url = thumbnailUrl;
    if (duration != null) updates.duration_seconds = duration;
    if (errorMsg) updates.error_message = errorMsg;

    await supabase.from("zcreator_content_queue").update(updates).eq("id", contentId);

    if (finalStatus === "failed") return json({ success: false, error: errorMsg }, 200);

    return json({ success: true, videoUrl, status: finalStatus, note: errorMsg });
  } catch (e: any) {
    console.error("generate-video error", e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
