import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("platform_settings")
      .select(
        "bank_name, account_name, account_number, branch_code, payment_instructions, payouts_seed, payouts_growth, payouts_harvest, seed_override_open, growth_override_open, harvest_override_open, override_expires_at, usdt_trc20_address, crypto_enabled",
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);

    return json(data ?? {});
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});