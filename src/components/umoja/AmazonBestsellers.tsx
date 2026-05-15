import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Star, Calculator, Flame, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface AmazonProduct {
  id: string;
  asin: string;
  title: string;
  image_url: string | null;
  price_usd: number | null;
  price_zar: number | null;
  rating: number | null;
  review_count: number | null;
  sales_rank: number | null;
  category: string | null;
  last_updated?: string;
}

const fmtZAR = (n: number) =>
  "R" + Math.round(n).toLocaleString("en-ZA");
const fmtUSD = (n: number) => "$" + n.toFixed(2);

export const AmazonBestsellers = () => {
  const [products, setProducts] = useState<AmazonProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<AmazonProduct | null>(null);
  const [category, setCategory] = useState<string>("All");

  const load = async () => {
    setLoading(true);
    // Trigger edge function (uses cache if fresh)
    await supabase.functions.invoke("fetch-amazon-products").catch(() => null);
    const { data } = await supabase
      .from("amazon_products")
      .select("*")
      .order("sales_rank", { ascending: true })
      .limit(60);
    setProducts((data ?? []) as AmazonProduct[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const visible = useMemo(
    () => (category === "All" ? products : products.filter((p) => p.category === category)),
    [products, category],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Live Bestsellers</p>
          <h3 className="font-display text-xl mt-1">Amazon top picks</h3>
        </div>
        <button
          onClick={load}
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Refresh products"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wider border transition-colors ${
              category === c
                ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center rounded-3xl glass p-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl glass p-6 text-center text-sm text-muted-foreground">
          No products yet — admin can sync from the dashboard.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((p) => (
            <ProductCard key={p.id} p={p} onCalc={() => setActive(p)} />
          ))}
        </div>
      )}

      <MarginCalculatorModal product={active} onClose={() => setActive(null)} />
    </div>
  );
};

const ProductCard = ({ p, onCalc }: { p: AmazonProduct; onCalc: () => void }) => {
  const usd = Number(p.price_usd ?? 0);
  const zar = Number(p.price_zar ?? 0);
  const rank = Number(p.sales_rank ?? 0);
  const isTopK = rank > 0 && rank < 1000;

  return (
    <article className="group rounded-3xl glass overflow-hidden flex flex-col animate-slide-up">
      <div className="relative aspect-square bg-secondary/40">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.title}
            loading="lazy"
            className="absolute inset-0 size-full object-contain p-4"
          />
        ) : (
          <div className="grid place-items-center size-full text-muted-foreground text-xs">
            No image
          </div>
        )}
        {isTopK && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-orange-500/20 text-orange-300 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
            <Flame className="h-3 w-3" /> Top 1K
          </div>
        )}
        {p.category && (
          <div className="absolute right-3 top-3 rounded-full bg-background/70 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {p.category}
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <p
          className="font-display text-sm leading-tight overflow-hidden"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          title={p.title}
        >
          {p.title}
        </p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amazon price</p>
            <p className="font-display text-base text-gradient-gold">{fmtUSD(usd)}</p>
            <p className="text-xs text-muted-foreground">≈ {fmtZAR(zar)}</p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1 text-xs text-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {Number(p.rating ?? 0).toFixed(1)}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {Number(p.review_count ?? 0).toLocaleString()} reviews
            </p>
            {rank > 0 && (
              <p className="text-[10px] text-muted-foreground">BSR #{rank.toLocaleString()}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-auto">
          <Button onClick={onCalc} className="flex-1 h-10 rounded-2xl bg-gradient-primary text-primary-foreground">
            <Calculator className="h-4 w-4 mr-1.5" /> Calculate margin
          </Button>
          <a
            href={`https://www.amazon.com/dp/${p.asin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="grid h-10 w-10 place-items-center rounded-2xl border border-border text-muted-foreground hover:text-foreground"
            aria-label="View on Amazon"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
};

const MarginCalculatorModal = ({ product, onClose }: { product: AmazonProduct | null; onClose: () => void }) => {
  const [sellingPrice, setSellingPrice] = useState<number>(0);

  useEffect(() => {
    if (product) {
      const zar = Number(product.price_zar ?? 0);
      // Pre-fill with a 35% markup over a rough landed cost
      const rough = zar * 1.15 * 1.25 * 1.15;
      setSellingPrice(Math.round(rough * 1.35));
    }
  }, [product]);

  if (!product) return null;

  const fob = Number(product.price_zar ?? 0);
  const shipping = fob * 0.15;
  const cif = fob + shipping;
  const duty = cif * 0.25;
  const vat = (cif + duty) * 0.15;
  const landed = cif + duty + vat;
  const profit = sellingPrice - landed;
  const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Margin calculator</DialogTitle>
          <DialogDescription className="line-clamp-2">{product.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Amazon (USD)" value={fmtUSD(Number(product.price_usd ?? 0))} />
            <Stat label="Amazon (ZAR)" value={fmtZAR(fob)} />
          </div>

          <div className="rounded-2xl border border-border bg-secondary/30 divide-y divide-border">
            <Row label="FOB / Product cost" value={fmtZAR(fob)} />
            <Row label="Shipping (15%)" value={fmtZAR(shipping)} />
            <Row label="CIF (FOB + shipping)" value={fmtZAR(cif)} />
            <Row label="Customs duty (25% of CIF)" value={fmtZAR(duty)} />
            <Row label="VAT (15% on CIF + duty)" value={fmtZAR(vat)} />
            <Row label="Total landed cost" value={fmtZAR(landed)} bold />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sellingPrice">Your selling price (ZAR)</Label>
            <Input
              id="sellingPrice"
              type="number"
              min={0}
              value={sellingPrice}
              onChange={(e) => setSellingPrice(Math.max(0, Number(e.target.value)))}
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div
              className={`rounded-2xl p-4 ${profit >= 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}
            >
              <p className="text-[10px] uppercase tracking-wider opacity-80">Profit</p>
              <p className="font-display text-xl mt-1">{fmtZAR(profit)}</p>
            </div>
            <div
              className={`rounded-2xl p-4 ${margin >= 30 ? "bg-emerald-500/10 text-emerald-300" : margin >= 15 ? "bg-amber-500/10 text-amber-300" : "bg-red-500/10 text-red-300"}`}
            >
              <p className="text-[10px] uppercase tracking-wider opacity-80">Margin</p>
              <p className="font-display text-xl mt-1">{margin.toFixed(1)}%</p>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Estimates only. Actual landed cost varies with shipping mode, HS code, and supplier terms. Always confirm
            with your freight forwarder before committing capital.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-secondary/40 p-3">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="font-display text-sm mt-1">{value}</p>
  </div>
);

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className="flex items-center justify-between px-4 py-2.5 text-sm">
    <span className={bold ? "font-medium" : "text-muted-foreground"}>{label}</span>
    <span className={bold ? "font-display text-gradient-gold" : ""}>{value}</span>
  </div>
);
