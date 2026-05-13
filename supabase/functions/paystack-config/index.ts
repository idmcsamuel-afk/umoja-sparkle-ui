// Returns the Paystack public key so the SPA can initialize the inline checkout.
// The public key is safe to expose by design.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ public_key: Deno.env.get("PAYSTACK_PUBLIC_KEY") ?? null }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
