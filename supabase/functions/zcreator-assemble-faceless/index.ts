// Faceless video orchestrator (scaffold).
// Input: { contentId: string }
// Steps: load script → for each scene fetch Pexels stock clip → synth voiceover (Edge TTS or ElevenLabs)
//        → Whisper SRT → dispatch to FFmpeg worker → update zcreator_content_queue.
// FFmpeg worker is stubbed if FFMPEG_WORKER_URL is a placeholder.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WORKER_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? SERVICE_KEY;
const PEXELS_KEY = Deno.env.get("PEXELS_API_KEY") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const FFMPEG_WORKER_URL = Deno.env.get("FFMPEG_WORKER_URL") ?? "";

async function pexelsSearchVideo(query: string): Promise<string | null> {
  if (!PEXELS_KEY) return null;
  const r = await fetch(
    `https://api.pexels.com/videos/search?per_page=3&orientation=landscape&query=${encodeURIComponent(query)}`,
    { headers: { Authorization: PEXELS_KEY } },
  );
  if (!r.ok) return null;
  const data = await r.json();
  const v = data?.videos?.[0];
  // Pick a 720p/1080p mp4 link
  const files = v?.video_files ?? [];
  const pick = files.find((f: any) => f.quality === "hd" && f.file_type === "video/mp4")
    ?? files.find((f: any) => f.file_type === "video/mp4");
  return pick?.link ?? null;
}

async function callVoice(text: string, tier: "standard" | "premium", uploadPath: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/zcreator-generate-voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ text, tier, uploadPath }),
  });
  if (!r.ok) throw new Error(`voice gen failed: ${await r.text()}`);
  return r.json() as Promise<{ audioUrl: string; duration: number; tier: string; voice: string }>;
}

async function whisperSrt(audioUrl: string): Promise<string | null> {
  if (!OPENAI_KEY) return null;
  try {
    const audio = await fetch(audioUrl).then((r) => r.arrayBuffer());
    const fd = new FormData();
    fd.append("file", new Blob([audio], { type: "audio/mpeg" }), "audio.mp3");
    fd.append("model", "whisper-1");
    fd.append("response_format", "srt");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: fd,
    });
    if (!r.ok) { console.error("whisper failed", await r.text()); return null; }
    return await r.text();
  } catch (e) {
    console.error("whisper exception", e);
    return null;
  }
}

