import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePaystack, buildReference } from "@/hooks/usePaystack";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Loader2,
  Package,
  ArrowRight,
  TrendingUp,
  Sparkles,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Crown,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  computeMemberMoq,
  computeTierLanded,
  useSparkTradeFloors,
  useMemberTier,
  tierLabel,
  fmtZar,
} from "@/lib/sparkTradeMoq";
import {
  SparkTradeCartProvider,
  useSparkTradeCart,
  landedForCartItem,
  moqForCartItem,
  type CartOpportunity,
} from "@/lib/sparkTradeCart";

interface Opportunity extends CartOpportunity {
  expected_margin_percentage: number;
  trending_direction: string | null;
  supplier_country: string | null;
  is_spotlight?: boolean | null;
  spotlight_rank?: number | null;
  spotlight_title?: string | null;
  gross_margin_sea_zar?: number | null;
  gross_margin_air_zar?: number | null;
  margin_sea_pct?: number | null;
  margin_air_pct?: number | null;
  unit_cost_zar?: number | null;
}

interface CommitmentStatus {
  members_committed: number;
  total_units: number;
  moq_required: number;
  progress_percent: number;
  status: string | null;
}

const CATEGORIES = ["All", "Electronics", "Fashion", "Home", "Food", "Services", "Tech"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

export default function SparkTradeProductOpportunitiesWrapper() {
  return (
    <SparkTradeCartProvider>
      <SparkTradeProductOpportunities />
    </SparkTradeCartProvider>
  );
}

function SparkTradeProductOpportunities() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const floors = useSparkTradeFloors();
  const { tier, bufferPct } = useMemberTier();
  const { count } = useSparkTradeCart();
  const [cartOpen, setCartOpen] = useState(false);

  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [availableCapital, setAvailableCapital] = useState<number | null>(null);
  const [commitments, setCommitments] = useState<Record<number, CommitmentStatus>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  const supaBase = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const fetchCapital = async () => {
    if (!user) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(`${supaBase}/functions/v1/member-capital/${user.id}`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${sess.session?.access_token ?? anonKey}`,
        },
      });
      if (res.ok) {
        const j = await res.json();
        setAvailableCapital(Number(j.available_capital) || 0);
      }
    } catch (e) {
      console.warn("[capital] failed", e);
    }
  };

  const fetchCommitment = async (opportunityId: number): Promise<CommitmentStatus | null> => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(
        `${supaBase}/functions/v1/spark-trade-product-commitment-status/${opportunityId}`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${sess.session?.access_token ?? anonKey}`,
          },
        },
      );
      if (!res.ok) return null;
      const j = await res.json();
      return {
        members_committed: Number(j.members_committed) || 0,
        total_units: Number(j.total_units_committed) || 0,
        moq_required: Number(j.moq_required) || 0,
        progress_percent: Number(j.progress_percent) || 0,
        status: j.status ?? null,
      };
    } catch (e) {
      console.warn("[commitment] failed", e);
      return null;
    }
  };

  const refreshAll = async () => {
    await fetchCapital();
    if (items.length) {
      const entries = await Promise.all(items.map(async (r) => [r.id, await fetchCommitment(r.id)] as const));
      const map: Record<number, CommitmentStatus> = {};
      for (const [id, s] of entries) if (s) map[id] = s;
      setCommitments(map);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchCapital();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("spark_trade_opportunities" as any)
        .select(
          "id, product_name, category, moq_required, unit_cost_zar, suggested_selling_price_zar, expected_margin_percentage, product_image_url, stock_available, trending_direction, supplier_country, is_spotlight, spotlight_rank, spotlight_title, landed_cost_sea_zar, landed_cost_air_zar, gross_margin_sea_zar, margin_sea_pct, gross_margin_air_zar, margin_air_pct, air_available, member_min_buyin_zar, alibaba_cost_zar, freight_sea_zar, freight_air_zar",
        )
        .eq("is_spotlight", true)
        .order("spotlight_rank", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) {
        console.error(error);
        toast.error("Could not load products");
      }
      const rows = ((data as any[]) ?? []) as Opportunity[];
      setItems(rows);
      setLoading(false);

      if (rows.length) {
        const entries = await Promise.all(rows.map(async (r) => [r.id, await fetchCommitment(r.id)] as const));
        const map: Record<number, CommitmentStatus> = {};
        for (const [id, s] of entries) if (s) map[id] = s;
        setCommitments(map);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(
    () =>
      category === "All"
        ? items
        : items.filter((p) => (p.category ?? "").toLowerCase() === category.toLowerCase()),
    [items, category],
  );

  if (authLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI-curated inventory
            </div>
            <h1 className="mt-2 font-display text-3xl md:text-4xl">Browse Products</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Vetted high-margin opportunities. Add multiple products to your cart — one payment covers the whole order.
            </p>
          </div>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button size="lg" className="relative gap-2">
                <ShoppingCart className="h-4 w-4" /> Cart
                {count > 0 && (
                  <span className="ml-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary-foreground text-primary text-[11px] font-bold px-1.5">
                    {count}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <CartSheet
              onClose={() => setCartOpen(false)}
              availableCapital={availableCapital}
              onSuccess={refreshAll}
            />
          </Sheet>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs">
            <Crown className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Your tier:</span>
            <span className="font-semibold">{tierLabel(tier)}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold text-primary">{bufferPct}% buffer</span>
          </div>
          {availableCapital !== null && (
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Available capital:</span>
              <span className="font-semibold">{fmtZar(availableCapital)}</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={refreshAll} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Category buttons */}
        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={
                  "px-4 h-9 rounded-full text-sm font-medium transition-all border " +
                  (active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground")
                }
              >
                {c}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-16 grid place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <Card className="mt-10 p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              No products in {category} yet. Check back soon.
            </p>
          </Card>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((p) => (
              <OpportunityCard
                key={p.id}
                p={p}
                commitment={commitments[p.id]}
                bufferPct={bufferPct}
                minItemBuyin={floors.minItemBuyinZar}
                onOpenCart={() => setCartOpen(true)}
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-end">
          <Button size="lg" variant="outline" onClick={() => navigate("/spark-trade/dashboard")}>
            Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Opportunity card — shows tier-adjusted landed & profit, has
   qty stepper and "Add to cart" button.
   ============================================================ */
function OpportunityCard({
  p,
  commitment,
  bufferPct,
  minItemBuyin,
  onOpenCart,
}: {
  p: Opportunity;
  commitment?: CommitmentStatus;
  bufferPct: number;
  minItemBuyin: number;
  onOpenCart: () => void;
}) {
  const { addItem, has, items } = useSparkTradeCart();
  const [errored, setErrored] = useState(false);
  const [freightMode, setFreightMode] = useState<"sea" | "air">("sea");
  const airOn = !!p.air_available && Number(p.landed_cost_air_zar ?? 0) > 0;

  const tierLanded = useMemo(() => {
    const freight = freightMode === "air" ? p.freight_air_zar : p.freight_sea_zar;
    const fallback = freightMode === "air"
      ? (p.landed_cost_air_zar ?? p.landed_cost_sea_zar)
      : p.landed_cost_sea_zar;
    return computeTierLanded({
      alibabaCostZar: p.alibaba_cost_zar,
      freightZar: freight,
      bufferPct,
      fallbackLandedZar: fallback,
    });
  }, [p, freightMode, bufferPct]);

  const moq = useMemo(() =>
    computeMemberMoq({
      landedCostZar: tierLanded.landedCostZar,
      memberMinBuyinZar: p.member_min_buyin_zar,
      factoryMoq: p.moq_required,
      globalMinItem: minItemBuyin,
    }),
  [tierLanded.landedCostZar, p.member_min_buyin_zar, p.moq_required, minItemBuyin]);

  const [qty, setQty] = useState<number>(moq.memberMoqUnits);
  useEffect(() => { setQty(moq.memberMoqUnits); }, [moq.memberMoqUnits]);

  const sell = Number(p.suggested_selling_price_zar ?? 0);
  const profitPerUnit = Math.max(0, sell - tierLanded.landedCostZar);
  const lineTotal = tierLanded.landedCostZar * qty;
  const outOfStock = (p.stock_available ?? 0) <= 0;
  const alreadyInCart = has(p.id);

  const factoryMoq = commitment?.moq_required || p.moq_required || 1;
  const totalUnits = commitment?.total_units ?? 0;
  const members = commitment?.members_committed ?? 0;
  const pct = commitment?.progress_percent ?? 0;

  const handleAdd = () => {
    if (qty < moq.memberMoqUnits) {
      toast.error(`Minimum ${moq.memberMoqUnits} units for this product`);
      return;
    }
    if (p.stock_available != null && qty > p.stock_available) {
      toast.error(`Only ${p.stock_available} units available`);
      return;
    }
    addItem(
      {
        id: p.id,
        product_name: p.product_name,
        category: p.category,
        product_image_url: p.product_image_url,
        moq_required: p.moq_required,
        suggested_selling_price_zar: p.suggested_selling_price_zar,
        alibaba_cost_zar: p.alibaba_cost_zar,
        freight_sea_zar: p.freight_sea_zar,
        freight_air_zar: p.freight_air_zar,
        landed_cost_sea_zar: p.landed_cost_sea_zar,
        landed_cost_air_zar: p.landed_cost_air_zar,
        air_available: p.air_available,
        stock_available: p.stock_available,
        member_min_buyin_zar: p.member_min_buyin_zar,
      },
      qty,
      freightMode,
    );
    toast.success(`Added ${qty} × ${p.product_name} to cart`);
    onOpenCart();
  };

  return (
    <Card className="overflow-hidden flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5">
      <div className="relative h-[180px] w-full bg-muted">
        {p.product_image_url && !errored ? (
          <img
            src={p.product_image_url}
            alt={p.product_name}
            loading="lazy"
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/10 via-muted to-primary/5">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        {p.trending_direction === "up" && (
          <Badge className="absolute top-2 left-2 bg-green-600/90 text-white hover:bg-green-600">
            <TrendingUp className="h-3 w-3 mr-1" /> Trending
          </Badge>
        )}
        {p.category && (
          <Badge variant="secondary" className="absolute top-2 right-2">
            {p.category}
          </Badge>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-3">
        <h3 className="font-semibold line-clamp-2 min-h-[3rem]">{p.product_name}</h3>

        {airOn && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFreightMode("sea")}
              className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium ${freightMode === "sea" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              🚢 Sea · 4–6 wks
            </button>
            <button
              type="button"
              onClick={() => setFreightMode("air")}
              className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium ${freightMode === "air" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              ✈️ Air · 5–10 days
            </button>
          </div>
        )}

        <div className="rounded-md bg-muted/40 p-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your cost / unit</span>
            <span className="font-semibold">{fmtZar(tierLanded.landedCostZar)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sell at / unit</span>
            <span className="font-semibold">{fmtZar(sell)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Profit / unit</span>
            <span className="font-semibold text-green-600">{fmtZar(profitPerUnit)}</span>
          </div>
        </div>

        {/* Group progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Group progress</span>
            <span>{totalUnits.toLocaleString()}/{factoryMoq.toLocaleString()} units ({Math.round(pct)}%)</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${
                commitment?.status === "READY_TO_ORDER" ? "bg-green-500" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{members} members in</span>
            <span>Min {moq.memberMoqUnits}/person · ~{moq.membersNeeded || "—"} needed</span>
          </div>
        </div>

        {/* Qty stepper */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Your quantity</span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setQty((q) => Math.max(moq.memberMoqUnits, q - 1))}
              disabled={qty <= moq.memberMoqUnits}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              type="number"
              className="h-8 w-20 text-center"
              value={qty}
              min={moq.memberMoqUnits}
              onChange={(e) => setQty(Math.max(moq.memberMoqUnits, Number(e.target.value) || moq.memberMoqUnits))}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setQty((q) => q + 1)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Line total</span>
          <span className="font-bold text-base">{fmtZar(lineTotal)}</span>
        </div>

        <div className="text-[11px]">
          <span className={outOfStock ? "text-destructive font-medium" : "text-green-600 font-medium"}>
            {outOfStock ? "Out of stock" : `${p.stock_available} in stock`}
          </span>
        </div>
        <Button size="sm" disabled={outOfStock} onClick={handleAdd} variant={alreadyInCart ? "outline" : "default"}>
          {outOfStock ? "Sold out" : alreadyInCart ? "Update in cart" : (<><ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> Add to cart</>)}
        </Button>
      </div>
    </Card>
  );
}

/* ============================================================
   Cart sheet — items list, address, checkout
   ============================================================ */
function CartSheet({
  onClose,
  availableCapital,
  onSuccess,
}: {
  onClose: () => void;
  availableCapital: number | null;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const floors = useSparkTradeFloors();
  const { tier, bufferPct } = useMemberTier();
  const { items, updateQty, remove, setFreightMode, clear } = useSparkTradeCart();
  const { pay, ready: paystackReady } = usePaystack();

  const [email, setEmail] = useState<string | null>(null);
  const [addr, setAddr] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    province: "",
    postal_code: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState<{ total: number; itemCount: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: m } = await supabase
        .from("members")
        .select("email, address_line1, address_line2, city, province, postal_code")
        .eq("id", user.id)
        .maybeSingle();
      const mm = m as any;
      setEmail((mm?.email as string) ?? user.email ?? null);
      if (mm && (mm.address_line1 || mm.city || mm.postal_code)) {
        setAddr({
          address_line1: mm.address_line1 ?? "",
          address_line2: mm.address_line2 ?? "",
          city: mm.city ?? "",
          province: mm.province ?? "",
          postal_code: mm.postal_code ?? "",
        });
      }
    })();
  }, [user]);

  const lines = useMemo(() => {
    return items.map((it) => {
      const tl = landedForCartItem(it, bufferPct);
      const m = moqForCartItem(it, bufferPct, floors.minItemBuyinZar);
      const lineTotal = tl.landedCostZar * it.qty;
      const sell = Number(it.opportunity.suggested_selling_price_zar ?? 0);
      const profit = Math.max(0, sell - tl.landedCostZar) * it.qty;
      const belowFloor = it.qty < m.memberMoqUnits;
      return { it, tl, m, lineTotal, profit, belowFloor };
    });
  }, [items, bufferPct, floors.minItemBuyinZar]);

  const cartTotal = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);
  const cartProfit = useMemo(() => lines.reduce((s, l) => s + l.profit, 0), [lines]);
  const shortfall = Math.max(0, floors.minOrderTotalZar - cartTotal);
  const anyBelowFloor = lines.some((l) => l.belowFloor);
  const anyOverStock = items.some((it) => it.opportunity.stock_available != null && it.qty > (it.opportunity.stock_available ?? 0));

  const requiredAddr = ["address_line1", "city", "province", "postal_code"] as const;
  const addrErrors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const f of requiredAddr) {
      if (!String((addr as any)[f] ?? "").trim()) e[f] = "Required";
    }
    return e;
  }, [addr]);
  const addrValid = Object.keys(addrErrors).length === 0;

  const canCheckout =
    items.length > 0 &&
    cartTotal >= floors.minOrderTotalZar &&
    !anyBelowFloor &&
    !anyOverStock &&
    addrValid &&
    paystackReady &&
    !paying &&
    (availableCapital === null || cartTotal <= availableCapital);

  const onCheckout = async () => {
    if (!user) return;
    const payerEmail = email || user.email;
    if (!payerEmail) return toast.error("Add an email to your account before paying");
    if (!canCheckout) return;

    // Persist address (best-effort)
    try {
      await supabase.from("members").update({
        address_line1: addr.address_line1,
        address_line2: addr.address_line2 || null,
        city: addr.city,
        province: addr.province,
        postal_code: addr.postal_code,
      } as any).eq("id", user.id);
    } catch (e) { console.warn("[address save] failed", e); }

    setPaying(true);
    const memberCode = (user.id || "U").replace(/-/g, "").slice(0, 10).toUpperCase();
    const reference = buildReference("ST", "CART", memberCode);

    const metaItems = lines.map((l) => ({
      opportunity_id: l.it.opportunity.id,
      product_name: l.it.opportunity.product_name,
      units: l.it.qty,
      unit_price: Math.round(l.tl.landedCostZar * 100) / 100,
      line_total: Math.round(l.lineTotal * 100) / 100,
      freight_mode: l.it.freightMode,
    }));

    const result = await pay({
      email: payerEmail,
      amountZar: cartTotal,
      currency: "ZAR",
      reference,
      metadata: {
        payment_type: "spark_trade_cart_reservation",
        member_id: user.id,
        buyer_tier: tier ?? "buyers_club",
        buffer_pct: bufferPct,
        cart_total_zar: cartTotal,
        item_count: items.length,
        items: metaItems,
        delivery_address: { ...addr },
      },
    });
    setPaying(false);

    if (!result.ok) {
      if (result.error && result.error !== "cancelled") {
        toast.error("Payment did not complete", { description: result.error });
      }
      return;
    }

    toast.success(`✅ Order placed — ${fmtZar(cartTotal)}`);
    const summary = { total: cartTotal, itemCount: items.length };
    clear();
    onSuccess();
    setSuccess(summary);
  };

  return (
    <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
      <SheetHeader className="px-6 pt-6 pb-4 border-b">
        <SheetTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          Your Cart
        </SheetTitle>
        <SheetDescription>
          {tierLabel(tier)} · {bufferPct}% buffer — prices reflect your tier.
        </SheetDescription>
      </SheetHeader>

      {success ? (
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center text-center gap-3">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 grid place-items-center">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-display">Order Confirmed!</h2>
          <p className="text-sm text-muted-foreground">
            {success.itemCount} product{success.itemCount === 1 ? "" : "s"} · {fmtZar(success.total)}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Each product's units count toward its own factory MOQ. Track progress from your dashboard.
          </p>
          <div className="mt-4 flex flex-col gap-2 w-full">
            <Button onClick={() => { setSuccess(null); onClose(); }}>Continue Shopping</Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 grid place-items-center px-6 py-8 text-center">
          <div>
            <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Your cart is empty. Add products to build an order of at least {fmtZar(floors.minOrderTotalZar)}.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {lines.map((l) => {
              const o = l.it.opportunity;
              const airOn = !!o.air_available && Number(o.landed_cost_air_zar ?? 0) > 0;
              return (
                <div key={o.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex gap-3">
                    {o.product_image_url ? (
                      <img src={o.product_image_url} alt={o.product_name} className="h-14 w-14 rounded object-cover shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded bg-muted grid place-items-center shrink-0">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-2">{o.product_name}</p>
                        <button
                          onClick={() => remove(o.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {fmtZar(l.tl.landedCostZar)}/unit · min {l.m.memberMoqUnits}
                      </p>
                    </div>
                  </div>

                  {airOn && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setFreightMode(o.id, "sea")}
                        className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium ${l.it.freightMode === "sea" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                      >🚢 Sea</button>
                      <button
                        onClick={() => setFreightMode(o.id, "air")}
                        className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium ${l.it.freightMode === "air" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                      >✈️ Air</button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7"
                        onClick={() => updateQty(o.id, l.it.qty - 1)}
                        disabled={l.it.qty <= l.m.memberMoqUnits}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        value={l.it.qty}
                        min={l.m.memberMoqUnits}
                        onChange={(e) => updateQty(o.id, Math.max(l.m.memberMoqUnits, Number(e.target.value) || l.m.memberMoqUnits))}
                        className="h-7 w-16 text-center text-sm"
                      />
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(o.id, l.it.qty + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold">{fmtZar(l.lineTotal)}</span>
                  </div>

                  {l.belowFloor && (
                    <p className="text-[11px] text-destructive">
                      Below per-item minimum of {l.m.memberMoqUnits} units.
                    </p>
                  )}
                </div>
              );
            })}

            <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cart total</span>
                <span className="font-bold">{fmtZar(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Estimated profit</span>
                <span className="font-semibold">{fmtZar(cartProfit)}</span>
              </div>
            </div>

            {cartTotal < floors.minOrderTotalZar && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Add {fmtZar(shortfall)} more to reach the {fmtZar(floors.minOrderTotalZar)} minimum order.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add another product or increase any item's quantity.
                </p>
              </div>
            )}

            {availableCapital !== null && cartTotal > availableCapital && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive font-medium">
                Short {fmtZar(cartTotal - availableCapital)} in available capital.
              </div>
            )}

            {/* Address */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Delivery Address</h4>
              <Input
                placeholder="Address line 1 *"
                value={addr.address_line1}
                onChange={(e) => setAddr((a) => ({ ...a, address_line1: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, address_line1: true }))}
                className={touched.address_line1 && addrErrors.address_line1 ? "border-destructive" : ""}
              />
              <Input
                placeholder="Address line 2 (optional)"
                value={addr.address_line2}
                onChange={(e) => setAddr((a) => ({ ...a, address_line2: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="City *"
                  value={addr.city}
                  onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))}
                  onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                  className={touched.city && addrErrors.city ? "border-destructive" : ""}
                />
                <Input
                  placeholder="Postal code *"
                  value={addr.postal_code}
                  onChange={(e) => setAddr((a) => ({ ...a, postal_code: e.target.value }))}
                  onBlur={() => setTouched((t) => ({ ...t, postal_code: true }))}
                  className={touched.postal_code && addrErrors.postal_code ? "border-destructive" : ""}
                />
              </div>
              <select
                value={addr.province}
                onChange={(e) => setAddr((a) => ({ ...a, province: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, province: true }))}
                className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${touched.province && addrErrors.province ? "border-destructive" : "border-input"}`}
              >
                <option value="">Select a province *</option>
                {["Eastern Cape","Free State","Gauteng","KwaZulu-Natal","Limpopo","Mpumalanga","Northern Cape","North West","Western Cape"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <SheetFooter className="shrink-0 border-t bg-background px-6 py-4 flex-col sm:flex-col gap-2 sm:gap-2">
            <Button
              onClick={onCheckout}
              disabled={!canCheckout}
              className="w-full"
              size="lg"
            >
              {paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : <>Checkout · Pay {fmtZar(cartTotal)}</>}
            </Button>
            <Button variant="ghost" size="sm" onClick={clear} disabled={paying}>
              Clear cart
            </Button>
          </SheetFooter>
        </>
      )}
    </SheetContent>
  );
}
