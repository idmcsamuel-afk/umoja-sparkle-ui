import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface CountryProfile {
  country_code: string;
  country_name: string;
  currency: string;
  marketplace: string[];
}

const COUNTRY_MAP: Record<string, CountryProfile> = {
  ZA: { country_code: "ZA", country_name: "South Africa", currency: "ZAR", marketplace: ["Takealot", "Makro", "Amazon.sa"] },
  NG: { country_code: "NG", country_name: "Nigeria", currency: "NGN", marketplace: ["Jumia"] },
  KE: { country_code: "KE", country_name: "Kenya", currency: "KES", marketplace: ["Jumia Kenya"] },
  ZW: { country_code: "ZW", country_name: "Zimbabwe", currency: "ZWL", marketplace: [] },
  ZM: { country_code: "ZM", country_name: "Zambia", currency: "ZMW", marketplace: [] },
  MZ: { country_code: "MZ", country_name: "Mozambique", currency: "MZN", marketplace: [] },
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function setCookieHeader(countryCode: string): Record<string, string> {
  return {
    "Set-Cookie": `country_code=${countryCode}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
  };
}

async function lookupCountryByIp(ip: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: controller.signal,
      headers: { "User-Agent": "umoja-edge/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = (await res.text()).trim().toUpperCase();
    if (text.length === 2 && /^[A-Z]{2}$/.test(text)) return text;
    return null;
  } catch (_e) {
    return null;
  }
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("client-ip") || req.headers.get("cf-connecting-ip") || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const manual = url.searchParams.get("country_code")?.toUpperCase();

    // Manual override path
    if (manual) {
      const profile = COUNTRY_MAP[manual];
      if (!profile) {
        return jsonResponse({ success: false, error: "Unsupported country", message: "Show country selector banner on landing page" }, 400);
      }
      return jsonResponse({ success: true, ...profile }, 200, setCookieHeader(profile.country_code));
    }

    // Cloudflare header first (cheap, no API call)
    const cfCountry = req.headers.get("cf-ipcountry")?.toUpperCase();
    let code: string | null = cfCountry && cfCountry !== "XX" && cfCountry !== "T1" ? cfCountry : null;

    // Fallback: external IP geolocation
    if (!code) {
      const ip = getClientIp(req);
      if (ip) code = await lookupCountryByIp(ip);
    }

    if (!code) {
      return jsonResponse({
        success: false,
        error: "Geolocation unavailable",
        message: "Show country selector banner on landing page",
      });
    }

    const profile = COUNTRY_MAP[code];
    if (!profile) {
      // Country detected but not supported — still return so frontend can show banner
      return jsonResponse({
        success: false,
        error: "Country not supported",
        detected_code: code,
        message: "Show country selector banner on landing page",
      });
    }

    return jsonResponse({ success: true, ...profile }, 200, setCookieHeader(profile.country_code));
  } catch (e) {
    return jsonResponse({
      success: false,
      error: "Geolocation unavailable",
      message: "Show country selector banner on landing page",
      detail: e instanceof Error ? e.message : String(e),
    }, 200);
  }
});
