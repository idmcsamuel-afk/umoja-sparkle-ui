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

const APP_KEY_RAW = Deno.env.get("ALIBABA_APP_KEY") ?? "";
const APP_SECRET_RAW = Deno.env.get("ALIBABA_APP_SECRET") ?? "";
const normalizeSecretValue = (value: string) => value.trim().replace(/^("|')(.+)\1$/, "$2");
const APP_KEY = normalizeSecretValue(APP_KEY_RAW);
const APP_SECRET = normalizeSecretValue(APP_SECRET_RAW);

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
function buildSignBaseString(apiName: string, params: Record<string, string>) {
  const sorted = Object.keys(params).sort();
  let concat = apiName;
  for (const k of sorted) concat += k + params[k];
  return { sorted, baseString: concat };
}

async function signRequest(apiName: string, params: Record<string, string>) {
  const { sorted, baseString } = buildSignBaseString(apiName, params);
  const sign = await hmacSha256Hex(APP_SECRET, baseString);
  return { sign, sorted, baseString };
}

async function callApi(apiName: string, bizParams: Record<string, string>, options: { method?: "GET" | "POST" } = {}) {
  const method = options.method ?? "POST";
  const apiPath = apiName.replace(/^\//, "");
  const params: Record<string, string> = {
    ...bizParams,
    app_key: APP_KEY,
    sign_method: "sha256",
    timestamp: String(Date.now()),
  };
  const { sign, sorted, baseString } = await signRequest(apiName, params);
  const url = `${GATEWAY}/${apiPath}`;
  const signedParams = { ...params, sign };
  const query = new URLSearchParams(signedParams).toString();
  const requestUrl = method === "GET" ? `${url}?${query}` : url;
  const res = await fetch(requestUrl, {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Protocol": "GOP",
    },
    body: method === "POST" ? query : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return {
    status: res.status,
    url,
    method,
    transport: method === "GET" ? "all signed params in query string" : "all signed params in x-www-form-urlencoded body",
    sentParams: signedParams,
    signDiagnostics: {
      apiName,
      sortedParamKeys: sorted,
      signExcludedFromBaseString: true,
      signBaseString: baseString,
      hmac: "HMAC-SHA256(APP_SECRET, UTF-8 signBaseString) => uppercase hex",
      credentialNormalization: {
        appKeyNormalized: APP_KEY_RAW !== APP_KEY,
        appSecretNormalized: APP_SECRET_RAW !== APP_SECRET,
      },
      officialSdkComparison: "Matches the official GOP Python sample: API_OPERATION ('/auth/token/create') + sorted(key + value), excluding sign; POST all signed params as application/x-www-form-urlencoded with X-Protocol: GOP.",
    },
    raw: text,
    json,
  };
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
      // Alibaba Open Platform (GOP / openapi.alibaba.com) OAuth authorize endpoint.
      // NOT oauth.alibaba.com (that's the legacy Taobao/ICBU TOP server — apps registered on
      // openapi.alibaba.com are unknown there, which produces param-appkey.not.exists).
      // No sp= or view= parameters — those are Taobao/ICBU-console concepts.
      const authUrl = `https://openapi-auth.alibaba.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(APP_KEY)}&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`;
      return new Response(JSON.stringify({ authUrl, appKey: APP_KEY, redirect, state }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange") {
      const code = u.searchParams.get("code");
      if (!code) {
        return new Response(JSON.stringify({ error: "Missing code query param" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Token exchange on openapi.alibaba.com is a SIGNED GOP call to /auth/token/create.
      // The official Python GOP sample posts all signed params together as
      // application/x-www-form-urlencoded with X-Protocol: GOP.
      const result = await callApi("/auth/token/create", { code }, { method: "POST" });
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      const result = await callApi("/alibaba/icbu/product/list", {
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
