import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CountryConfig {
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  enabled: boolean;
  seed_min: number;
  seed_max: number;
  growth_min: number;
  growth_max: number;
  harvest_min: number;
  harvest_max: number;
  payment_gateways: string[];
}

const FALLBACK: CountryConfig = {
  country_code: "ZA",
  country_name: "South Africa",
  currency_code: "ZAR",
  currency_symbol: "R",
  enabled: true,
  seed_min: 200, seed_max: 2000,
  growth_min: 2000, growth_max: 10000,
  harvest_min: 10000, harvest_max: 50000,
  payment_gateways: ["paystack", "eft", "usdt"],
};

let cache: Record<string, CountryConfig> = {};

export async function getCountryConfig(code: string): Promise<CountryConfig> {
  const k = (code || "ZA").toUpperCase();
  if (cache[k]) return cache[k];
  const { data } = await supabase
    .from("country_configs" as any)
    .select("*")
    .eq("country_code", k)
    .maybeSingle();
  if (data) {
    const cfg = data as any as CountryConfig;
    cache[k] = cfg;
    return cfg;
  }
  return FALLBACK;
}

export function useMyCountry() {
  const { user } = useAuth();
  const [config, setConfig] = useState<CountryConfig>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let code = "ZA";
      if (user) {
        const { data } = await supabase
          .from("members")
          .select("country_code")
          .eq("id", user.id)
          .maybeSingle();
        code = (data as any)?.country_code ?? "ZA";
      }
      const cfg = await getCountryConfig(code);
      if (!cancelled) { setConfig(cfg); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { config, loading };
}

export function fmtMoney(amount: number, cfg: CountryConfig) {
  return `${cfg.currency_symbol}${Math.round(amount).toLocaleString("en-US")}`;
}
