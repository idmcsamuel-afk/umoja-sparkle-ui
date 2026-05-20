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
    const scriptPrompt = `You are a viral content creator. Based on these trending topics:\n\n${trendText}\n\nCreate a compelling 60-90 second video script for ${agent.niche} content.

Brand Voice: ${JSON.stringify(agent.brand_voice ?? {})}

Requirements:
- Hook in first 3 seconds
- Clear structure: Hook → Problem → Solution → CTA
- Natural speaking style for ${agent.niche} audience
- Include specific examples and stories
- End with strong call-to-action
- Format: Scene-by-scene with visual descriptions

Output ONLY valid JSON:
{
  "title": "Catchy video title (under 60 chars)",
  "script": "Full narration script",
  "scenes": [{"scene_number": 1, "visual": "description", "narration": "what to say"}],
  "hook": "First 3 seconds of script",
  "metadata": {
    "youtube_description": "200-word description with timestamps",
    "youtube_tags": ["tag1", "tag2", "tag3"],
    "tiktok_caption": "Caption with hashtags",
    "target_duration_seconds": 75
  }
}`;

    const scriptRes = await fetch("https://api.anthropic.com/v1/messages", {
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

    if (!scriptRes.ok) {
      const t = await scriptRes.text();
      console.error("Script generation failed:", t);
      return json({ error: "Script generation failed", detail: t }, 502);
    }

    const scriptData = await scriptRes.json();
    const scriptText: string = scriptData.content?.[0]?.text ?? "";
    const jsonMatch = scriptText.match(/\{[\s\S]*\}/);
    let scriptJson: any;
    try {
      scriptJson = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: "Generated Script", script: scriptText };
    } catch {
      scriptJson = { title: "Generated Script", script: scriptText };
    }

    // 4. Queue content
    const { data: queuedContent, error: qErr } = await supabase
      .from("zcreator_content_queue")
      .insert({
        user_id: agent.user_id,
        agent_id: agentId,
        script_title: scriptJson.title ?? "Untitled",
        script_content: scriptJson.script ?? scriptText,
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
