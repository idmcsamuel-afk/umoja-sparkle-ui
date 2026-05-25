// Flame AI — UMOJA's wealth advisor (GPT-4o)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SYSTEM_PROMPTS: Record<string, string> = {
  default:
    "You are Flame, UMOJA's AI wealth advisor. Help South African members make smart financial decisions about circles, trading, car ownership and investing. Be warm, practical and speak in simple terms. Always encourage community wealth building.",
  marketing:
    "You are Flame's marketing copywriter for UMOJA, a South African community wealth platform. Write punchy, on-brand copy that highlights community, trust and ubuntu values. Avoid hype and never make financial guarantees.",
};

interface ChatMessage { role: "user" | "assistant" | "system"; content: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require auth — prevents anonymous users from draining OpenAI credits
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supa.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "service_unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const messages = (body?.messages ?? []) as ChatMessage[];

    // Pick a server-controlled prompt by feature key — never trust client-supplied system prompt
    const promptKey = typeof body?.prompt === "string" && body.prompt in SYSTEM_PROMPTS
      ? body.prompt as keyof typeof SYSTEM_PROMPTS
      : "default";
    const systemPrompt = SYSTEM_PROMPTS[promptKey];

    // Validate temperature range
    const rawTemp = typeof body?.temperature === "number" ? body.temperature : 0.6;
    const temperature = Math.max(0, Math.min(2, rawTemp));

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = messages.slice(-12).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 4000),
    }));

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature,
        max_tokens: 800,
        messages: [{ role: "system", content: systemPrompt }, ...trimmed],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[flame-ai] openai error:", res.status, errText.slice(0, 500));
      return new Response(JSON.stringify({ error: "ai_unavailable" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const reply: string = data?.choices?.[0]?.message?.content ?? "Hmm, I didn't catch that. Try again?";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[flame-ai] server error:", e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
