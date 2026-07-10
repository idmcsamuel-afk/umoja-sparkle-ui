import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BRIGHT_DATA_API_KEY = Deno.env.get("BRIGHT_DATA_API_KEY");
const ZONE = Deno.env.get("BRIGHT_DATA_UNLOCKER_ZONE") || "umoja_web_unlocker1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function unlock(url: string) {
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ zone: ZONE, url, format: "raw", country: "za" }),
  });
  return { status: res.status, body: await res.text() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "search";
  const plid = url.searchParams.get("plid") || "45087393";
  const q = url.searchParams.get("q") || "nivea";

  const target =
    mode === "detail"
      ? `https://api.takealot.com/rest/v-1-13-0/product-details/PLID${plid}?platform=desktop`
      : `https://api.takealot.com/rest/v-1-13-0/searches/products,filters,facets,sort_options,breadcrumbs,slots_audience,context?newsearch=true&qsearch=${encodeURIComponent(q)}&rows=2&detail=mlisting`;

  const { status, body } = await unlock(target);

  let summary: unknown = null;
  try {
    const doc = JSON.parse(body);
    if (mode === "search") {
      const r = doc?.sections?.products?.results?.[0];
      summary = {
        top_level_keys: Object.keys(r?.product_views ?? {}),
        core_keys: Object.keys(r?.product_views?.core ?? {}),
        core: r?.product_views?.core,
        reviews_summary: r?.product_views?.reviews_summary,
        buybox_summary: r?.product_views?.buybox_summary,
      };
    } else {
      summary = {
        top_keys: Object.keys(doc ?? {}),
        core: doc?.core,
        reviews_summary: doc?.reviews_summary,
        review_summary: doc?.review_summary,
      };
    }
  } catch { /* pass raw */ }

  return new Response(
    JSON.stringify({ status, target, summary, raw_snippet: body.slice(0, 2000) }, null, 2),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
