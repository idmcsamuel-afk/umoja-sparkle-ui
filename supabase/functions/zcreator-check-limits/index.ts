// RETIRED: the old "videos per month" Creator Studio subscription has been replaced by Creator Credits.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({
    allowed: false, error: "retired",
    message: "Creator Studio now uses Creator Credits instead of a monthly video plan.",
    redirect: "/creator-studio/credits",
  }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
