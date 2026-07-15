// Alibaba Open Platform OAuth + Buyer-Product test harness.
// Actions:
//   GET  ?action=authUrl&redirect=<url>
//   GET  ?action=exchange&code=<code>          -> exchange + STORE tokens
//   GET  ?action=refresh                       -> refresh stored token
//   GET  ?action=tokenStatus                   -> stored token metadata (no secrets)
//   GET  ?action=productSearch&q=<query>       -> Buyer-Product keyword search
//   GET  ?action=imageSearch&image=<url>       -> Buyer-Product image search (/icbu/product/image/search)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_KEY_RAW = Deno.env.get("ALIBABA_APP_KEY") ?? "";
const APP_SECRET_RAW = Deno.env.get("ALIBABA_APP_SECRET") ?? "";
const normalizeSecretValue = (value: string) => value.trim().replace(/^("|')(.+)\1$/, "$2");
const APP_KEY = normalizeSecretValue(APP_KEY_RAW);
const APP_SECRET = normalizeSecretValue(APP_SECRET_RAW);

const GATEWAY = "https://openapi-api.alibaba.com/rest";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

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

function buildSignBaseString(apiName: string, params: Record<string, string>) {
  const sorted = Object.keys(params).sort();
  let concat = apiName;
  for (const k of sorted) concat += k + params[k];
  return { sorted, baseString: concat };
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
  const { sorted, baseString } = buildSignBaseString(apiName, params);
  const sign = await hmacSha256Hex(APP_SECRET, baseString);
  const signedParams = { ...params, sign };
  const query = new URLSearchParams(signedParams).toString();
  const url = `${GATEWAY}/${apiPath}`;
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
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return {
    status: res.status,
    url,
    method,
    apiName,
    signBaseString: baseString,
    sortedParamKeys: sorted,
    sentParams: signedParams,
    raw: text,
    json,
  };
}

async function saveTokens(tokenPayload: any) {
  // GOP token response uses snake_case; expires_in is seconds.
  const access_token = tokenPayload?.access_token;
  const refresh_token = tokenPayload?.refresh_token ?? null;
  const expires_in = Number(tokenPayload?.expires_in ?? 0);
  const refresh_expires_in = Number(tokenPayload?.refresh_expires_in ?? 0);
  if (!access_token) return { saved: false, reason: "no access_token in payload" };
  const now = Date.now();
  const expires_at = expires_in ? new Date(now + expires_in * 1000).toISOString() : null;
  const refresh_expires_at = refresh_expires_in ? new Date(now + refresh_expires_in * 1000).toISOString() : null;
  const { error } = await supabase.from("alibaba_tokens").upsert({
    id: "default",
    access_token,
    refresh_token,
    expires_at,
    refresh_expires_at,
    raw: tokenPayload,
    updated_at: new Date().toISOString(),
  });
  return { saved: !error, error: error?.message, expires_at, refresh_expires_at };
}

async function getStoredToken() {
  const { data, error } = await supabase.from("alibaba_tokens").select("*").eq("id", "default").maybeSingle();
  if (error) throw new Error(`token read failed: ${error.message}`);
  return data;
}

async function refreshStoredToken() {
  const row = await getStoredToken();
  if (!row?.refresh_token) throw new Error("No refresh_token stored — run ?action=exchange first");
  const result = await callApi("/auth/token/refresh", { refresh_token: row.refresh_token }, { method: "POST" });
  if (result.json?.access_token) {
    const save = await saveTokens(result.json);
    return { ...result, saveResult: save };
  }
  return result;
}

async function getValidAccessToken(): Promise<string> {
  const row = await getStoredToken();
  if (!row) throw new Error("No stored Alibaba token — run ?action=exchange after OAuth");
  const expMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  // Refresh if <10min left.
  if (expMs && expMs - Date.now() < 10 * 60 * 1000 && row.refresh_token) {
    const r = await callApi("/auth/token/refresh", { refresh_token: row.refresh_token }, { method: "POST" });
    if (r.json?.access_token) {
      await saveTokens(r.json);
      return r.json.access_token as string;
    }
  }
  return row.access_token as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const u = new URL(req.url);
  const action = u.searchParams.get("action") ?? "authUrl";
  const jsonRes = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!APP_KEY || !APP_SECRET) {
      return jsonRes({ error: "Missing ALIBABA_APP_KEY / ALIBABA_APP_SECRET" }, 500);
    }

    if (action === "authUrl") {
      const httpsOrigin = u.origin.replace(/^http:\/\//, "https://");
      const redirect = u.searchParams.get("redirect") ?? `${httpsOrigin}/functions/v1/alibaba-auth?action=exchange`;
      const state = u.searchParams.get("state") ?? crypto.randomUUID();
      const authUrl = `https://openapi-auth.alibaba.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(APP_KEY)}&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`;
      return jsonRes({ authUrl, appKey: APP_KEY, redirect, state });
    }

    if (action === "exchange") {
      const code = u.searchParams.get("code");
      if (!code) return jsonRes({ error: "Missing code query param" }, 400);
      const result = await callApi("/auth/token/create", { code }, { method: "POST" });
      const save = result.json?.access_token ? await saveTokens(result.json) : { saved: false, reason: "no token in response" };
      return jsonRes({ ...result, saveResult: save });
    }

    if (action === "refresh") {
      const result = await refreshStoredToken();
      return jsonRes(result);
    }

    if (action === "tokenStatus") {
      const row = await getStoredToken();
      if (!row) return jsonRes({ hasToken: false });
      return jsonRes({
        hasToken: true,
        expires_at: row.expires_at,
        refresh_expires_at: row.refresh_expires_at,
        updated_at: row.updated_at,
        access_token_preview: (row.access_token ?? "").slice(0, 12) + "…",
        has_refresh_token: !!row.refresh_token,
      });
    }

    if (action === "productSearch") {
      const q = u.searchParams.get("q") ?? "hair clipper";
      const page = u.searchParams.get("page") ?? "1";
      const pageSize = u.searchParams.get("pageSize") ?? "10";
      const country = u.searchParams.get("country") ?? "ZA";
      const token = u.searchParams.get("token") ?? (await getValidAccessToken());
      // /eco/buyer/product/search requires a single structured param named `param0`
      // (JSON string, signed like any other param). Field names come from the ICBU
      // buyer-product SDK sample: keyword, page, pageSize, country (optional).
      const param0 = JSON.stringify({
        keyword: q,
        page: Number(page),
        pageSize: Number(pageSize),
        country,
      });
      const primary = await callApi("/eco/buyer/product/search", {
        access_token: token,
        param0,
      }, { method: "GET" });
      return jsonRes({ query: q, param0, primary });
    }

    if (action === "imageSearch") {
      const image = u.searchParams.get("image");
      if (!image) return jsonRes({ error: "Missing image query param (public image URL)" }, 400);
      const token = u.searchParams.get("token") ?? (await getValidAccessToken());
      // Highest-priority endpoint per Alibaba Buyer-Product docs:
      //   /icbu/product/image/search   (a.k.a. /eco/buyer/item/rec/image on some listings)
      const primary = await callApi("/icbu/product/image/search", {
        access_token: token,
        image_url: image,
        page_size: "10",
        page_no: "1",
      }, { method: "POST" });
      let fallback: any = null;
      if (primary.json?.code && primary.json?.code !== "0" && primary.json?.code !== 0) {
        fallback = await callApi("/eco/buyer/item/rec/image", {
          access_token: token,
          image_url: image,
          page_size: "10",
          page_no: "1",
        }, { method: "POST" });
      }
      return jsonRes({ image, primary, fallback });
    }

    return jsonRes({
      error: "Unknown action",
      allowed: ["authUrl", "exchange", "refresh", "tokenStatus", "productSearch", "imageSearch"],
    }, 400);
  } catch (e) {
    return jsonRes({ error: String((e as Error).message ?? e) }, 500);
  }
});
