import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { agentId, manualTrigger = false } = await req.json();
    console.error('[SCRIPT-GEN] Starting for agent:', agentId, 'manualTrigger:', manualTrigger);
    if (!agentId) return json({ error: "agentId required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    // 1. Load agent
    const { data: agent, error: agentErr } = await supabase
      .from("zcreator_story_agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentErr || !agent) return json({ error: "Agent not found" }, 404);
    if (!agent.active && !manualTrigger) return json({ error: "Agent not active" }, 400);

    // Enforce Creator Studio subscription limits
    const { data: sub } = await supabase
      .from("zcreator_subscriptions").select("*").eq("user_id", agent.user_id).maybeSingle();
    const TIER_LIMITS: Record<string, { videos: number; platforms: string[] }> = {
      free:    { videos: 2,    platforms: ["youtube"] },
      creator: { videos: 150,  platforms: ["youtube","tiktok","instagram"] },
      pro:     { videos: 400,  platforms: ["youtube","tiktok","instagram"] },
      agency:  { videos: 1000, platforms: ["youtube","tiktok","instagram"] },
    };
    const tier = (sub?.tier ?? "free");
    const lim = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    const used = sub?.videos_used_this_month ?? 0;
    const limit = sub?.videos_per_month ?? lim.videos;
    if (used >= limit) {
      return json({
        error: "monthly_limit_reached",
        message: `Creator Studio limit reached (${used}/${limit}). Upgrade to continue.`,
        upgradeUrl: "/creator-studio/subscription",
      }, 402);
    }
    const blockedPlatforms = (agent.platforms ?? []).filter((p: string) => !lim.platforms.includes(p));
    if (blockedPlatforms.length) {
      return json({
        error: "platform_not_in_tier",
        message: `Your Creator Studio plan doesn't include: ${blockedPlatforms.join(", ")}. Upgrade to unlock.`,
        upgradeUrl: "/creator-studio/subscription",
      }, 402);
    }

    // 2. Research trends
    const trendPrompt = `Search for trending topics, viral stories, and popular content in the ${agent.niche} niche. Find 5 recent high-performing topics suitable for YouTube/TikTok videos. Focus on topics with high engagement potential.`;

    const trendRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: trendPrompt }],
      }),
    });

    if (!trendRes.ok) {
      const t = await trendRes.text();
      console.error("Trend search failed:", t);
      return json({ error: "Trend search failed", detail: t }, 502);
    }

    const trends = await trendRes.json();
    const trendText = (trends.content ?? [])
      .map((c: any) => c.text || "")
      .join("\n");

    // 3. Generate script
    const scriptPrompt = `You are a viral content creator. Based on these trending topics:\n\n${trendText}\n\nCreate a COMPLETE 75-100 second video script for ${agent.niche} content.

Brand Voice: ${JSON.stringify(agent.brand_voice ?? {})}

REQUIREMENTS — your script MUST follow a complete narrative arc using EXACTLY 3-5 scenes:
- Scene 1 (≈15s): Hook
- Scenes 2-3 (≈40s total): Problem + Solution
- Scene 4 (≈25s): Action Steps
- Scene 5 (≈15s): Call-to-Action

Other rules:
- Minimum 3 scenes, MAXIMUM 5 scenes (hard cap — exceeding 5 will crash rendering)
- Each scene 10-25 seconds of narration
- Total narration must produce 75-100 seconds of audio when read at normal pace
- Natural speaking style for ${agent.niche} audience
- CURRENCY: ALWAYS write rand amounts in words ("two thousand rands" NOT "R2000")

Output ONLY valid JSON (no markdown fences, no commentary, no preamble). Return EXACTLY this shape:
{
  "title": "Catchy video title (under 60 chars)",
  "hook": "First 3 seconds of script",
  "scenes": [
    {"scene_number": 1, "visual": "stock-footage search keywords", "narration": "hook", "duration": 15},
    {"scene_number": 2, "visual": "...", "narration": "problem", "duration": 20},
    {"scene_number": 3, "visual": "...", "narration": "solution", "duration": 20},
    {"scene_number": 4, "visual": "...", "narration": "action steps", "duration": 25},
    {"scene_number": 5, "visual": "...", "narration": "call to action", "duration": 15}
  ],
  "metadata": {
    "youtube_description": "200-word description with timestamps",
    "youtube_tags": ["tag1", "tag2", "tag3"],
    "tiktok_caption": "Caption with hashtags",
    "target_duration_seconds": 90
  }
}

CRITICAL: "scenes" MUST be a non-empty JSON array of 3-5 objects (NEVER more than 5). Do NOT return a string for scenes. Do NOT wrap response in markdown fences.`;

    // Robust JSON extractor — handles markdown fences, preamble, trailing commas, control chars
    const extractJson = (raw: string): any => {
      let s = String(raw ?? "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const start = s.search(/[\{\[]/);
      if (start === -1) throw new Error("No JSON found in response");
      const openCh = s[start];
      const closeCh = openCh === "[" ? "]" : "}";
      const end = s.lastIndexOf(closeCh);
      if (end === -1 || end < start) throw new Error("No JSON terminator found");
      s = s.substring(start, end + 1);
      try { return JSON.parse(s); } catch {
        s = s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
        return JSON.parse(s);
      }
    };

    const callClaudeForScript = async (): Promise<string> => {
      console.error('[SCRIPT-GEN] Sending prompt to Claude...');
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: scriptPrompt }],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Claude HTTP ${r.status}: ${t.slice(0, 300)}`);
      }
      const d = await r.json();
      return d.content?.[0]?.text ?? "";
    };

    console.error("[SCRIPT-GEN] script prompt length:", scriptPrompt.length);
    console.error("[SCRIPT-GEN] script prompt preview:", scriptPrompt.slice(0, 400));

    let scriptJson: any = null;
    let lastRaw = "";
    let lastErr = "";
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const raw = await callClaudeForScript();
        lastRaw = raw;
        console.error(`[SCRIPT-GEN] attempt ${attempt} Claude response:`, JSON.stringify(raw).substring(0, 1000));
        console.error(`[SCRIPT-GEN] Attempting to parse JSON... (attempt ${attempt}, raw length ${raw.length})`);
        const parsed = extractJson(raw);
        console.error(`[SCRIPT-GEN] attempt ${attempt} Parsed script:`, JSON.stringify(parsed).substring(0, 500));
        console.error(`[SCRIPT-GEN] attempt ${attempt} parsed keys:`, Object.keys(parsed ?? {}));
        const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
        console.error(`[SCRIPT-GEN] attempt ${attempt} Scenes array length:`, scenes.length);
        console.error(`[SCRIPT-GEN] attempt ${attempt} First scene:`, JSON.stringify(scenes[0] ?? null));
        if (scenes.length >= 3) {
          scriptJson = parsed;
          break;
        }
        lastErr = `scenes array length ${scenes.length} (need >= 3)`;
        console.error(`[SCRIPT-GEN] ERROR: insufficient scenes on attempt ${attempt}: ${lastErr}`);
        console.error(`[SCRIPT-GEN] Full scriptJson:`, JSON.stringify(parsed));
      } catch (e: any) {
        lastErr = e?.message ?? String(e);
        console.error(`[SCRIPT-GEN] ERROR: attempt ${attempt} parse/fetch failed:`, lastErr);
        console.error(`[SCRIPT-GEN] Raw response that failed:`, lastRaw.substring(0, 1000));
      }
    }

    if (!scriptJson) {
      console.error('[SCRIPT-GEN] ERROR: No scenes found after all attempts. Returning 502.');
      return json({
        error: `Claude API returned invalid format after ${MAX_ATTEMPTS} attempts. ${lastErr}. Raw response: ${lastRaw.slice(0, 500)}`,
      }, 502);
    }

    // Currency post-processing: "R2000" / "R2,000" → "two thousand rands"
    const numberToWords = (n: number): string => {
      if (n === 0) return "zero";
      const ones = ["","one","two","three","four","five","six","seven","eight","nine",
        "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
      const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
      const chunk = (x: number): string => {
        if (x < 20) return ones[x];
        if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? "-" + ones[x%10] : "");
        return ones[Math.floor(x/100)] + " hundred" + (x%100 ? " and " + chunk(x%100) : "");
      };
      const parts: string[] = [];
      const units: Array<[string, number]> = [["billion",1e9],["million",1e6],["thousand",1e3]];
      for (const [name, val] of units) {
        const v = Math.floor(n/val);
        if (v > 0) { parts.push(chunk(v) + " " + name); n -= v*val; }
      }
      if (n > 0) parts.push(chunk(n));
      return parts.join(" ");
    };
    const spellRands = (text: string): string =>
      typeof text === "string"
        ? text.replace(/R\s?(\d{1,3}(?:[,\s]\d{3})+|\d+)/g, (_m, raw: string) => {
            const n = parseInt(raw.replace(/[,\s]/g, ""), 10);
            return isFinite(n) ? `${numberToWords(n)} ${n === 1 ? "rand" : "rands"}` : _m;
          })
        : text;

    if (Array.isArray(scriptJson.scenes)) {
      scriptJson.scenes = scriptJson.scenes.map((s: any) => ({
        ...s,
        narration: spellRands(s?.narration ?? s?.text ?? ""),
        visual: spellRands(s?.visual ?? ""),
      }));
    }
    if (scriptJson.script) scriptJson.script = spellRands(scriptJson.script);
    if (scriptJson.hook) scriptJson.hook = spellRands(scriptJson.hook);

    // Validate narrative structure
    const scenes = Array.isArray(scriptJson.scenes) ? scriptJson.scenes : [];
    const sceneCount = scenes.length;
    const totalDuration = scenes.reduce(
      (s: number, sc: any) => s + (Number(sc?.duration) || Math.max(8, Math.round((String(sc?.narration ?? "").split(/\s+/).length) / 2.5))),
      0,
    );
    if (sceneCount < 3 || sceneCount > 5) {
      return json({ error: `Script generation incomplete: got ${sceneCount} scenes (need 3-5). Regenerate script.` }, 502);
    }
    if (totalDuration < 60) {
      return json({ error: `Script generation incomplete: estimated ${totalDuration}s (need ≥75s). Regenerate script.` }, 502);
    }
    if (totalDuration > 120) {
      return json({ error: `Script generation too long: estimated ${totalDuration}s (max 100s). Regenerate script.` }, 502);
    }

    // 4. Queue content — store full scriptJson (with scenes) so assembly can use it
    const { data: queuedContent, error: qErr } = await supabase
      .from("zcreator_content_queue")
      .insert({
        user_id: agent.user_id,
        agent_id: agentId,
        script_title: scriptJson.title ?? "Untitled",
        script_content: scriptJson,
        video_style: "talking_head",
        platforms: agent.platforms ?? [],
        platform_metadata: scriptJson.metadata ?? {},
        status: "script_ready",
      })
      .select()
      .single();

    if (qErr) {
      console.error("Queue insert failed:", qErr);
      return json({ error: "Queue insert failed", detail: qErr.message }, 500);
    }

    // 5. Update agent stats
    await supabase
      .from("zcreator_story_agents")
      .update({
        videos_created: (agent.videos_created ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId);

    // NOTE: usage counter (videos_used_this_month) is incremented in
    // zcreator-generate-video ONLY when video generation succeeds.
    // Script generation alone must not count against the user's monthly limit.
    if (!sub) {
      await supabase.from("zcreator_subscriptions").insert({
        user_id: agent.user_id,
        tier: "free",
        videos_per_month: limit,
        platforms_enabled: lim.platforms,
        videos_used_this_month: 0,
        billing_cycle_starts_at: new Date().toISOString(),
      });
    }


    return json({
      success: true,
      contentId: queuedContent.id,
      title: scriptJson.title,
    });
  } catch (error: any) {
    console.error("Story agent error:", error);
    return json({ error: error?.message ?? "Unknown error" }, 500);
  }
});
