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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Package,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Boxes,
  ShoppingCart,
} from "lucide-react";

interface Opportunity {
  id: number;
  product_name: string;
  category: string | null;
  moq_required: number;
  unit_cost_zar: number;
  suggested_selling_price_zar: number;
  expected_margin_percentage: number;
  product_image_url: string | null;
  stock_available: number | null;
  trending_direction: string | null;
  supplier_country: string | null;
}

const CATEGORIES = ["All", "Electronics", "Fashion", "Home", "Food", "Services", "Tech"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

const fmtZar = (n: number) =>
  `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;

export default function SparkTradeProductOpportunities() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { pay, ready: paystackReady } = usePaystack();

  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [email, setEmail] = useState<string | null>(null);

  const [reserveOpen, setReserveOpen] = useState(false);
  const [active, setActive] = useState<Opportunity | null>(null);
  const [qty, setQty] = useState<number>(0);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: m } = await supabase
        .from("members")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();
      setEmail(((m as any)?.email as string) ?? user.email ?? null);
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("spark_trade_opportunities" as any)
        .select(
          "id, product_name, category, moq_required, unit_cost_zar, suggested_selling_price_zar, expected_margin_percentage, product_image_url, stock_available, trending_direction, supplier_country",
        )
        .order("created_at", { ascending: false });
      if (error) {
        console.error(error);
        toast.error("Could not load products");
      }
      setItems(((data as any[]) ?? []) as Opportunity[]);
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(
    () =>
      category === "All"
        ? items
        : items.filter((p) => (p.category ?? "").toLowerCase() === category.toLowerCase()),
    [items, category],
  );

  const openReserve = (p: Opportunity) => {
    setActive(p);
    setQty(p.moq_required ?? 1);
    setReserveOpen(true);
  };

  const totalCost = useMemo(() => {
    if (!active) return 0;
    return Number(active.suggested_selling_price_zar ?? 0) * (qty || 0);
  }, [active, qty]);

  const profitPerUnit = useMemo(() => {
    if (!active) return 0;
    return (
      Number(active.suggested_selling_price_zar ?? 0) -
      Number(active.unit_cost_zar ?? 0)
    );
  }, [active]);

  const totalProfit = useMemo(() => profitPerUnit * (qty || 0), [profitPerUnit, qty]);

  const onPay = async () => {
    if (!active || !user) return;
    const payerEmail = email || user.email;
    if (!payerEmail) {
      toast.error("Add an email to your account before paying");
      return;
    }
    if (!paystackReady) {
      toast.error("Payment gateway loading… try again in a moment");
      return;
    }
    if (qty < (active.moq_required ?? 1)) {
      toast.error(`Minimum order is ${active.moq_required} units`);
      return;
    }
    if (active.stock_available != null && qty > active.stock_available) {
      toast.error(`Only ${active.stock_available} units available`);
      return;
    }

    setPaying(true);
    const memberCode = (user.id || "U").replace(/-/g, "").slice(0, 10).toUpperCase();
    const reference = buildReference("ST", `OPP${active.id}`, memberCode);

    const result = await pay({
      email: payerEmail,
      amountZar: totalCost,
      currency: "ZAR",
      reference,
      metadata: {
        payment_type: "spark_trade_reservation",
        member_id: user.id,
        opportunity_id: active.id,
        product_name: active.product_name,
        category: active.category,
        units: qty,
        unit_price: active.suggested_selling_price_zar,
      },
    });
    setPaying(false);

    if (!result.ok) {
      if (result.error && result.error !== "cancelled") {
        toast.error("Payment did not complete", { description: result.error });
      }
      return;
    }

    toast.success(`Reserved ${qty} units of ${active.product_name}`);
    setReserveOpen(false);
    setActive(null);
  };

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
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          AI-curated inventory
        </div>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">Browse Products</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Vetted high-margin opportunities. Pick a category, choose a product, set your quantity — we handle the buy.
        </p>

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
              <OpportunityCard key={p.id} p={p} onReserve={() => openReserve(p)} />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-end">
          <Button size="lg" variant="outline" onClick={() => navigate("/spark-trade/dashboard")}>
            Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={reserveOpen} onOpenChange={(o) => !paying && setReserveOpen(o)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Reserve {active.product_name}
                </DialogTitle>
                <DialogDescription>
                  {active.category} · MOQ {active.moq_required} units · {active.expected_margin_percentage}% margin
                </DialogDescription>
              </DialogHeader>

              {active.product_image_url && (
                <div className="rounded-lg overflow-hidden bg-muted h-40">
                  <img
                    src={active.product_image_url}
                    alt={active.product_name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    How many units? (Minimum: {active.moq_required})
                  </label>
                  <Input
                    type="number"
                    min={active.moq_required ?? 1}
                    max={active.stock_available ?? undefined}
                    value={qty}
                    onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1.5"
                  />
                  {active.stock_available != null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {active.stock_available} units available
                    </p>
                  )}
                  {qty > 0 && qty < (active.moq_required ?? 1) && (
                    <p className="mt-1 text-xs text-destructive">
                      Below minimum order of {active.moq_required}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit price</span>
                    <span className="font-medium">{fmtZar(active.suggested_selling_price_zar)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-medium">{qty.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit / unit</span>
                    <span className="font-medium text-green-600">{fmtZar(profitPerUnit)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">Total cost</span>
                    <span className="font-bold text-lg">{fmtZar(totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span className="font-semibold">Est. total profit</span>
                    <span className="font-bold">{fmtZar(totalProfit)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" disabled={paying} onClick={() => setReserveOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={onPay}
                  disabled={
                    paying ||
                    qty < (active.moq_required ?? 1) ||
                    (active.stock_available != null && qty > active.stock_available)
                  }
                >
                  {paying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>Pay {fmtZar(totalCost)}</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OpportunityCard({ p, onReserve }: { p: Opportunity; onReserve: () => void }) {
  const [errored, setErrored] = useState(false);
  const outOfStock = (p.stock_available ?? 0) <= 0;

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
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-semibold line-clamp-2 min-h-[3rem]">{p.product_name}</h3>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold">{fmtZar(p.suggested_selling_price_zar)}</span>
          <span className="text-xs font-semibold text-green-600">
            +{p.expected_margin_percentage}% margin
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Boxes className="h-3 w-3" /> MOQ {p.moq_required}
          </span>
          <span className={outOfStock ? "text-destructive font-medium" : "text-green-600 font-medium"}>
            {outOfStock ? "Out of stock" : `${p.stock_available} in stock`}
          </span>
        </div>
        <Button size="sm" className="mt-2" disabled={outOfStock} onClick={onReserve}>
          {outOfStock ? "Sold out" : "Reserve Now"}
        </Button>
      </div>
    </Card>
  );
}
