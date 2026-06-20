import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePaystack, buildReference } from "@/hooks/usePaystack";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Package, ArrowRight, Search, ExternalLink, Truck, CheckCircle2, Copy } from "lucide-react";

interface Product {
  product_name: string;
  price: number;
  currency?: string;
  image_url?: string;
  category?: string;
  seller_count?: number;
  stock_available?: boolean;
  product_url?: string;
  source: "takealot" | "amazon" | "makro";
  rating?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const sourceLabel: Record<Product["source"], string> = {
  takealot: "Takealot",
  amazon: "Amazon",
  makro: "Makro",
};

const fmtZar = (n: number) =>
  `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;

export default function SparkTradeProductOpportunities() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { pay, ready: paystackReady } = usePaystack();

  const [availableCapital, setAvailableCapital] = useState<number | null>(null);
  const [trending, setTrending] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const [paying, setPaying] = useState<string | null>(null); // unique key of product being paid
  const [tracking, setTracking] = useState<{
    product: Product;
    reference: string;
    waybill?: string | null;
    trackingUrl?: string | null;
    status?: string;
  } | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  // Fetch member capital + email
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/member-capital/${user.id}`,
          { headers: { Authorization: `Bearer ${SUPABASE_ANON}`, apikey: SUPABASE_ANON } },
        );
        if (!res.ok) throw new Error("capital fetch failed");
        const data = await res.json();
        setAvailableCapital(Number(data?.available_capital ?? 0));
      } catch {
        setAvailableCapital(0);
      }
      const { data: m } = await supabase.from("members").select("email").eq("id", user.id).maybeSingle();
      setEmail(((m as any)?.email as string) ?? user.email ?? null);
    })();
  }, [user]);

  // Fetch trending products (from scraped takealot_products)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from("takealot_products" as any)
          .select("takealot_name, takealot_price, takealot_url, image_url, category, seller_count, rating, scraped_at")
          .order("scraped_at", { ascending: false })
          .limit(60);
        if (qErr) throw qErr;
        const mapped: Product[] = ((data as any[]) ?? []).map((r) => ({
          product_name: r.takealot_name,
          price: Number(r.takealot_price ?? 0),
          currency: "ZAR",
          image_url: r.image_url ?? undefined,
          category: r.category ?? undefined,
          seller_count: r.seller_count ?? 0,
          stock_available: (r.seller_count ?? 0) > 0,
          product_url: r.takealot_url ?? undefined,
          rating: r.rating ?? undefined,
          source: "takealot",
        }));
        setTrending(mapped);
      } catch (e) {
        console.error(e);
        setError("Unable to load products. Try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Debounced marketplace search
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }
    (async () => {
      setSearching(true);
      try {
        const url = `${SUPABASE_URL}/functions/v1/marketplace-search?q=${encodeURIComponent(searchTerm)}&marketplaces=makro,amazon,takealot`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${SUPABASE_ANON}`, apikey: SUPABASE_ANON },
        });
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        const results: Product[] = ((data?.results as any[]) ?? []).map((r) => ({
          product_name: r.name,
          price: Number(r.price ?? 0),
          currency: r.currency ?? "ZAR",
          image_url: r.image_url ?? undefined,
          category: r.category ?? undefined,
          seller_count: r.seller_count ?? undefined,
          stock_available: r.stock !== undefined ? Number(r.stock) > 0 : true,
          product_url: r.url ?? undefined,
          rating: r.rating ?? undefined,
          source: (r.marketplace ?? "takealot") as Product["source"],
        }));
        setSearchResults(results);
      } catch (e) {
        console.error(e);
        toast.error("Search failed. Try again.");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    })();
  }, [searchTerm]);

  const productKey = (p: Product) => `${p.source}-${p.product_url ?? p.product_name}`;

  const onReserve = async (p: Product) => {
    if (!user) {
      navigate("/login");
      return;
    }
    const payerEmail = email || user.email;
    if (!payerEmail) {
      toast.error("Add an email to your account before paying");
      return;
    }
    if (p.currency && p.currency !== "ZAR") {
      toast.error("Only ZAR-priced products can be purchased right now");
      return;
    }
    if (!paystackReady) {
      toast.error("Payment gateway loading… try again in a moment");
      return;
    }
    if (!p.price || p.price < 1) {
      toast.error("Invalid product price");
      return;
    }

    const key = productKey(p);
    setPaying(key);

    const memberCode = (user.id || "U").replace(/-/g, "").slice(0, 10).toUpperCase();
    const productIdSafe = (p.product_url ?? p.product_name).replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "PROD";
    const reference = buildReference("ST", `MKT${productIdSafe}`, memberCode);

    const result = await pay({
      email: payerEmail,
      amountZar: p.price,
      currency: "ZAR",
      reference,
      metadata: {
        payment_type: "marketplace_purchase",
        member_id: user.id,
        product_name: p.product_name,
        category: p.category ?? null,
        seller: sourceLabel[p.source],
        product_url: p.product_url ?? null,
      },
    });

    setPaying(null);

    if (!result.ok) {
      if (result.error && result.error !== "cancelled") {
        toast.error("Payment did not complete", { description: result.error });
      }
      return;
    }

    // Poll fulfillment_shipments for the waybill (created server-side by verify-paystack-payment)
    let shipment: any = null;
    for (let i = 0; i < 6; i++) {
      const { data } = await supabase
        .from("fulfillment_shipments" as any)
        .select("waybill_number, tracking_url, status")
        .eq("payment_reference", reference)
        .maybeSingle();
      if (data) {
        shipment = data;
        if ((data as any).waybill_number) break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    setTracking({
      product: p,
      reference,
      waybill: shipment?.waybill_number ?? null,
      trackingUrl: shipment?.tracking_url ?? null,
      status: shipment?.status ?? "pending",
    });

    // refresh capital
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/member-capital/${user.id}`,
        { headers: { Authorization: `Bearer ${SUPABASE_ANON}`, apikey: SUPABASE_ANON } },
      );
      if (res.ok) {
        const d = await res.json();
        setAvailableCapital(Number(d?.available_capital ?? 0));
      }
    } catch {}
  };

  const grid = useMemo(() => (searchTerm ? searchResults : trending), [searchTerm, searchResults, trending]);

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
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Step 7 of 10</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl md:text-4xl">Product Opportunities</h1>
            <p className="mt-2 text-muted-foreground">Live products from Takealot, Amazon & Makro.</p>
          </div>
          <Badge variant="secondary" className="text-sm py-2 px-3">
            Available Capital:{" "}
            <span className="ml-1 font-semibold">
              {availableCapital === null ? "…" : fmtZar(availableCapital)}
            </span>
          </Badge>
        </div>

        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Makro, Amazon, Takealot…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {searchTerm && (
          <p className="mt-3 text-sm text-muted-foreground">
            Search results for "{searchTerm}" — {searchResults.length} found
          </p>
        )}

        {error && (
          <Card className="mt-10 p-10 text-center">
            <p className="text-destructive">{error}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
          </Card>
        )}

        {loading && !error ? (
          <div className="mt-10 grid place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : grid.length === 0 && !error ? (
          <Card className="mt-10 p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              {searchTerm ? "No products match your search." : "No products available yet. Check back soon."}
            </p>
          </Card>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {grid.map((p, i) => (
              <ProductCard
                key={`${p.source}-${i}-${p.product_name}`}
                p={p}
                onReserve={onReserve}
                isPaying={paying === productKey(p)}
                anyPaying={!!paying}
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

      <TrackingDialog tracking={tracking} onClose={() => setTracking(null)} />
    </div>
  );
}

function TrackingDialog({
  tracking,
  onClose,
}: {
  tracking: {
    product: Product;
    reference: string;
    waybill?: string | null;
    trackingUrl?: string | null;
    status?: string;
  } | null;
  onClose: () => void;
}) {
  if (!tracking) return null;
  const hasWaybill = !!tracking.waybill;
  const copy = (txt: string) => {
    navigator.clipboard?.writeText(txt).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed"),
    );
  };
  return (
    <Dialog open={!!tracking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Payment successful — order placed
          </DialogTitle>
          <DialogDescription>
            {tracking.product.product_name} • {fmtZar(tracking.product.price)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-muted p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Payment reference</span>
              <button onClick={() => copy(tracking.reference)} className="font-mono text-xs flex items-center gap-1 hover:underline">
                {tracking.reference} <Copy className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1"><Truck className="h-4 w-4" />Waybill</span>
              {hasWaybill ? (
                <button onClick={() => copy(tracking.waybill!)} className="font-mono text-xs flex items-center gap-1 hover:underline">
                  {tracking.waybill} <Copy className="h-3 w-3" />
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Generating… you'll get an SMS</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated delivery</span>
              <span>2–4 business days (TheCourierGuy)</span>
            </div>
          </div>

          {!hasWaybill && (
            <p className="text-xs text-muted-foreground">
              Payment succeeded. Your shipment is being created — we'll SMS the tracking link as soon as it's ready.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {tracking.trackingUrl && (
            <Button variant="outline" asChild>
              <a href={tracking.trackingUrl} target="_blank" rel="noreferrer">
                Track shipment <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductCard({ p, onReserve, isPaying, anyPaying }: { p: Product; onReserve: (p: Product) => void; isPaying: boolean; anyPaying: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const inStock = p.stock_available !== false;
  return (
    <Card className="overflow-hidden flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5">
      <div className="relative h-[200px] w-full bg-muted">
        {!p.image_url || errored ? (
          <div className="grid h-full w-full place-items-center">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
        ) : (
          <>
            {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
            <img
              src={p.image_url}
              alt={p.product_name}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
              className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        )}
        <Badge className="absolute top-2 left-2 capitalize" variant="secondary">
          {sourceLabel[p.source]}
        </Badge>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-semibold line-clamp-2 min-h-[3rem]">{p.product_name}</h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">
            {p.currency && p.currency !== "ZAR" ? `${p.currency} ${p.price.toLocaleString()}` : fmtZar(p.price)}
          </span>
          {p.category && <span className="text-xs text-muted-foreground line-clamp-1 max-w-[60%] text-right">{p.category}</span>}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Sellers: {p.seller_count ?? "—"}</span>
          <span className={inStock ? "text-green-600 font-medium" : "text-destructive font-medium"}>
            {inStock ? "In stock" : "Out of stock"}
          </span>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={!inStock || anyPaying}
            onClick={() => onReserve(p)}
          >
            {isPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isPaying ? "Processing…" : "Reserve & Pay"}
          </Button>
          {p.product_url && (
            <Button size="sm" variant="outline" asChild>
              <a href={p.product_url} target="_blank" rel="noreferrer" aria-label="View on retailer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
