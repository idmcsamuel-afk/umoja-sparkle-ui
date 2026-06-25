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
  CheckCircle2,
  Truck,
  Calendar,
  Share2,
  RefreshCw,
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
  is_spotlight?: boolean | null;
  spotlight_rank?: number | null;
  spotlight_title?: string | null;
}

interface CommitmentStatus {
  members_committed: number;
  total_units: number;
  moq_required: number;
  progress_percent: number;
  status: string | null;
}

const SPOTLIGHT_MEMBER_TARGET = 10;
const maxUnitsPerPerson = (moq: number) =>
  Math.max(1, Math.ceil((moq || SPOTLIGHT_MEMBER_TARGET) / SPOTLIGHT_MEMBER_TARGET));

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
  const [availableCapital, setAvailableCapital] = useState<number | null>(null);
  const [commitments, setCommitments] = useState<Record<number, CommitmentStatus>>({});

  const [reserveOpen, setReserveOpen] = useState(false);
  const [active, setActive] = useState<Opportunity | null>(null);
  const [qty, setQty] = useState<number>(0);
  const [paying, setPaying] = useState(false);

  // Address state
  const [addr, setAddr] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    province: "",
    postal_code: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [savedAddr, setSavedAddr] = useState<typeof addr | null>(null);
  const [useSaved, setUseSaved] = useState(true);

  // Order confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    productName: string;
    qty: number;
    waybillNumber: string | null;
    trackingUrl: string | null;
    orderDate: Date;
    expectedDelivery: { from: Date; to: Date };
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

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
        const s = {
          address_line1: mm.address_line1 ?? "",
          address_line2: mm.address_line2 ?? "",
          city: mm.city ?? "",
          province: mm.province ?? "",
          postal_code: mm.postal_code ?? "",
        };
        setSavedAddr(s);
        setAddr(s);
      }
    })();
  }, [user]);


  // Fetch member capital
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const base = import.meta.env.VITE_SUPABASE_URL;
        const { data: sess } = await supabase.auth.getSession();
        const res = await fetch(`${base}/functions/v1/member-capital/${user.id}`, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            Authorization: `Bearer ${sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        });
        if (res.ok) {
          const j = await res.json();
          setAvailableCapital(Number(j.available_capital) || 0);
        }
      } catch (e) {
        console.warn("[capital] failed", e);
      }
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("spark_trade_opportunities" as any)
        .select(
          "id, product_name, category, moq_required, unit_cost_zar, suggested_selling_price_zar, expected_margin_percentage, product_image_url, stock_available, trending_direction, supplier_country, is_spotlight, spotlight_rank, spotlight_title",
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

      // Fetch commitment status for each
      if (rows.length) {
        const entries = await Promise.all(
          rows.map(async (r) => {
            const { data: s } = await supabase
              .from("v_product_commitment_status" as any)
              .select("members_committed, total_units, moq_required, progress_percent, status")
              .eq("opportunity_id", r.id)
              .maybeSingle();
            return [r.id, (s as any) ?? null] as const;
          }),
        );
        const map: Record<number, CommitmentStatus> = {};
        for (const [id, s] of entries) {
          if (s) map[id] = {
            members_committed: Number(s.members_committed) || 0,
            total_units: Number(s.total_units) || 0,
            moq_required: Number(s.moq_required) || 0,
            progress_percent: Number(s.progress_percent) || 0,
            status: s.status ?? null,
          };
        }
        setCommitments(map);
      }
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

  const requiredAddrFields = ["address_line1", "city", "province", "postal_code"] as const;
  const addrErrors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const f of requiredAddrFields) {
      if (!String((addr as any)[f] ?? "").trim()) e[f] = "Required";
    }
    return e;
  }, [addr]);
  const addrValid = Object.keys(addrErrors).length === 0;


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

    if (!addrValid) {
      setTouched({ address_line1: true, city: true, province: true, postal_code: true });
      toast.error("Please complete the delivery address");
      return;
    }

    // Persist address to members table (best-effort)
    try {
      await supabase
        .from("members")
        .update({
          address_line1: addr.address_line1,
          address_line2: addr.address_line2 || null,
          city: addr.city,
          province: addr.province,
          postal_code: addr.postal_code,
        } as any)
        .eq("id", user.id);
    } catch (e) {
      console.warn("[address save] failed", e);
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

    toast.success(`Reserved ${qty} units of ${active.product_name}`);

    // Fetch shipment + reservation rows to populate confirmation
    const productName = active.product_name;
    const orderedQty = qty;
    let waybillNumber: string | null = null;
    let trackingUrl: string | null = null;
    let orderDate: Date = new Date();
    try {
      // Poll up to ~6s for the webhook to create rows
      for (let i = 0; i < 6; i++) {
        const { data: resv } = await supabase
          .from("spark_trade_inventory_reservations" as any)
          .select("id, paid_at, created_at")
          .eq("paystack_reference", reference)
          .maybeSingle();
        const r = resv as any;
        if (r?.id) {
          orderDate = new Date(r.paid_at ?? r.created_at ?? Date.now());
          const { data: ship } = await supabase
            .from("fulfillment_shipments" as any)
            .select("waybill_number, tracking_url")
            .eq("reservation_id", r.id)
            .maybeSingle();
          const s = ship as any;
          if (s) {
            waybillNumber = s.waybill_number ?? null;
            trackingUrl = s.tracking_url ?? null;
          }
          break;
        }
        await new Promise((res) => setTimeout(res, 1000));
      }
    } catch (e) {
      console.warn("[confirmation fetch] failed", e);
    }

    const addBusinessDays = (d: Date, days: number) => {
      const out = new Date(d);
      let added = 0;
      while (added < days) {
        out.setDate(out.getDate() + 1);
        const day = out.getDay();
        if (day !== 0 && day !== 6) added++;
      }
      return out;
    };

    setConfirmation({
      productName,
      qty: orderedQty,
      waybillNumber,
      trackingUrl,
      orderDate,
      expectedDelivery: {
        from: addBusinessDays(orderDate, 3),
        to: addBusinessDays(orderDate, 5),
      },
    });
    setReserveOpen(false);
    setActive(null);
    setConfirmOpen(true);
  };

  const closeConfirmation = () => {
    setConfirmOpen(false);
    setConfirmation(null);
  };

  const shareOnWhatsApp = () => {
    if (!confirmation) return;
    const lines = [
      `🎉 Order Confirmed on Umoja Spark Trade!`,
      `Product: ${confirmation.productName}`,
      `Quantity: ${confirmation.qty}`,
      confirmation.waybillNumber ? `Waybill: ${confirmation.waybillNumber}` : null,
      confirmation.trackingUrl ? `Track: ${confirmation.trackingUrl}` : null,
    ].filter(Boolean) as string[];
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
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
        {availableCapital !== null && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Available capital:</span>
            <span className="font-semibold">{fmtZar(availableCapital)}</span>
          </div>
        )}

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
                onReserve={() => openReserve(p)}
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

      <Dialog open={reserveOpen} onOpenChange={(o) => !paying && setReserveOpen(o)}>
        <DialogContent className="max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
          {active && (
            <>
              <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Reserve {active.product_name}
                </DialogTitle>
                <DialogDescription>
                  {active.category} · MOQ {active.moq_required} units · {active.expected_margin_percentage}% margin
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">


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

                {/* Capital validation */}
                {availableCapital !== null && (() => {
                  const hasEnough = totalCost <= availableCapital;
                  return (
                    <div
                      className={`rounded-lg border p-3 text-sm ${
                        hasEnough
                          ? "border-green-600/30 bg-green-600/5"
                          : "border-destructive/40 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">You have</span>
                        <span className="font-semibold">{fmtZar(availableCapital)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-muted-foreground">This costs</span>
                        <span className="font-semibold">{fmtZar(totalCost)}</span>
                      </div>
                      <div className={`mt-2 font-medium ${hasEnough ? "text-green-600" : "text-destructive"}`}>
                        {hasEnough
                          ? `✅ OK — ${fmtZar(availableCapital - totalCost)} remaining after`
                          : `❌ Short ${fmtZar(totalCost - availableCapital)}. Top up to continue.`}
                      </div>
                    </div>
                  );
                })()}

                {/* Group buy progress preview */}
                {commitments[active.id] && (() => {
                  const c = commitments[active.id];
                  const moq = c.moq_required || active.moq_required || 1;
                  const afterUnits = c.total_units + (qty || 0);
                  const afterPct = Math.min(100, Math.round((afterUnits / moq) * 100));
                  return (
                    <div className="rounded-lg border p-3 text-sm space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Group progress</span>
                        <span>Max {maxUnitsPerPerson(moq)} units / person</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>After your order</span>
                        <span className="font-semibold">
                          {afterUnits}/{moq} units · {afterPct}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${afterPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Delivery Address */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Delivery Address</h4>
                    {savedAddr && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useSaved}
                          onChange={(e) => {
                            setUseSaved(e.target.checked);
                            if (e.target.checked && savedAddr) setAddr(savedAddr);
                          }}
                        />
                        Use saved address
                      </label>
                    )}
                  </div>

                  {(["address_line1", "address_line2"] as const).map((f) => {
                    const required = f === "address_line1";
                    const label = f === "address_line1" ? "Address Line 1" : "Address Line 2";
                    const err = touched[f] && addrErrors[f];
                    return (
                      <div key={f}>
                        <label className="text-xs font-medium">
                          {label}{required && <span className="text-destructive"> *</span>}
                        </label>
                        <Input
                          value={(addr as any)[f]}
                          onChange={(e) => setAddr((a) => ({ ...a, [f]: e.target.value }))}
                          onBlur={() => setTouched((t) => ({ ...t, [f]: true }))}
                          className={`mt-1 ${err ? "border-destructive" : ""}`}
                          placeholder={f === "address_line2" ? "Apt, suite, etc. (optional)" : ""}
                        />
                        {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
                      </div>
                    );
                  })}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">
                        City<span className="text-destructive"> *</span>
                      </label>
                      <Input
                        value={addr.city}
                        onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))}
                        onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                        className={`mt-1 ${touched.city && addrErrors.city ? "border-destructive" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">
                        Postal Code<span className="text-destructive"> *</span>
                      </label>
                      <Input
                        value={addr.postal_code}
                        onChange={(e) => setAddr((a) => ({ ...a, postal_code: e.target.value }))}
                        onBlur={() => setTouched((t) => ({ ...t, postal_code: true }))}
                        className={`mt-1 ${touched.postal_code && addrErrors.postal_code ? "border-destructive" : ""}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium">
                      Province<span className="text-destructive"> *</span>
                    </label>
                    <select
                      value={addr.province}
                      onChange={(e) => setAddr((a) => ({ ...a, province: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, province: true }))}
                      className={`mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${touched.province && addrErrors.province ? "border-destructive" : "border-input"}`}
                    >
                      <option value="">Select a province</option>
                      {[
                        "Eastern Cape",
                        "Free State",
                        "Gauteng",
                        "KwaZulu-Natal",
                        "Limpopo",
                        "Mpumalanga",
                        "Northern Cape",
                        "North West",
                        "Western Cape",
                      ].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              </div>

              <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 gap-2 sm:gap-2">
                <Button variant="outline" disabled={paying} onClick={() => setReserveOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={onPay}
                  disabled={
                    paying ||
                    !addrValid ||
                    qty < (active.moq_required ?? 1) ||
                    (active.stock_available != null && qty > active.stock_available) ||
                    (availableCapital !== null && totalCost > availableCapital)
                  }
                >
                  {paying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>Complete &amp; Pay {fmtZar(totalCost)}</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(o) => !o && closeConfirmation()}>
        <DialogContent className="max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
          {confirmation && (
            <>
              <div className="flex-1 overflow-y-auto px-6 pt-8 pb-4">
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 grid place-items-center">
                    <CheckCircle2 className="h-9 w-9 text-green-600" />
                  </div>
                  <h2 className="mt-4 text-2xl font-display">Order Confirmed!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {confirmation.qty} × {confirmation.productName}
                  </p>
                </div>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Truck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Waybill</div>
                        <div className="font-mono font-medium break-all">
                          {confirmation.waybillNumber ?? "Generating…"}
                        </div>
                        {confirmation.trackingUrl && (
                          <a
                            href={confirmation.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-primary text-xs underline underline-offset-2 break-all"
                          >
                            Track shipment →
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 border-t pt-3">
                      <Calendar className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Order date</div>
                        <div className="font-medium">
                          {confirmation.orderDate.toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 border-t pt-3">
                      <Package className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Expected delivery</div>
                        <div className="font-medium">
                          {confirmation.expectedDelivery.from.toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          –{" "}
                          {confirmation.expectedDelivery.to.toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          3–5 business days
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 gap-2 sm:gap-2">
                <Button variant="outline" onClick={shareOnWhatsApp}>
                  <Share2 className="mr-2 h-4 w-4" /> Share on WhatsApp
                </Button>
                <Button onClick={closeConfirmation}>Continue Shopping</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

function OpportunityCard({
  p,
  commitment,
  onReserve,
}: {
  p: Opportunity;
  commitment?: CommitmentStatus;
  onReserve: () => void;
}) {
  const [errored, setErrored] = useState(false);
  const outOfStock = (p.stock_available ?? 0) <= 0;
  const moq = commitment?.moq_required || p.moq_required || 1;
  const totalUnits = commitment?.total_units ?? 0;
  const members = commitment?.members_committed ?? 0;
  const pct = commitment?.progress_percent ?? 0;
  const maxPerPerson = maxUnitsPerPerson(moq);

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

        {/* Commitment block */}
        <div className="mt-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Members committed</span>
            <span className="font-medium text-foreground">
              {members}/{SPOTLIGHT_MEMBER_TARGET}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Units</span>
            <span className="font-medium text-foreground">
              {totalUnits}/{moq}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Boxes className="h-3 w-3" /> MOQ {p.moq_required}
            </span>
            <span>Max {maxPerPerson} / person</span>
          </div>
        </div>

        <div className="text-xs">
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
