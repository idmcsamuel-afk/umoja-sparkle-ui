import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const DEFAULT_MIN_ITEM_BUYIN_ZAR = 400;
export const DEFAULT_MIN_ORDER_TOTAL_ZAR = 2500;
export const COMMISSION_PCT = 8; // never changes

export interface SparkTradeFloors {
  minItemBuyinZar: number;
  minOrderTotalZar: number;
  loaded: boolean;
}

// Module-level cache so every card doesn't refetch.
let cache: SparkTradeFloors | null = null;
let inflight: Promise<SparkTradeFloors> | null = null;

async function fetchFloors(): Promise<SparkTradeFloors> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("spark_trade_settings" as any)
      .select("key, value")
      .in("key", ["min_item_buyin_zar", "min_order_total_zar"]);
    const map = new Map<string, number>();
    ((data as any[]) ?? []).forEach((r) => map.set(r.key, Number(r.value)));
    const result: SparkTradeFloors = {
      minItemBuyinZar: map.get("min_item_buyin_zar") ?? DEFAULT_MIN_ITEM_BUYIN_ZAR,
      minOrderTotalZar: map.get("min_order_total_zar") ?? DEFAULT_MIN_ORDER_TOTAL_ZAR,
      loaded: true,
    };
    cache = result;
    inflight = null;
    return result;
  })();
  return inflight;
}

export function useSparkTradeFloors(): SparkTradeFloors {
  const [state, setState] = useState<SparkTradeFloors>(
    cache ?? {
      minItemBuyinZar: DEFAULT_MIN_ITEM_BUYIN_ZAR,
      minOrderTotalZar: DEFAULT_MIN_ORDER_TOTAL_ZAR,
      loaded: !!cache,
    },
  );
  useEffect(() => {
    if (cache) return;
    fetchFloors().then(setState).catch(() => {});
  }, []);
  return state;
}

/* ============================================================
   TIER-BASED BUFFER PRICING
   Higher tier → smaller buffer → lower landed cost → bigger profit.
   The 8% commission RATE is unchanged; it still applies to the
   tier-adjusted (alibaba+buffer)+freight base.
   ============================================================ */

export type BuffTier = "buyers_club" | "pro" | "fulfilled";

export function bufferPctForTier(tier?: string | null): number {
  const t = String(tier ?? "").toLowerCase();
  if (t === "pro") return 5;
  if (t === "fulfilled") return 0;
  // basic, buyers_club, gold, empty, null → standard 10%
  return 10;
}

export function tierLabel(tier?: string | null): string {
  const t = String(tier ?? "").toLowerCase();
  if (t === "pro") return "Pro Trader";
  if (t === "fulfilled") return "Fulfilled by UMOJA";
  return "Buyers Club";
}

let tierCache: Record<string, string | null> = {};
export function useMemberTier(): { tier: string | null; bufferPct: number; loaded: boolean } {
  const { user } = useAuth();
  const [tier, setTier] = useState<string | null>(user ? tierCache[user.id] ?? null : null);
  const [loaded, setLoaded] = useState<boolean>(!user || tierCache[user.id] !== undefined);

  useEffect(() => {
    if (!user) { setTier(null); setLoaded(true); return; }
    if (tierCache[user.id] !== undefined) { setTier(tierCache[user.id]); setLoaded(true); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("buyers_club_tier")
        .eq("id", user.id)
        .maybeSingle();
      const t = ((data as any)?.buyers_club_tier as string | null) ?? null;
      tierCache[user.id] = t;
      if (alive) { setTier(t); setLoaded(true); }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  return { tier, bufferPct: bufferPctForTier(tier), loaded };
}

export interface TierLandedInput {
  alibabaCostZar: number | null | undefined;
  freightZar: number | null | undefined;
  bufferPct: number;
  /** Fallback landed cost if alibaba/freight breakdown is missing (legacy rows). Assumed to already include the standard 10% buffer. */
  fallbackLandedZar?: number | null;
}

export interface TierLanded {
  adjustedCost: number;
  freight: number;
  commissionZar: number;
  landedCostZar: number;
  usedFallback: boolean;
}

export function computeTierLanded(input: TierLandedInput): TierLanded {
  const alibaba = Number(input.alibabaCostZar ?? 0);
  const freight = Number(input.freightZar ?? 0);
  const buffer = Number(input.bufferPct ?? 10);

  if (alibaba > 0) {
    const adjustedCost = alibaba * (1 + buffer / 100);
    const base = adjustedCost + freight;
    const commissionZar = base * (COMMISSION_PCT / 100);
    const landedCostZar = base + commissionZar;
    return { adjustedCost, freight, commissionZar, landedCostZar, usedFallback: false };
  }
  // Legacy fallback: can't recompute per-tier without alibaba breakdown.
  const fallback = Number(input.fallbackLandedZar ?? 0);
  return {
    adjustedCost: 0,
    freight,
    commissionZar: 0,
    landedCostZar: fallback,
    usedFallback: true,
  };
}

export interface ComputeMoqInput {
  landedCostZar: number | null | undefined;
  memberMinBuyinZar?: number | null;
  factoryMoq?: number | null;
  globalMinItem?: number;
}

export interface ComputedMoq {
  effectiveMinItem: number;
  memberMoqUnits: number;
  membersNeeded: number;
}

export function computeMemberMoq(input: ComputeMoqInput): ComputedMoq {
  const landed = Number(input.landedCostZar ?? 0);
  const globalFloor = Number(input.globalMinItem ?? DEFAULT_MIN_ITEM_BUYIN_ZAR);
  const override = input.memberMinBuyinZar == null || Number.isNaN(Number(input.memberMinBuyinZar))
    ? null
    : Number(input.memberMinBuyinZar);
  const effectiveMinItem = override && override > 0 ? override : globalFloor;
  const memberMoqUnits = landed > 0 ? Math.max(1, Math.ceil(effectiveMinItem / landed)) : 1;
  const factory = Number(input.factoryMoq ?? 0);
  const membersNeeded = factory > 0 ? Math.ceil(factory / memberMoqUnits) : 0;
  return { effectiveMinItem, memberMoqUnits, membersNeeded };
}

export const fmtZar = (n: number) =>
  `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;
