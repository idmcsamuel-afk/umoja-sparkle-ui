import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const KEY = Deno.env.get("BRIGHT_DATA_API_KEY"); const ZONE = Deno.env.get("BRIGHT_DATA_UNLOCKER_ZONE") || "umoja_web_unlocker1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const u = new URL(req.url);
  const target = u.searchParams.get("url")!;
  const res = await fetch("https://api.brightdata.com/request", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ zone: ZONE, url: target, format: "raw", country: "us" }) });
  const html = await res.text();

  // Try to find product card blocks. Alibaba showroom often uses divs
  // containing an anchor to /product-detail/... with data attributes.
  const idxs: number[] = [];
  const re = /product-detail\//g; let m; while ((m = re.exec(html)) && idxs.length < 3) idxs.push(m.index);

  const snippets = idxs.map(i => html.slice(Math.max(0, i - 1500), i + 2500));

  // Also grep for MOQ, price and supplier markers
  const moqCtx = [...html.matchAll(/Min\.? ?Order[\s\S]{0,200}/gi)].slice(0, 3).map(x => x[0]);
  const priceCtx = [...html.matchAll(/US\s*\$\s*[\d.,]+[\s\S]{0,200}/gi)].slice(0, 3).map(x => x[0]);

  // Look for JSON-LD blocks
  const ldMatches = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  const ldTypes = ldMatches.map(m => { try { const j = JSON.parse(m[1].trim()); return j["@type"] || Object.keys(j).slice(0,3); } catch { return "parse-err"; } });

  // Look for challenge markers
  const isChallenge = /captcha|verify.you.re.human|cf-chl|verification challenge|_smartCaptcha/i.test(html);
  const titleMatch = html.match(/<title>([^<]{1,200})<\/title>/i);

  return new Response(JSON.stringify({ len: html.length, title: titleMatch?.[1], isChallenge, ldCount: ldMatches.length, ldTypes, productDetailAnchors: idxs.length, snippets, moqCtx, priceCtx }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
