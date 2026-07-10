// Temporary investigation function: fetch Alibaba search via Bright Data
// Web Unlocker and report what comes back (HTML vs JSON, key markers,
// possible XHR endpoints, selector candidates).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRIGHT_DATA_API_KEY = Deno.env.get("BRIGHT_DATA_API_KEY");
const BRIGHT_DATA_UNLOCKER_ZONE =
  Deno.env.get("BRIGHT_DATA_UNLOCKER_ZONE") || "umoja_web_unlocker1";

async function unlock(url: string, country = "us"): Promise<{ status: number; body: string }> {
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      zone: BRIGHT_DATA_UNLOCKER_ZONE,
      url,
      format: "raw",
      country,
    }),
  });
  const body = await res.text();
  return { status: res.status, body };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "hair clipper";
    const target =
      url.searchParams.get("url") ||
      `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(q)}`;

    const { status, body } = await unlock(target, "us");

    // Signals
    const len = body.length;
    const isJson = body.trim().startsWith("{") || body.trim().startsWith("[");
    const hasWindowRunParams = body.includes("window.runParams");
    const hasNextData = body.includes("__NEXT_DATA__");
    const hasOfferList = body.toLowerCase().includes("offer_list") ||
      body.toLowerCase().includes("offerlist");
    const hasDataProductId = /data-product[-_]id=/i.test(body);
    const hasProductCard = /organic-list|list-no-v2|fy23-list-card|search-card|J-search-card/i.test(body);
    const moqMentions = (body.match(/Min\.? ?Order/gi) || []).length;
    const priceMentions = (body.match(/US\$|\$\d/g) || []).length;

    // Try to sniff XHR endpoints referenced in the HTML
    const xhrHits = Array.from(
      body.matchAll(/https?:\/\/[^"'\s<>]*(?:mtop|acs|h5api|search[^"'\s<>]*)[^"'\s<>]*/gi),
    ).map((m) => m[0]).slice(0, 15);

    // Look at script blobs that might carry embedded data
    const scriptWithData = body.match(/window\.runParams\s*=\s*\{[\s\S]{0,400}/);
    const nextDataSnippet = body.match(/__NEXT_DATA__[\s\S]{0,400}/);

    return new Response(
      JSON.stringify({
        target,
        http_status: status,
        length: len,
        signals: {
          isJson,
          hasWindowRunParams,
          hasNextData,
          hasOfferList,
          hasDataProductId,
          hasProductCard,
          moqMentions,
          priceMentions,
        },
        xhrHits,
        scriptWithData_preview: scriptWithData ? scriptWithData[0] : null,
        nextData_preview: nextDataSnippet ? nextDataSnippet[0] : null,
        head_preview: body.slice(0, 800),
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
