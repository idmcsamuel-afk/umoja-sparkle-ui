// Microsoft Edge TTS via WebSocket (free, unofficial) + ElevenLabs fallback.
// Accepts { text, voice?, tier?, returnBase64?, uploadPath? }
// - tier='standard' (default): uses MS Edge TTS, voices like en-ZA-LeahNeural / en-ZA-LukeNeural
// - tier='premium': uses ElevenLabs
// Returns { audioUrl?, audioBase64?, duration, tier, voice }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EDGE_TTS_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_TTS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TTS_TOKEN}`;

const DEFAULT_STANDARD_VOICE = "en-ZA-LeahNeural";
const ELEVEN_VOICE_DEFAULT = "EXAVITQu4vr4xnSDxMaL"; // Sarah

function escapeSsml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Wrap text in SSML with small humanization: sentence pauses + slight rate/pitch jitter.
function buildSsml(text: string, voice: string) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const parts = sentences.map((s) => {
    const rate = (Math.random() * 0.10 - 0.05).toFixed(2); // -5% .. +5%
    const pitch = (Math.random() * 6 - 3).toFixed(1); // -3% .. +3%
    const pauseMs = 300 + Math.floor(Math.random() * 500); // 300-800ms
    const rateStr = `${rate.startsWith("-") ? rate : "+" + rate}%`;
    const pitchStr = `${pitch.startsWith("-") ? pitch : "+" + pitch}%`;
    return `<prosody rate="${rateStr}" pitch="${pitchStr}">${escapeSsml(s)}</prosody><break time="${pauseMs}ms"/>`;
  });
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${voice}">${parts.join("")}</voice>
</speak>`;
}

function uuid() {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

// Connects to Edge TTS WebSocket and returns concatenated MP3 audio bytes.
async function edgeTtsSynthesize(text: string, voice: string): Promise<Uint8Array> {
  const connectionId = uuid();
  const url = `${EDGE_TTS_URL}&ConnectionId=${connectionId}`;
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";

  const chunks: Uint8Array[] = [];

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { ws.close(); } catch (_) {}
      reject(new Error("Edge TTS timeout"));
    }, 60_000);

    ws.onopen = () => {
      const ts = new Date().toUTCString();
      // 1) Speech config
      const cfg =
        `X-Timestamp:${ts}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
                outputFormat: "audio-24khz-48kbitrate-mono-mp3",
              },
            },
          },
        });
      ws.send(cfg);

      // 2) SSML
      const ssml = buildSsml(text, voice);
      const ssmlMsg =
        `X-RequestId:${connectionId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${ts}\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;
      ws.send(ssmlMsg);
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        if (ev.data.includes("Path:turn.end")) {
          clearTimeout(timeout);
          try { ws.close(); } catch (_) {}
          resolve();
        }
        return;
      }
      // Binary: header (text, ends with \r\n\r\n) + audio bytes
      const buf = new Uint8Array(ev.data as ArrayBuffer);
      // First 2 bytes = header length (big-endian uint16)
      const headerLen = (buf[0] << 8) | buf[1];
      const audio = buf.subarray(2 + headerLen);
      if (audio.length > 0) chunks.push(audio);
    };

    ws.onerror = (e) => {
      clearTimeout(timeout);
      reject(new Error("Edge TTS WebSocket error: " + (e as any)?.message));
    };
    ws.onclose = () => clearTimeout(timeout);
  });

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function elevenLabsSynthesize(text: string, voice: string): Promise<Uint8Array> {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY not configured");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
  return new Uint8Array(await r.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? "").trim();
    if (!text) return json({ error: "text is required" }, 400);
    if (text.length > 5000) return json({ error: "text too long (max 5000 chars)" }, 400);

    const tier = body.tier === "premium" ? "premium" : "standard";
    const voice = String(body.voice ?? (tier === "premium" ? ELEVEN_VOICE_DEFAULT : DEFAULT_STANDARD_VOICE));
    const returnBase64 = !!body.returnBase64;
    const uploadPath: string | null = body.uploadPath ?? null;

    const audio = tier === "premium"
      ? await elevenLabsSynthesize(text, voice)
      : await edgeTtsSynthesize(text, voice);

    // Rough duration estimate from 48kbps MP3 (standard) or 128kbps (premium)
    const kbps = tier === "premium" ? 128 : 48;
    const duration = Math.max(1, Math.round((audio.length * 8) / (kbps * 1000)));

    let audioUrl: string | undefined;
    if (uploadPath) {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      const { error } = await supabase.storage.from("zcreator-videos").upload(uploadPath, audio, {
        contentType: "audio/mpeg",
        upsert: true,
      });
      if (error) return json({ error: "upload failed: " + error.message }, 500);
      const { data } = supabase.storage.from("zcreator-videos").getPublicUrl(uploadPath);
      audioUrl = data.publicUrl;
    }

    return json({
      tier,
      voice,
      duration,
      audioUrl,
      audioBase64: returnBase64 ? base64Encode(audio) : undefined,
      mimeType: "audio/mpeg",
    });
  } catch (e: any) {
    console.error("voice error", e);
    return json({ error: e?.message ?? "unknown error" }, 500);
  }
});
