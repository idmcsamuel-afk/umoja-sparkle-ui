// Alibaba Open Platform OAuth test harness.
// Actions:
//   GET  ?action=authUrl&redirect=<url>   -> returns authorization URL
//   GET  ?action=exchange&code=<code>&redirect=<url> -> exchanges code -> token via /auth/token/create
//   GET  ?action=search&token=<access_token>&q=<query> -> tries /icbu/product/list or /alibaba/icbu/product/list

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_KEY = Deno.env.get("ALIBABA_APP_KEY") ?? "";
const APP_SECRET = Deno.env.get("ALIBABA_APP_SECRET") ?? "";

// Alibaba Open Platform gateway (new global endpoint)
const GATEWAY = "https://openapi-api.alibaba.com/rest";

async function hmacSha256Hex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Alibaba signature (v2 gateway):
 *   base = "/" + apiPath (e.g. "auth/token/create") + sorted(k+v concatenated)
 *   sign = HMAC-SHA256(app_secret, base) -> uppercase hex
 */
async function signRequest(apiPath: string, params: Record<string, string>) {
  const sorted = Object.keys(params).sort();
  let concat = "/" + apiPath;
  for (const k of sorted) concat += k + params[k];
  return await hmacSha256Hex(APP_SECRET, concat);
}

async function callApi(apiPath: string, bizParams: Record<string, string>) {
  const params: Record<string, string> = {
    ...bizParams,
    app_key: APP_KEY,
    sign_method: "sha256",
    timestamp: String(Date.now()),
  };
  const sign = await signRequest(apiPath, params);
  const url = `${GATEWAY}/${apiPath}`;
  const body = new URLSearchParams({ ...params, sign }).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, url, sentParams: { ...params, sign }, raw: text, json };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const u = new URL(req.url);
  const action = u.searchParams.get("action") ?? "authUrl";

  try {
    if (!APP_KEY || !APP_SECRET) {
      return new Response(JSON.stringify({ error: "Missing ALIBABA_APP_KEY / ALIBABA_APP_SECRET" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "authUrl") {
      const httpsOrigin = u.origin.replace(/^http:\/\//, "https://");
      const redirect = u.searchParams.get("redirect") ?? `${httpsOrigin}/functions/v1/alibaba-auth?action=exchange`;
      const state = u.searchParams.get("state") ?? crypto.randomUUID();
      // Official Alibaba.com ICBU OAuth authorize endpoint (per open.alitrip.com docs, articleId=118846).
      // Use oauth.alibaba.com — NOT auth.alibaba.com (which serves a Kubernetes fake cert).
      // sp=icbu selects the Alibaba.com International login skin.
      const authUrl = `https://oauth.alibaba.com/authorize?response_type=code&client_id=${encodeURIComponent(APP_KEY)}&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}&view=web&sp=icbu`;
      return new Response(JSON.stringify({ authUrl, appKey: APP_KEY, redirect, state }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange") {
      const code = u.searchParams.get("code");
      const redirect = u.searchParams.get("redirect") ?? `${u.origin}/functions/v1/alibaba-auth?action=exchange`;
      if (!code) {
        return new Response(JSON.stringify({ error: "Missing code query param" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Token exchange goes to https://oauth.alibaba.com/token as a form POST — NOT the /rest signed gateway.
      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: APP_KEY,
        client_secret: APP_SECRET,
        redirect_uri: redirect,
        sp: "icbu",
      }).toString();
      const tokenRes = await fetch("https://oauth.alibaba.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody,
      });
      const tokenText = await tokenRes.text();
      let tokenJson: unknown = null;
      try { tokenJson = JSON.parse(tokenText); } catch { /* keep raw */ }
      return new Response(
        JSON.stringify(
          { status: tokenRes.status, endpoint: "https://oauth.alibaba.com/token", raw: tokenText, json: tokenJson },
          null,
          2,
        ),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "search") {
      const token = u.searchParams.get("token");
      const q = u.searchParams.get("q") ?? "phone case";
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Try buyer product search — path may vary; return the raw response either way.
      const result = await callApi("alibaba/icbu/product/list", {
        access_token: token,
        keyword: q,
        page_size: "10",
        page_no: "1",
      });
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action", allowed: ["authUrl", "exchange", "search"] }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
