import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(30),
  country_code: z.enum(["ZA", "NG", "KE", "ZW", "ZM", "MZ"]),
});

function tempPassword(len = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

type CountryProfile = {
  country: string;
  marketplace_preference: string[];
  currency_code: string;
  fulfillment_partner_available: boolean;
  is_international: boolean;
};

const COUNTRY_MAP: Record<string, CountryProfile> = {
  ZA: { country: "SA",        marketplace_preference: ["Takealot", "Makro", "Amazon.sa"], currency_code: "ZAR", fulfillment_partner_available: true,  is_international: false },
  NG: { country: "Nigeria",   marketplace_preference: ["Jumia"],                          currency_code: "NGN", fulfillment_partner_available: false, is_international: true  },
  KE: { country: "Kenya",     marketplace_preference: ["Jumia Kenya"],                    currency_code: "KES", fulfillment_partner_available: false, is_international: true  },
  ZW: { country: "Zimbabwe",  marketplace_preference: [],                                 currency_code: "ZWL", fulfillment_partner_available: false, is_international: true  },
  ZM: { country: "Zambia",    marketplace_preference: [],                                 currency_code: "ZMW", fulfillment_partner_available: false, is_international: true  },
  MZ: { country: "Mozambique",marketplace_preference: [],                                 currency_code: "MZN", fulfillment_partner_available: false, is_international: true  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { full_name, email, phone, country_code } = parsed.data;

    const profile = COUNTRY_MAP[country_code];
    if (!profile) {
      return new Response(JSON.stringify({ error: "Country not supported" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const password = tempPassword(14);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone, country_code },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Could not create account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uid = created.user.id;

    const { error: memErr } = await admin.from("members").upsert({
      id: uid,
      full_name,
      email,
      phone,
      country_code,
      country: profile.country,
      currency_code: profile.currency_code,
      marketplace_preference: profile.marketplace_preference,
      fulfillment_partner_available: profile.fulfillment_partner_available,
      is_international: profile.is_international,
      status: "active",
      force_password_change: true,
    }, { onConflict: "id" });

    if (memErr) {
      await admin.auth.admin.deleteUser(uid).catch(() => null);
      return new Response(JSON.stringify({ error: memErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: uid,
      email,
      temp_password: password,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[waitlist-signup] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
