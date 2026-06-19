import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const callerId = userData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const memberId: string = body?.memberId ?? callerId;
    const force: boolean = !!body?.force;

    if (memberId !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Reuse cached blueprint unless force
    if (!force) {
      const { data: cached } = await admin
        .from("spark_trade_blueprints")
        .select("blueprint_json")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached?.blueprint_json) {
        return new Response(JSON.stringify(cached.blueprint_json), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: member, error: memberErr } = await admin
      .from("members")
      .select(
        "spark_trade_income_goal, spark_trade_capital, spark_trade_business_type, spark_trade_service_area, spark_trade_stock_preference, spark_trade_group_buy_interest, country_code"
      )
      .eq("id", memberId)
      .maybeSingle();
    if (memberErr || !member) {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an African business consultant specialising in micro-wholesale.

Based on these member preferences, generate a detailed AI business blueprint:

Income Goal: ${(member as any).spark_trade_income_goal ?? "unspecified"} ZAR/month
Capital Available: ${(member as any).spark_trade_capital ?? "unspecified"} ZAR
Business Type: ${(member as any).spark_trade_business_type ?? "unspecified"}
Service Area: ${(member as any).spark_trade_service_area ?? "unspecified"}
Stock Preference: ${(member as any).spark_trade_stock_preference ?? "unspecified"}
Group Buy Interest: ${(member as any).spark_trade_group_buy_interest ? "yes" : "no"}
Country: ${(member as any).country_code ?? "ZA"}

Return ONLY valid JSON (no markdown, no commentary) with these fields:
- recommended_business_name (string, 2-4 words)
- recommended_products (array of 3-5 items, each: { name, moq, unit_cost_zar, suggested_selling_price_zar })
- estimated_startup_capital (integer ZAR)
- estimated_monthly_revenue (integer ZAR)
- estimated_gross_margin (string like "38%")
- overall_moq_fill_percentage (integer 0-100)
- estimated_launch_timeline_days (integer)
- confidence_score (integer 0-100)`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const txt = await claudeRes.text();
      console.error("[blueprint] Claude error", claudeRes.status, txt);
      return new Response(
        JSON.stringify({ error: `Claude API error: ${claudeRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeRes.json();
    const raw: string = claudeData?.content?.[0]?.text ?? "";
    // Extract JSON in case Claude wraps in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[blueprint] No JSON in Claude response", raw);
      return new Response(
        JSON.stringify({ error: "Invalid AI response format" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let blueprint: any;
    try {
      blueprint = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[blueprint] JSON parse failed", e);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Persist
    const grossMarginRaw = blueprint.estimated_gross_margin;
    const grossMarginInt =
      typeof grossMarginRaw === "number"
        ? Math.round(grossMarginRaw)
        : parseInt(String(grossMarginRaw).replace(/[^0-9]/g, ""), 10) || null;

    const { error: insertErr } = await admin.from("spark_trade_blueprints").insert({
      member_id: memberId,
      income_goal: (member as any).spark_trade_income_goal ?? null,
      recommended_business_name: blueprint.recommended_business_name ?? null,
      recommended_products: blueprint.recommended_products ?? [],
      estimated_startup_capital: blueprint.estimated_startup_capital ?? null,
      estimated_monthly_revenue: blueprint.estimated_monthly_revenue ?? null,
      estimated_gross_margin: grossMarginInt,
      overall_moq_fill_percentage: blueprint.overall_moq_fill_percentage ?? null,
      estimated_launch_timeline_days: blueprint.estimated_launch_timeline_days ?? null,
      confidence_score: blueprint.confidence_score ?? null,
      blueprint_json: blueprint,
    });

    if (insertErr) {
      console.error("[blueprint] DB insert failed", insertErr);
    }

    return new Response(JSON.stringify(blueprint), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[blueprint] unexpected error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
