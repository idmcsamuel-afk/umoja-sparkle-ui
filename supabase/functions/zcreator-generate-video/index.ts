import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generationEnabled, GENERATION_DISABLED_BODY } from "../_shared/generation-gate.ts";
import {
  resolveCaller, chargeAndStart, precharge, completeJob, refundJob,
  facelessNarrationChars, facelessVoiceTier, facelessSpecs,
} from "../_shared/creator-billing.ts";

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
  // Kill-switch: refuse before ANY paid provider call (HeyGen talking-head, stock assembly enqueue).
  if (!(await generationEnabled())) return json(GENERATION_DISABLED_BODY, 403);
  const caller = await resolveCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  let billingJobId: string | null = null;
  try {
    const { contentId, videoStyle } = await req.json();
    if (!contentId) return json({ error: "contentId required" }, 400);

    const { data: content, error: cErr } = await supabase
      .from("zcreator_content_queue")
      .select("*")
      .eq("id", contentId)
      .single();
    if (cErr || !content) return json({ error: "Content not found" }, 404);
    if (caller.kind === "user" && caller.userId !== content.user_id) return json({ error: "Forbidden" }, 403);

    const style = videoStyle || content.video_style || "talking_head";

    if (style === "cinematic" || style === "animation") {
      return json({ success: true, status: "script_ready", note: style === "cinematic" ? "Kling integration coming" : "Animation workflow coming" });
    }
    if (style !== "talking_head" && style !== "stock") return json({ error: "Unknown video style: " + style }, 400);

    if (style === "stock") {
      // Pre-charge Creator Credits at enqueue (assembly + voice). The queue worker claims these jobs.
      const chars = facelessNarrationChars(content.script_content);
      const tier = await facelessVoiceTier(supabase, content.agent_id);
      const charged: string[] = [];
      for (const spec of facelessSpecs(content.user_id, contentId, chars, tier)) {
        const c = await precharge(supabase, spec);
        if (!c.ok) { for (const id of charged) await refundJob(supabase, id); return json(c.body, c.status); }
        charged.push(c.jobId);
      }
      const { error: qErr } = await supabase
        .from("zcreator_job_queue")
        .insert({ content_id: contentId, user_id: content.user_id, priority: 0, status: "queued" });
      if (qErr) {
        for (const id of charged) await refundJob(supabase, id);
        return json({ error: "Queue insert failed: " + qErr.message }, 500);
      }
      const { count: aheadCount } = await supabase
        .from("zcreator_job_queue")
        .select("id", { count: "exact", head: true })
        .in("status", ["queued", "processing"]);
      await supabase
        .from("zcreator_content_queue")
        .update({ status: "queued", video_style: style, updated_at: new Date().toISOString(), error_message: null })
        .eq("id", contentId);
      fetch(`${SUPABASE_URL}/functions/v1/zcreator-process-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "" },
        body: "{}",
      }).catch(() => {});
      return json({ success: true, queued: true, position: aheadCount ?? 1, message: `Video queued for generation (position ${aheadCount ?? 1})` });
    }

    // talking_head → HeyGen. Charge BEFORE calling the provider.
    const c = await chargeAndStart(supabase, {
      memberId: content.user_id, modelKey: "heygen-avatar-v2", route: "heygen-talking-head", jobType: "video",
      idempotencyKey: `video:${contentId}:talking_head`, params: { contentId }, source: "generate-video",
    });
    if (!c.ok) return json(c.body, c.status);
    billingJobId = c.jobId;

    await supabase
      .from("zcreator_content_queue")
      .update({ status: "generating", video_style: style, updated_at: new Date().toISOString() })
      .eq("id", contentId);

    try {
      const r = await generateTalkingHead(content);
      await supabase.from("zcreator_content_queue").update({
        status: "ready", video_url: r.videoUrl, thumbnail_url: r.thumbnailUrl,
        duration_seconds: r.duration, error_message: null, updated_at: new Date().toISOString(),
      }).eq("id", contentId);
      await completeJob(supabase, billingJobId, r.videoUrl);
      billingJobId = null;
      return json({ success: true, videoUrl: r.videoUrl, status: "ready", credits_charged: c.credits });
    } catch (e: any) {
      const raw = e?.message ?? "Video generation failed";
      const errorMsg = `[system] ${raw.toLowerCase().includes("heygen") ? "HeyGen API: " : ""}${raw} — credits refunded`;
      await supabase.from("zcreator_content_queue").update({
        status: "failed", error_message: errorMsg, updated_at: new Date().toISOString(),
      }).eq("id", contentId);
      return json({ success: false, error: errorMsg }, 200);
    }
  } catch (e: any) {
    console.error("generate-video error", e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  } finally {
    if (billingJobId) await refundJob(supabase, billingJobId);
  }
});
