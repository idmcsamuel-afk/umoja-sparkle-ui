// Autonomous AI Content Director - runs on schedule (e.g. every 6h)
// 1. Checks video queue
// 2. Generates new scripts via Lovable AI Gateway (Gemini)
// 3. Creates videos via HeyGen API (if HEYGEN_API_KEY present, else stays pending)
// 4. Schedules posts for next 7 days
// 5. Recomputes avatar performance scores

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const SYSTEM_PROMPT = `You are the Content Director for UMOJA, a South African savings circle platform. Generate authentic UGC video scripts (30-60s) that highlight 15% returns in 5 days, no credit checks, community-first, and the 100 Sparks per friend referral. Address South African objections (scam fears, trust). Persona angles: 1) Uber driver 2) Spaza owner 3) Young pro 4) Single parent 5) Student.

CRITICAL: Use proper South African currency format in spoken script text:
- Write "one thousand rands" NOT "R one thousand"
- Write "one hundred and fifty rands" NOT "R one hundred fifty"
- Write "two thousand three hundred rands" NOT "R two thousand three hundred"

Examples:
✅ CORRECT: "I put in one thousand rands, got one thousand one hundred and fifty rands back"
❌ WRONG: "I put in R1,000, got R1,150 back"

Always spell out currency amounts in words that match how South Africans speak. Never use the "R" symbol or numeric digits for money in the spoken script — the avatar will read it aloud.`;

async function generateScripts(count: number, campaignId: string | null) {
  if (!ANTHROPIC_API_KEY) {
    console.warn("[director] ANTHROPIC_API_KEY missing — skipping script gen");
    return [];
  }
  const userPrompt = `Generate ${count} unique scripts. Each: 30-60s spoken text, a 5-second hook, a persona (1-5), and a type (problem_solution|results|community|objection). Return ONLY a JSON array of objects with keys: script, persona, type, hook. No prose, no code fences.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    console.error("[director] anthropic error", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  const raw = data?.content?.[0]?.text ?? "[]";
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    const rows = parsed.map((s: any) => ({
      campaign_id: campaignId,
      script_text: String(s.script ?? "").trim(),
      script_type: String(s.type ?? "general"),
      hook: String(s.hook ?? "").slice(0, 200),
      persona_index: Number(s.persona) || null,
      generated_by: "lovable_ai",
    })).filter((r: any) => r.script_text.length > 30);
    if (rows.length === 0) return [];
    const { data: inserted, error } = await supabase
      .from("ai_generated_scripts").insert(rows).select();
    if (error) { console.error("[director] insert scripts", error); return []; }
    return inserted ?? [];
  } catch (e) {
    console.error("[director] JSON parse failed", e, cleaned.slice(0, 200));
    return [];
  }
}

async function createHeygenVideo(avatar: any, script: any, campaignId: string | null) {
  let heygenVideoId: string | null = null;
  let status = "pending";
  let errorMessage: string | null = null;

  if (HEYGEN_API_KEY && avatar.heygen_avatar_id && avatar.voice_id) {
    try {
      const res = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: {
          "X-Api-Key": HEYGEN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_inputs: [{
            character: { type: "avatar", avatar_id: avatar.heygen_avatar_id, avatar_style: "normal" },
            voice: { type: "text", input_text: script.script_text, voice_id: avatar.voice_id },
            background: { type: "color", value: "#F3F4F6" },
          }],
          dimension: { width: 1080, height: 1920 },
          aspect_ratio: "9:16",
        }),
      });
      const data = await res.json();
      if (res.ok && data?.data?.video_id) {
        heygenVideoId = data.data.video_id;
        status = "generating";
      } else {
        status = "failed";
        errorMessage = JSON.stringify(data).slice(0, 500);
      }
    } catch (e) {
      status = "failed";
      errorMessage = String(e).slice(0, 500);
    }
  } else if (!HEYGEN_API_KEY) {
    errorMessage = "HEYGEN_API_KEY not configured";
  }

  const caption = generateCaption(script.script_text);
  await supabase.from("ai_generated_videos").insert({
    campaign_id: campaignId,
    avatar_id: avatar.id,
    script_id: script.id,
    heygen_video_id: heygenVideoId,
    generation_status: status,
    video_caption: caption,
    error_message: errorMessage,
  });
}

function generateCaption(script: string): string {
  const firstSentence = (script.split(/[.!?]/)[0] || script).trim();
  return `${firstSentence}. 💰

Join UMOJA Circles — earn 15% in 5 days. No credit checks, just community 🤝
Link in bio 👆

#UMOJAcircles #FinancialFreedom #SouthAfrica #PassiveIncome`;
}

async function scheduleNextWeek() {
  const { data: videos } = await supabase
    .from("ai_generated_videos")
    .select("id")
    .eq("generation_status", "ready")
    .not("id", "in",
      `(select video_id from ai_scheduled_posts where video_id is not null)`,
    )
    .limit(70);
  if (!videos || videos.length === 0) return 0;

  const slots = {
    instagram: ["09:00", "13:00", "18:00"],
    tiktok: ["08:00", "11:00", "14:00", "17:00", "20:00"],
    facebook: ["10:00", "16:00"],
  };
  const today = new Date();
  let i = 0;
  const inserts: any[] = [];
  for (let d = 0; d < 7 && i < videos.length; d++) {
    for (const [platform, times] of Object.entries(slots)) {
      for (const t of times) {
        if (i >= videos.length) break;
        const [h, m] = t.split(":").map(Number);
        const when = new Date(today);
        when.setDate(when.getDate() + d);
        when.setHours(h, m, 0, 0);
        if (when <= new Date()) { i++; continue; }
        inserts.push({
          video_id: videos[i].id,
          platform,
          scheduled_for: when.toISOString(),
          post_status: "scheduled",
        });
        i++;
      }
    }
  }
  if (inserts.length > 0) await supabase.from("ai_scheduled_posts").insert(inserts);
  return inserts.length;
}

