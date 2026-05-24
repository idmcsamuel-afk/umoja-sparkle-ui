import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UsdtRate {
  zar_per_usd: number;
  usd_per_zar: number;
  source: string;
}

const FALLBACK: UsdtRate = { zar_per_usd: 18.5, usd_per_zar: 1 / 18.5, source: "fallback" };

export function useUsdtRate() {
  return useQuery<UsdtRate>({
    queryKey: ["usdt-rate"],
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("usdt-rate");
        if (error || !data) return FALLBACK;
        return data as UsdtRate;
      } catch {
        return FALLBACK;
      }
    },
  });
}

export function zarToUsdt(zar: number, rate?: UsdtRate | null): number {
  const r = rate?.zar_per_usd ?? FALLBACK.zar_per_usd;
  return Math.round((zar / r) * 100) / 100;
}

export function fmtUsdt(n: number) {
  return `$${n.toFixed(2)} USDT`;
}
