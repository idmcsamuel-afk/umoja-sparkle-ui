// Member video creation - called from the 5-step wizard
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://umoja-sparkle-ui.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { script_id, avatar_id, custom_script } = body as {
      script_id?: string; avatar_id?: string; custom_script?: string;
    };
    if (!avatar_id) return json({ error: "avatar_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Resolve script text
    let scriptText = (custom_script ?? "").trim();
    if (!scriptText && script_id) {
      const { data: s } = await admin.from("ai_generated_scripts").select("script_text").eq("id", script_id).maybeSingle();
      scriptText = s?.script_text ?? "";
    }
    if (!scriptText || scriptText.length < 20) return json({ error: "script too short" }, 400);

    // Pull member referral code
    const { data: member } = await admin.from("members").select("referral_code, full_name").eq("id", user.id).maybeSingle();
    const refCode = member?.referral_code ?? "";
    const refLink = refCode ? `${PUBLIC_APP_URL}/signup?ref=${refCode}` : PUBLIC_APP_URL;

    // Append outro line
    const fullScript = `${scriptText}\n\nJoin me on UMOJA — use my code ${refCode || ""}.`;

    const { data: avatar } = await admin.from("ai_avatars").select("*").eq("id", avatar_id).maybeSingle();
    if (!avatar || !avatar.is_active) return json({ error: "avatar not available" }, 400);

    // Call HeyGen
    let heygenVideoId: string | null = null;
    let status = "pending";
    let errorMessage: string | null = null;
    if (HEYGEN_API_KEY && avatar.heygen_avatar_id && avatar.voice_id) {
      try {
        const r = await fetch("https://api.heygen.com/v2/video/generate", {
          method: "POST",
          headers: { "X-Api-Key": HEYGEN_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            video_inputs: [{
              character: { type: "avatar", avatar_id: avatar.heygen_avatar_id, avatar_style: "normal" },
              voice: { type: "text", input_text: fullScript, voice_id: avatar.voice_id },
              background: { type: "color", value: "#F3F4F6" },
            }],
            dimension: { width: 1080, height: 1920 },
            aspect_ratio: "9:16",
          }),
        });
        const data = await r.json();
        if (r.ok && data?.data?.video_id) {
          heygenVideoId = data.data.video_id;
          status = "generating";
        } else {
          status = "failed";
          errorMessage = JSON.stringify(data).slice(0, 500);
        }
      } catch (e) { status = "failed"; errorMessage = String(e).slice(0, 500); }
    } else if (!HEYGEN_API_KEY) {
      errorMessage = "Video generation not yet configured. Your video will be ready soon.";
    }

    const caption = `${(scriptText.split(/[.!?]/)[0] || "").trim()}.\n\nJoin UMOJA with my code ${refCode}: ${refLink}`;

    const { data: row, error } = await admin.from("member_generated_videos").insert({
      member_id: user.id,
      script_id: script_id ?? null,
      avatar_id,
      script_text: fullScript,
      heygen_video_id: heygenVideoId,
      generation_status: status,
      caption,
      referral_code: refCode,
      referral_link: refLink,
      error_message: errorMessage,
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, video: row, heygen_configured: !!HEYGEN_API_KEY });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
