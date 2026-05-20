// ElevenLabs voice generation for Creator Studio.
// Accepts { text, voice?, tier?, returnBase64?, uploadPath? }
// - tier='standard' (default): ElevenLabs basic voice (shared default voice)
// - tier='premium': ElevenLabs voice clone (uses provided voice id)
// Returns { audioUrl?, audioBase64?, duration, tier, voice }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";

// Default voices
const STANDARD_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah - solid generic narrator
const PREMIUM_VOICE_DEFAULT = "JBFqnCBsd6RMkjVDRZzb"; // George - premium fallback

// Pre-process text for natural TTS pronunciation.
// Currency: "R2000" / "R2,000" / "R 60 000" → "two thousand rands".
function numberToWords(n: number): string {
  if (n === 0) return "zero";
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const chunk = (x: number): string => {
    if (x < 20) return ones[x];
    if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? "-" + ones[x % 10] : "");
    return ones[Math.floor(x / 100)] + " hundred" + (x % 100 ? " and " + chunk(x % 100) : "");
  };
  const parts: string[] = [];
  const units = [["billion", 1e9], ["million", 1e6], ["thousand", 1e3]] as const;
  for (const [name, val] of units) {
    const v = Math.floor(n / (val as number));
    if (v > 0) { parts.push(chunk(v) + " " + name); n -= v * (val as number); }
  }
  if (n > 0) parts.push(chunk(n));
  return parts.join(" ");
}

function preprocessForTts(input: string): string {
  return input.replace(/R\s?(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?/g, (_m, intPart: string, dec?: string) => {
    const clean = intPart.replace(/[,\s]/g, "");
    const n = parseInt(clean, 10);
    if (!isFinite(n)) return _m;
    const noun = n === 1 ? "rand" : "rands";
    let words = numberToWords(n) + " " + noun;
    if (dec) {
      const cents = parseInt(dec.padEnd(2, "0").slice(0, 2), 10);
      if (cents > 0) words += " and " + numberToWords(cents) + " cents";
    }
    return words;
  });
}

async function elevenLabsSynthesize(text: string, voice: string): Promise<Uint8Array> {
  if (!ELEVEN_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    },
  );
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
    const voice = String(
      body.voice ?? (tier === "premium" ? PREMIUM_VOICE_DEFAULT : STANDARD_VOICE),
    );
    const returnBase64 = !!body.returnBase64;
    const uploadPath: string | null = body.uploadPath ?? null;

    const audio = await elevenLabsSynthesize(text, voice);

    // ElevenLabs MP3 at 128kbps
    const duration = Math.max(1, Math.round((audio.length * 8) / (128 * 1000)));

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
      audioBase64: returnBase64 ? encodeBase64(audio) : undefined,
      mimeType: "audio/mpeg",
    });
  } catch (e: any) {
    console.error("voice error", e);
    return json({ error: e?.message ?? "unknown error" }, 500);
  }
});