async function workerHealthCheck(timeoutMs = 60_000): Promise<boolean> {
  if (!FFMPEG_WORKER_URL) return false;
  const base = FFMPEG_WORKER_URL.replace(/\/assemble\/?$/, "").replace(/\/$/, "");
  const healthUrl = `${base}/health`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(healthUrl, { method: "GET", signal: ctrl.signal });
    await r.text().catch(() => "");
    return r.ok;
  } catch (e) {
    console.warn("worker health check failed", (e as Error)?.message);
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function ensureWorkerAwake(): Promise<void> {
  if (!FFMPEG_WORKER_URL) throw new Error("FFMPEG_WORKER_URL not configured");
  let ok = await workerHealthCheck(60_000);
  if (!ok) {
    console.log("worker health check failed, retrying in 30s...");
    await new Promise((r) => setTimeout(r, 30_000));
    ok = await workerHealthCheck(60_000);
  }
  if (!ok) {
    throw new Error(
      "FFmpeg worker unavailable. This is likely because the worker is starting up (Render free tier). Please retry in 1 minute.",
    );
  }
}

async function dispatchToWorker(payload: any): Promise<{ videoUrl: string; thumbnailUrl?: string; duration?: number }> {
  if (!FFMPEG_WORKER_URL) throw new Error("FFMPEG_WORKER_URL not configured");
  console.log("[worker] dispatching payload", {
    workerUrl: FFMPEG_WORKER_URL,
    sceneCount: payload?.scenes?.length ?? 0,
    sceneVideoUrls: payload?.scenes?.map((s: any) => s.videoUrl) ?? [],
    sceneAudioUrls: payload?.scenes?.map((s: any) => s.audioUrl) ?? [],
    sceneDurations: payload?.scenes?.map((s: any) => s.duration) ?? [],
    captionsSrtLen: (payload?.captionsSrt ?? "").length,
    supabaseUrl: payload?.supabaseUrl,
    hasServiceKey: !!payload?.supabaseKey,
    serviceKeyLen: payload?.supabaseKey?.length ?? 0,
    outputBucket: payload?.outputBucket,
    outputPrefix: payload?.outputPrefix,
    contentId: payload?.contentId,
  });

  const r = await fetch(FFMPEG_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const respText = await r.text();
  console.log("[worker] response", { status: r.status, bodyPreview: respText.slice(0, 1000) });
  if (!r.ok) {
    throw new Error(`ffmpeg worker ${r.status}: ${respText}`);
  }
  try {
    return JSON.parse(respText);
  } catch {
    throw new Error(`ffmpeg worker returned non-JSON: ${respText.slice(0, 500)}`);
  }
}

async function verifyUrl(url: string, label: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    console.log(`[verify ${label}]`, {
      url,
      status: r.status,
      contentType: r.headers.get("content-type"),
      contentLength: r.headers.get("content-length"),
    });
    return r.ok;
  } catch (e) {
    console.error(`[verify ${label}] exception`, { url, error: (e as Error).message });
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { contentId } = await req.json();
    if (!contentId) return json({ error: "contentId is required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Load script
    const { data: content, error: cErr } = await supabase
      .from("zcreator_content_queue")
      .select("id, user_id, agent_id, script_title, script_content, video_style, generation_cost_rands")
      .eq("id", contentId)
      .maybeSingle();
    if (cErr || !content) return json({ error: cErr?.message ?? "content not found" }, 404);

    // Load agent for voice tier
    let voiceTier: "standard" | "premium" = "standard";
    if (content.agent_id) {
      const { data: agent } = await supabase
        .from("zcreator_story_agents")
        .select("brand_voice")
        .eq("id", content.agent_id)
        .maybeSingle();
      const tier = (agent?.brand_voice as any)?.voice_tier;
      if (tier === "premium") voiceTier = "premium";
    }

    const setProgress = async (progress: Record<string, unknown>) => {
      await supabase
        .from("zcreator_content_queue")
        .update({ generation_progress: progress, updated_at: new Date().toISOString() })
        .eq("id", contentId);
    };
    const checkCancelled = async (): Promise<boolean> => {
      const { data } = await supabase
        .from("zcreator_content_queue")
        .select("cancel_requested")
        .eq("id", contentId)
        .maybeSingle();
      return !!data?.cancel_requested;
    };

    await supabase.from("zcreator_content_queue").update({
      status: "generating",
      cancel_requested: false,
      generation_progress: { step: "starting", message: "Preparing scenes…" },
    }).eq("id", contentId);

    // 2) Parse scenes from script_content
    const script: any = content.script_content ?? {};
    const scenes: any[] = Array.isArray(script.scenes) && script.scenes.length
      ? script.scenes
      : [{ visual: content.script_title ?? "topic", narration: typeof script === "string" ? script : (script.narration ?? script.body ?? content.script_title ?? "") }];

    // 3) For each scene: find stock clip + voice (skip scenes without a usable stock clip)
    const sceneAssets: Array<{ videoUrl: string; audioUrl: string; duration: number; narration: string }> = [];
    for (let i = 0; i < scenes.length; i++) {
      if (await checkCancelled()) {
        await supabase.from("zcreator_content_queue").update({
          status: "cancelled",
          generation_progress: { step: "cancelled", message: "Cancelled by user" },
        }).eq("id", contentId);
        return json({ cancelled: true });
      }
      await setProgress({
        step: "stock_and_voice",
        sceneIndex: i + 1,
        sceneTotal: scenes.length,
        message: `Searching stock footage & generating voiceover (scene ${i + 1} of ${scenes.length})…`,
      });
      const s = scenes[i];
      const narration = String(s.narration ?? s.text ?? "").trim();
      if (!narration) continue;
      const query = String(s.visual ?? s.keywords ?? content.script_title ?? "background").slice(0, 80);
      const [videoUrl, voice] = await Promise.all([
        pexelsSearchVideo(query),
        callVoice(narration, voiceTier, `audio/${contentId}/scene-${i}.mp3`),
      ]);
      console.log(`[scene ${i}] voice result`, {
        audioUrl: voice.audioUrl,
        duration: voice.duration,
        tier: voice.tier,
        voice: voice.voice,
      });
      console.log(`[scene ${i}] pexels result`, { query, videoUrl });
      if (!videoUrl) {
        console.warn(`scene ${i}: no stock video for "${query}" — skipping`);
        continue;
      }
      // verify both URLs are reachable
      const [audioOk, videoOk] = await Promise.all([
        voice.audioUrl ? verifyUrl(voice.audioUrl, `scene-${i}-audio`) : Promise.resolve(false),
        verifyUrl(videoUrl, `scene-${i}-video`),
      ]);
      if (!audioOk) {
        console.error(`[scene ${i}] audio URL not reachable, skipping`, { audioUrl: voice.audioUrl });
        continue;
      }
      if (!videoOk) {
        console.error(`[scene ${i}] pexels video URL not reachable, skipping`, { videoUrl });
        continue;
      }
      sceneAssets.push({ videoUrl, audioUrl: voice.audioUrl, duration: voice.duration, narration });
    }

    if (sceneAssets.length === 0) {
      await supabase.from("zcreator_content_queue").update({ status: "failed" }).eq("id", contentId);
      return json({ error: "no scenes with narration + stock footage" }, 400);
    }

    if (await checkCancelled()) {
      await supabase.from("zcreator_content_queue").update({
        status: "cancelled",
        generation_progress: { step: "cancelled", message: "Cancelled by user" },
      }).eq("id", contentId);
      return json({ cancelled: true });
    }

    await setProgress({ step: "captions", message: "Adding captions…" });


    // 4) Captions from first scene narration audio (worker can re-time across full track if needed)
    const captionsSrt = (await whisperSrt(sceneAssets[0].audioUrl)) ?? "";

    // 5) Dispatch to FFmpeg worker
    await setProgress({ step: "worker_wake", message: "Waking FFmpeg worker…" });
    await ensureWorkerAwake();
    await setProgress({ step: "assembling", message: "Assembling video…" });
    const assembly = await dispatchToWorker({
      scenes: sceneAssets.map((a) => ({
        videoUrl: a.videoUrl,
        audioUrl: a.audioUrl,
        duration: a.duration,
      })),
      captionsSrt,
      supabaseUrl: SUPABASE_URL,
      supabaseKey: WORKER_SERVICE_KEY,
      contentId,
      title: content.script_title,
      outputBucket: "zcreator-videos",
      outputPrefix: `videos/${contentId}/`,
    });

    await setProgress({ step: "uploading", message: "Uploading…" });

    // 6) Update content record
    const cost = voiceTier === "premium" ? 10.04 : 7.04;
    await supabase
      .from("zcreator_content_queue")
      .update({
        status: "ready",
        video_url: assembly.videoUrl,
        thumbnail_url: assembly.thumbnailUrl ?? null,
        duration_seconds: assembly.duration ?? sceneAssets.reduce((s, a) => s + a.duration, 0),
        generation_cost_rands: cost,
        generation_progress: { step: "done", message: "Ready" },
      })
      .eq("id", contentId);

    return json({
      contentId,
      voiceTier,
      scenes: sceneAssets.length,
      videoUrl: assembly.videoUrl,
      thumbnailUrl: assembly.thumbnailUrl ?? null,
      duration: assembly.duration,
      cost,
    });
  } catch (e: any) {
    console.error("assemble-faceless error", e);
    return json({ error: e?.message ?? "unknown error" }, 500);
  }
});
