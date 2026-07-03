import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_MIN_ITEM_BUYIN_ZAR = 400;
export const DEFAULT_MIN_ORDER_TOTAL_ZAR = 2500;

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