async function recomputeAvatarPerformance() {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: posts } = await supabase
    .from("ai_scheduled_posts")
    .select("engagement_metrics, ai_generated_videos(avatar_id)")
    .eq("post_status", "posted")
    .gte("posted_at", since);
  if (!posts) return;
  const stats: Record<string, { sum: number; n: number }> = {};
  for (const p of posts as any[]) {
    const avatarId = p.ai_generated_videos?.avatar_id;
    if (!avatarId) continue;
    const m = p.engagement_metrics || {};
    const eng = (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
    stats[avatarId] ??= { sum: 0, n: 0 };
    stats[avatarId].sum += eng;
    stats[avatarId].n += 1;
  }
  for (const [id, s] of Object.entries(stats)) {
    const avg = s.n > 0 ? Number((s.sum / s.n).toFixed(2)) : 0;
    await supabase.from("ai_avatars").update({
      performance_score: avg,
      times_used: s.n,
    }).eq("id", id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let testMode = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        testMode = body?.test_mode === true;
      } catch { /* no body */ }
    }
    console.log("[director] test_mode:", testMode);

    // Find active campaign (most recent)
    const { data: campaigns } = await supabase
      .from("ai_content_campaigns").select("*").eq("status", "active")
      .order("started_at", { ascending: false }).limit(1);
    const campaign = campaigns?.[0] ?? null;
    const campaignId = campaign?.id ?? null;
    const settings = campaign?.autonomous_settings ?? {};
    const targetMin = settings.target_queue_min ?? 100;
    const targetMax = settings.target_queue_max ?? 150;

    // Queue size
    const { count: queueSize } = await supabase
      .from("ai_generated_videos").select("id", { count: "exact", head: true })
      .eq("generation_status", "ready");

    const queue = queueSize ?? 0;
    let videosNeeded = 0;
    let scriptsCreated = 0;
    let videosCreated = 0;

    console.log("[director] campaign:", campaign ? { id: campaign.id, status: campaign.status, name: campaign.name } : "NONE");
    console.log("[director] queue size:", queue, "targetMin:", targetMin, "targetMax:", targetMax);
    console.log("[director] settings:", settings);
    console.log("[director] ANTHROPIC_API_KEY set:", !!ANTHROPIC_API_KEY, "HEYGEN_API_KEY set:", !!HEYGEN_API_KEY);

    const willGenerate = testMode || (queue < targetMin && settings.auto_videos !== false);
    console.log("[director] will generate videos:", willGenerate, `(queue ${queue} < targetMin ${targetMin}: ${queue < targetMin}, auto_videos !== false: ${settings.auto_videos !== false}, test_mode: ${testMode})`);

    if (willGenerate) {
      videosNeeded = testMode ? 5 : (targetMax - queue);
      const scriptsNeeded = testMode ? 5 : Math.min(20, Math.max(5, Math.ceil(videosNeeded / 3)));
      console.log("[director] videosNeeded:", videosNeeded, "scriptsNeeded:", scriptsNeeded);
      console.log("[director] generating batch of:", scriptsNeeded, "scripts");

      if (settings.auto_scripts !== false) {
        const newScripts = await generateScripts(scriptsNeeded, campaignId);
        scriptsCreated = newScripts.length;
        console.log("[director] scriptsCreated:", scriptsCreated);
      } else {
        console.log("[director] auto_scripts disabled, skipping script generation");
      }

      // Pull recent unused scripts
      const { data: scripts } = await supabase
        .from("ai_generated_scripts").select("*")
        .lt("used_count", 3)
        .order("created_at", { ascending: false }).limit(scriptsNeeded);

      const { data: avatars } = await supabase
        .from("ai_avatars").select("*").eq("is_active", true)
        .order("performance_score", { ascending: false }).limit(testMode ? 1 : 3);

      if (scripts && avatars && avatars.length > 0) {
        for (const script of scripts) {
          for (const avatar of avatars) {
            if (videosCreated >= videosNeeded) break;
            await createHeygenVideo(avatar, script, campaignId);
            videosCreated++;
          }
          await supabase.from("ai_generated_scripts")
            .update({ used_count: (script.used_count ?? 0) + avatars.length })
            .eq("id", script.id);
          if (videosCreated >= videosNeeded) break;
        }
      }
    }

    let scheduled = 0;
    if (settings.auto_schedule !== false) {
      scheduled = await scheduleNextWeek();
    }

    if (settings.auto_pause_low !== false) {
      await supabase.from("ai_avatars").update({ is_active: false })
        .lt("performance_score", 5).gte("times_used", 10);
    }

    await recomputeAvatarPerformance();

    return new Response(JSON.stringify({
      ok: true, queue, videosNeeded, scriptsCreated, videosCreated, scheduled,
      heygen_configured: !!HEYGEN_API_KEY,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[director] error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
