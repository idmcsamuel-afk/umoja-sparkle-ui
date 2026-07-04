import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { computeMemberMoq, computeTierLanded } from "@/lib/sparkTradeMoq";

export interface CartOpportunity {
  id: number;
  product_name: string;
  category: string | null;
  product_image_url: string | null;
  moq_required: number;
  suggested_selling_price_zar: number;
  alibaba_cost_zar: number | null;
  freight_sea_zar: number | null;
  freight_air_zar: number | null;
  landed_cost_sea_zar: number | null;
  landed_cost_air_zar: number | null;
  air_available: boolean | null;
  stock_available: number | null;
  member_min_buyin_zar: number | null;
}

export interface CartItem {
  opportunity: CartOpportunity;
  qty: number;
  freightMode: "sea" | "air";
}

interface CartCtx {
  items: CartItem[];
  count: number;
  addItem: (o: CartOpportunity, qty: number, freightMode: "sea" | "air") => void;
  updateQty: (id: number, qty: number) => void;
  setFreightMode: (id: number, mode: "sea" | "air") => void;
  remove: (id: number) => void;
  clear: () => void;
  has: (id: number) => boolean;
}

const Ctx = createContext<CartCtx | null>(null);
const LS_KEY = "umoja_spark_trade_cart_v1";

export function SparkTradeCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const addItem = useCallback<CartCtx["addItem"]>((o, qty, freightMode) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.opportunity.id === o.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { opportunity: o, qty, freightMode };
        return copy;
      }
      return [...prev, { opportunity: o, qty, freightMode }];
    });
  }, []);

  const value = useMemo<CartCtx>(() => ({
    items,
    count: items.length,
    addItem,
    updateQty: (id, qty) =>
      setItems((p) => p.map((i) => (i.opportunity.id === id ? { ...i, qty: Math.max(1, Math.floor(qty)) } : i))),
    setFreightMode: (id, mode) =>
      setItems((p) => p.map((i) => (i.opportunity.id === id ? { ...i, freightMode: mode } : i))),
    remove: (id) => setItems((p) => p.filter((i) => i.opportunity.id !== id)),
    clear: () => setItems([]),
    has: (id) => items.some((i) => i.opportunity.id === id),
  }), [items, addItem]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSparkTradeCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSparkTradeCart must be inside <SparkTradeCartProvider>");
  return c;
}

/* Helpers for computing per-item pricing given a tier buffer. */
export function landedForCartItem(item: CartItem, bufferPct: number) {
  const freight =
    item.freightMode === "air"
      ? Number(item.opportunity.freight_air_zar ?? 0)
      : Number(item.opportunity.freight_sea_zar ?? 0);
  const fallback =
    item.freightMode === "air"
      ? Number(item.opportunity.landed_cost_air_zar ?? item.opportunity.landed_cost_sea_zar ?? 0)
      : Number(item.opportunity.landed_cost_sea_zar ?? 0);
  return computeTierLanded({
    alibabaCostZar: item.opportunity.alibaba_cost_zar,
    freightZar: freight,
    bufferPct,
    fallbackLandedZar: fallback,
  });
}

export function moqForCartItem(item: CartItem, bufferPct: number, globalMinItem: number) {
  const landed = landedForCartItem(item, bufferPct).landedCostZar;
  return computeMemberMoq({
    landedCostZar: landed,
    memberMinBuyinZar: item.opportunity.member_min_buyin_zar,
    factoryMoq: item.opportunity.moq_required,
    globalMinItem,
  });
}
