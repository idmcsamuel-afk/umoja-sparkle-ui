import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Star, Calculator, Flame, ExternalLink, Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";
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
  sa_available: boolean | null;
  sa_price_zar: number | null;
  import_cost_zar: number | null;
  price_advantage: number | null;
  opportunity_score: number | null;
  last_updated?: string;
}

type FilterId = "all" | "not_in_sa" | "better_than_sa" | "us_bestsellers";
type SortId = "opportunity" | "price_asc" | "margin" | "rank";

const fmtZAR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");
const fmtUSD = (n: number) => "$" + n.toFixed(2);

const opportunityMeta = (score: number) => {
  if (score >= 90)
    return { label: "High opportunity", emoji: "🔥🔥🔥", className: "bg-red-500/15 text-red-300 border-red-500/30" };
  if (score >= 70)
    return { label: "Good opportunity", emoji: "🔥🔥", className: "bg-orange-500/15 text-orange-300 border-orange-500/30" };
  if (score >= 50)
    return { label: "Moderate", emoji: "🔥", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  return { label: "Low margin", emoji: "⚠️", className: "bg-muted text-muted-foreground border-border" };
};

export const AmazonBestsellers = () => {
  const [products, setProducts] = useState<AmazonProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<AmazonProduct | null>(null);
  const [category, setCategory] = useState<string>("All");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("opportunity");

  const load = async () => {
    setLoading(true);
    await supabase.functions.invoke("fetch-amazon-products").catch(() => null);
    const { data } = await supabase
      .from("amazon_products")
      .select("*")
      .order("opportunity_score", { ascending: false, nullsFirst: false })
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

  const visible = useMemo(() => {
    let list = category === "All" ? products : products.filter((p) => p.category === category);
    if (filter === "not_in_sa") list = list.filter((p) => p.sa_available === false);
    if (filter === "better_than_sa")
      list = list.filter((p) => (p.price_advantage ?? 0) > 0);
    if (filter === "us_bestsellers")
      list = list.filter((p) => (p.sales_rank ?? Infinity) < 1000);

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return (a.price_zar ?? 0) - (b.price_zar ?? 0);
        case "margin":
          return (b.price_advantage ?? -Infinity) - (a.price_advantage ?? -Infinity);
        case "rank":
          return (a.sales_rank ?? Infinity) - (b.sales_rank ?? Infinity);
        case "opportunity":
        default:
          return (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0);
      }
    });
    return list;
  }, [products, category, filter, sort]);

  const filterChips: { id: FilterId; label: string }[] = [
    { id: "all", label: "All products" },
    { id: "not_in_sa", label: "Not in SA 🚀" },
    { id: "better_than_sa", label: "Better than SA price" },
    { id: "us_bestsellers", label: "US bestsellers" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">US ↔ SA Intelligence</p>
          <h3 className="font-display text-xl mt-1">Amazon import opportunities</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortId)}
            className="h-9 rounded-full border border-border bg-secondary/40 text-xs px-3"
          >
            <option value="opportunity">Sort: Opportunity score</option>
            <option value="margin">Sort: Margin potential</option>
            <option value="price_asc">Sort: Price (low → high)</option>
            <option value="rank">Sort: Sales rank</option>
          </select>
          <button
            onClick={load}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="Refresh products"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filterChips.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wider border transition-colors ${
              filter === f.id
                ? "bg-primary/20 text-primary border-primary/40"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
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
          No products match — try changing filters or ask admin to sync.
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
  const importCost = Number(p.import_cost_zar ?? 0);
  const rank = Number(p.sales_rank ?? 0);
  const isTopK = rank > 0 && rank < 1000;
  const score = Number(p.opportunity_score ?? 0);
  const meta = opportunityMeta(score);

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
          <div className="grid place-items-center size-full text-muted-foreground text-xs">No image</div>
        )}
        {isTopK && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-orange-500/20 text-orange-300 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
            <Flame className="h-3 w-3" /> Top 1K
          </div>
        )}
        <div className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${meta.className}`}>
          <span>{meta.emoji}</span> {score}/100
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <p
          className="font-display text-sm leading-tight overflow-hidden"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          title={p.title}
        >
          {p.title}
        </p>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-xl bg-secondary/40 p-2">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">US price</p>
            <p className="font-display text-xs mt-0.5">{fmtUSD(usd)}</p>
            <p className="text-[10px] text-muted-foreground">{fmtZAR(zar)}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-2 border border-primary/20">
            <p className="text-[9px] uppercase tracking-wider text-primary">Import cost</p>
            <p className="font-display text-xs mt-0.5 text-primary">{fmtZAR(importCost)}</p>
            <p className="text-[10px] text-muted-foreground">incl. duty + VAT</p>
          </div>
          <div className="rounded-xl bg-secondary/40 p-2">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">SA Amazon</p>
            {p.sa_available && p.sa_price_zar != null ? (
              <>
                <p className="font-display text-xs mt-0.5">{fmtZAR(p.sa_price_zar)}</p>
                {p.price_advantage != null && (
                  <p className={`text-[10px] ${p.price_advantage > 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {p.price_advantage > 0 ? "+" : ""}
                    {fmtZAR(p.price_advantage)}
                  </p>
                )}
              </>
            ) : (
              <p className="font-display text-xs mt-0.5 text-emerald-300">Not available ✅</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {Number(p.rating ?? 0).toFixed(1)} · {Number(p.review_count ?? 0).toLocaleString()}
          </span>
          {rank > 0 && <span>BSR #{rank.toLocaleString()}</span>}
        </div>

        <div className="flex gap-2 mt-auto">
          <Button onClick={onCalc} className="flex-1 h-10 rounded-2xl bg-gradient-primary text-primary-foreground">
            <Calculator className="h-4 w-4 mr-1.5" /> Margin
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
      const landed = Number(product.import_cost_zar ?? Number(product.price_zar ?? 0) * 1.55);
      const sa = product.sa_price_zar;
      // Suggest 10% under SA price if available, else 35% markup over landed
      setSellingPrice(Math.round(sa && sa > landed ? sa * 0.9 : landed * 1.35));
    }
  }, [product]);

  if (!product) return null;

  const fob = Number(product.price_zar ?? 0);
  const shipping = fob * 0.15;
  const cif = fob + shipping;
  const duty = cif * 0.25;
  const vat = (cif + duty) * 0.15;
  const landed = Number(product.import_cost_zar ?? cif + duty + vat);
  const profit = sellingPrice - landed;
  const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  const sa = product.sa_price_zar;
  const saAvailable = !!product.sa_available && sa != null;
  const score = Number(product.opportunity_score ?? 0);
  const meta = opportunityMeta(score);
  const competePrice = saAvailable ? Math.round((sa as number) * 0.86) : null;
  const competeProfit = competePrice != null ? competePrice - landed : null;
  const suggested = saAvailable
    ? Math.round((sa as number) * 0.9)
    : Math.round(landed * 1.6);
  const suggestedMargin = ((suggested - landed) / suggested) * 100;

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Margin & opportunity</DialogTitle>
          <DialogDescription className="line-clamp-2">{product.title}</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-3">
          {/* Column 1: Import yourself */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Import yourself</p>
            </div>
            <div className="divide-y divide-border text-sm">
              <Row label="FOB" value={fmtZAR(fob)} />
              <Row label="Shipping (15%)" value={fmtZAR(shipping)} />
              <Row label="Duty (25%)" value={fmtZAR(duty)} />
              <Row label="VAT (15%)" value={fmtZAR(vat)} />
              <Row label="Landed cost" value={fmtZAR(landed)} bold />
            </div>
            <div className="space-y-1.5 pt-2">
              <Label htmlFor="sellingPrice" className="text-xs">Your selling price (ZAR)</Label>
              <Input
                id="sellingPrice"
                type="number"
                min={0}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Math.max(0, Number(e.target.value)))}
                className="h-10"
              />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className={`rounded-xl p-2 ${profit >= 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                  <p className="text-[9px] uppercase tracking-wider opacity-80">Profit</p>
                  <p className="font-display text-sm">{fmtZAR(profit)}</p>
                </div>
                <div className={`rounded-xl p-2 ${margin >= 30 ? "bg-emerald-500/10 text-emerald-300" : margin >= 15 ? "bg-amber-500/10 text-amber-300" : "bg-red-500/10 text-red-300"}`}>
                  <p className="text-[9px] uppercase tracking-wider opacity-80">Margin</p>
                  <p className="font-display text-sm">{margin.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: SA Amazon */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">SA Amazon</p>
            </div>
            {saAvailable && sa != null ? (
              <div className="divide-y divide-border text-sm">
                <Row label="SA Amazon price" value={fmtZAR(sa)} />
                <Row label="Your landed cost" value={fmtZAR(landed)} />
                <Row
                  label="Advantage"
                  value={fmtZAR((sa as number) - landed)}
                  bold
                />
                {competePrice != null && competeProfit != null && (
                  <>
                    <Row label="Compete at (−14%)" value={fmtZAR(competePrice)} />
                    <Row
                      label="Profit at compete price"
                      value={fmtZAR(competeProfit)}
                      bold
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-500/10 text-emerald-300 p-3 text-sm">
                <p className="font-display">Not available on SA Amazon ✅</p>
                <p className="text-xs opacity-80 mt-1">
                  First-mover advantage — you can set the SA price.
                </p>
              </div>
            )}
          </div>

          {/* Column 3: Recommendation */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-[11px] uppercase tracking-wider text-primary">Recommendation</p>
            </div>
            <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${meta.className}`}>
              <span>{meta.emoji}</span> {meta.label} · {score}/100
            </div>
            <ul className="space-y-2 text-xs text-foreground/90">
              {!saAvailable && (
                <li>• Not on SA Amazon — first-mover advantage.</li>
              )}
              {Number(product.sales_rank ?? 0) > 0 && Number(product.sales_rank) < 1000 && (
                <li>• US bestseller #{Number(product.sales_rank).toLocaleString()} — proven demand.</li>
              )}
              {saAvailable && (product.price_advantage ?? 0) > 0 && (
                <li>• You can land it ~{fmtZAR(product.price_advantage as number)} cheaper than SA Amazon.</li>
              )}
              {saAvailable && (product.price_advantage ?? 0) <= 0 && (
                <li className="text-amber-300 inline-flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  SA Amazon is already priced below your landed cost — pass.
                </li>
              )}
            </ul>
            <div className="rounded-xl bg-background/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Suggested SA price</p>
              <p className="font-display text-lg text-gradient-gold">{fmtZAR(suggested)}</p>
              <p className="text-xs text-muted-foreground">
                Expected margin: <span className="text-emerald-300">{suggestedMargin.toFixed(0)}%</span>
              </p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
          Estimates only. Actual landed cost varies with shipping mode, HS code, and supplier terms. Always confirm with
          your freight forwarder before committing capital.
        </p>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className="flex items-center justify-between px-1 py-1.5 text-xs">
    <span className={bold ? "font-medium" : "text-muted-foreground"}>{label}</span>
    <span className={bold ? "font-display text-gradient-gold" : ""}>{value}</span>
  </div>
);
