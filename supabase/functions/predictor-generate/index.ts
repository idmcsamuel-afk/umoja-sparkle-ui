import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI) throw new Error("OPENAI_API_KEY not set");

    // Verify caller is admin
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdm } = await admin.from("admin_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!isAdm) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sys = "You generate market prediction questions for South African traders. Topics: USD/ZAR, gold, JSE stocks, crypto, commodities. Be specific, timely, and binary/multi-choice. Respond ONLY with a JSON object: { \"questions\": [{ \"question\": string, \"options\": [string, string, ...], \"category\": string, \"closes_in_days\": number, \"sparks_cost\": number, \"sparks_reward\": number }] } with exactly 5 items.";

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: "Generate 5 fresh prediction questions for this week." },
        ],
      }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const json = await r.json();
    const parsed = JSON.parse(json.choices[0].message.content);
    const questions = parsed.questions ?? [];

    const rows = questions.map((q: any) => ({
      question: String(q.question).slice(0, 500),
      options: Array.isArray(q.options) ? q.options.slice(0, 6).map(String) : ["Yes", "No"],
      category: String(q.category || "market").slice(0, 50),
      closes_at: new Date(Date.now() + (Number(q.closes_in_days) || 7) * 86400000).toISOString(),
      sparks_cost: Math.max(1, Number(q.sparks_cost) || 10),
      sparks_reward: Math.max(1, Number(q.sparks_reward) || 25),
      status: "active",
    }));

    const { error, data } = await admin.from("predictor_questions").insert(rows).select("id");
    if (error) throw error;

    return new Response(JSON.stringify({ inserted: data?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
