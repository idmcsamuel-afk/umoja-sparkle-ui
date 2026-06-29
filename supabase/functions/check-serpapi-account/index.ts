const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = Deno.env.get("SERPAPI_KEY");
  if (!key) return new Response(JSON.stringify({ error: "SERPAPI_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const r = await fetch(`https://serpapi.com/account?api_key=${key}`);
  const body = await r.text();
  return new Response(body, { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
