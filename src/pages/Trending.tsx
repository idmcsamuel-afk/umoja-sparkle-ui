import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, Calculator, Lock, Flame } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Product = {
  id: string;
  product_name: string;
  description: string | null;
  image_url: string | null;
  source: string | null;
  source_url: string | null;
  views_count: number | null;
  trending_score: number | null;
  sa_available: boolean | null;
  estimated_fob_price: number | null;
  estimated_sa_market_price: number | null;
  margin_percentage: number | null;
  category: string | null;
  tags: string[] | null;
  trending_since: string | null;
  featured: boolean | null;
  created_at: string;
};

type Requirement = {
  compliance_status: string;
  current_month_spend: number;
  min_monthly_spend: number;
  current_month_units: number;
  min_monthly_units: number;
  next_review_date: string | null;
  access_revoked_at: string | null;
};

type AccessInfo = {
  hasAccess: boolean | null;
  isGold: boolean;
  isBuyersClub: boolean;
};

const fmt = (n: number | null | undefined) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const marginColor = (m: number | null) => {
  if (!m) return "text-muted-foreground";
  if (m > 50) return "text-emerald-500";
  if (m >= 30) return "text-amber-500";
  return "text-muted-foreground";
};

const sourceStyle = (s: string | null) => {
  if (s === "tiktok") return "bg-pink-500/15 text-pink-500";
  if (s === "youtube") return "bg-red-500/15 text-red-500";
  return "bg-muted text-muted-foreground";
};

const FILTERS = [
  { key: "all", label: "🔥 All" },
  { key: "featured", label: "⭐ Featured" },
  { key: "tiktok", label: "🎵 TikTok Viral" },
  { key: "youtube", label: "📺 YouTube" },
  { key: "not_sa", label: "🇿🇦 Not in SA" },
  { key: "high_margin", label: "💰 High Margin" },
] as const;

export default function Trending() {
  const [access, setAccess] = useState<AccessInfo>({ hasAccess: null, isGold: false, isBuyersClub: false });
  const [memberData, setMemberData] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setAccess({ hasAccess: false, isGold: false, isBuyersClub: false });
        return;
      }

      const { data: member } = await supabase
        .from("members")
        .select("has_buyers_club_access, buyers_club_status, buyers_club_tier")
        .eq("id", user.id)
        .single();
      if (!active) return;

      setMemberData(member);
      const isBuyersClub = member?.has_buyers_club_access === true && member?.buyers_club_status === "active";
      const isGold = member?.buyers_club_tier === "gold";
      const hasAccess = isBuyersClub || isGold;

      console.log("Trending access check:", {
        has_buyers_club_access: member?.has_buyers_club_access,
        buyers_club_status: member?.buyers_club_status,
        buyers_club_tier: member?.buyers_club_tier,
        hasAccess,
      });

      setAccess({ hasAccess, isGold, isBuyersClub });
    };

    checkAccess();
    return () => { active = false; };
  }, []);

  if (access.hasAccess === null) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (access.hasAccess === false) {
    return <LockedView />;
  }

  return <AllProductsGrid isGold={memberData?.buyers_club_tier === "gold"} />;
}

function AllProductsGrid({ isGold }: { isGold: boolean }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [req, setReq] = useState<Requirement | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("trending");
  const [calcProduct, setCalcProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: prods }, { data: track }, { data: r }] = await Promise.all([
        supabase.from("trending_products").select("*").order("trending_score", { ascending: false }),
        supabase.from("member_product_tracking").select("product_id").eq("member_id", user.id),
        supabase.from("member_purchase_requirements").select("*").eq("member_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setProducts((prods ?? []) as Product[]);
      setTracked(new Set((track ?? []).map((t: any) => t.product_id)));
      setReq(r as Requirement | null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (filter === "featured") list = list.filter((p) => p.featured);
    else if (filter === "tiktok") list = list.filter((p) => p.source === "tiktok");
    else if (filter === "youtube") list = list.filter((p) => p.source === "youtube");
    else if (filter === "not_sa") list = list.filter((p) => p.sa_available === false);
    else if (filter === "high_margin") list = list.filter((p) => (p.margin_percentage ?? 0) > 50);

    if (sort === "margin") list.sort((a, b) => (b.margin_percentage ?? 0) - (a.margin_percentage ?? 0));
    else if (sort === "views") list.sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0));
    else if (sort === "newest") list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else list.sort((a, b) => (b.trending_score ?? 0) - (a.trending_score ?? 0));
    return list;
  }, [products, filter, sort]);

  const trackedProducts = products.filter((p) => tracked.has(p.id));
  const suspended = req?.compliance_status === "suspended";

  const toggleTrack = async (productId: string) => {
    if (!user || suspended) return;
    if (tracked.has(productId)) {
      await supabase.from("member_product_tracking").delete().eq("member_id", user.id).eq("product_id", productId);
      const next = new Set(tracked); next.delete(productId); setTracked(next);
    } else {
      await supabase.from("member_product_tracking").insert({ member_id: user.id, product_id: productId });
      setTracked(new Set([...tracked, productId]));
      toast({ title: "Tracking added", description: "We'll notify you of updates." });
    }
  };

  const banner = () => {
    const status = req?.compliance_status ?? "compliant";
    const spend = Number(req?.current_month_spend ?? 0);
    const minSpend = Number(req?.min_monthly_spend ?? 0);
    const units = Number(req?.current_month_units ?? 0);
    const minUnits = Number(req?.min_monthly_units ?? 0);
    const spendPct = minSpend > 0 ? Math.min(100, (spend / minSpend) * 100) : 100;
    const unitPct = minUnits > 0 ? Math.min(100, (units / minUnits) * 100) : 100;
    const overallPct = Math.round(Math.min(spendPct, unitPct));
    const daysLeft = req?.next_review_date
      ? Math.max(0, Math.ceil((+new Date(req.next_review_date) - Date.now()) / 86_400_000))
      : 0;

    const cfg =
      status === "suspended"
        ? {
            icon: "🚫",
            label: "Suspended",
            tone: "bg-destructive/15 border-destructive/40 text-destructive-foreground",
            barTone: "bg-destructive",
            title: "Access suspended",
            msg: `Minimum monthly purchase not met. Restore access by purchasing R${minSpend} through the platform.`,
          }
        : status === "warning"
        ? {
            icon: "⚠️",
            label: "Warning",
            tone: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
            barTone: "bg-amber-500",
            title: "Action needed",
            msg: `You're behind on this month's requirement. ${daysLeft} day${daysLeft === 1 ? "" : "s"} left to maintain access.`,
          }
        : {
            icon: "✅",
            label: "Compliant",
            tone: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
            barTone: "bg-emerald-500",
            title: "Access active",
            msg: `You're meeting this month's requirements. Next review in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
          };

    return (
      <div className={`rounded-xl border px-4 py-3 text-sm space-y-2 ${cfg.tone}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>{cfg.icon}</span>
            <div>
              <div className="font-semibold">{cfg.title}</div>
              <div className="text-xs opacity-80">{cfg.msg}</div>
            </div>
          </div>
          <Badge variant="outline" className="font-semibold uppercase tracking-wide">{cfg.label}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Monthly spend</span>
              <span className="font-medium">R{spend} / R{minSpend}</span>
            </div>
            <div className="h-1.5 rounded-full bg-background/50 overflow-hidden">
              <div className={`h-full ${cfg.barTone}`} style={{ width: `${spendPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Monthly units</span>
              <span className="font-medium">{units} / {minUnits}</span>
            </div>
            <div className="h-1.5 rounded-full bg-background/50 overflow-hidden">
              <div className={`h-full ${cfg.barTone}`} style={{ width: `${unitPct}%` }} />
            </div>
          </div>
        </div>
        <div className="text-[11px] opacity-70 pt-1">Overall progress: {overallPct}%</div>
      </div>
    );
  };

  if (!loading && !access.hasAccess) {
    return <LockedView products={products} />;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 pb-28 md:pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-display font-bold flex items-center gap-2">
          <Flame className="h-8 w-8 text-accent" /> Coming Wave
          {isGold && (
            <Badge className="ml-2 bg-amber-500/90 text-white">🏆 Gold Tier — Free Access</Badge>
          )}
        </h1>
        <p className="text-accent font-medium">Viral products before SA market saturation</p>
        <p className="text-sm text-muted-foreground">Early-mover advantage = highest margins. See what's trending before your competition.</p>
      </header>

      {banner()}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="ml-auto px-3 py-1.5 text-xs rounded-full bg-muted text-foreground border border-border"
        >
          <option value="trending">Trending score</option>
          <option value="margin">Margin % (high → low)</option>
          <option value="views">Views (high → low)</option>
          <option value="newest">Date added (newest)</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${suspended ? "relative" : ""}`}>
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              tracked={tracked.has(p.id)}
              onTrack={() => toggleTrack(p.id)}
              onCalc={() => setCalcProduct(p)}
              disabled={suspended}
            />
          ))}
          {suspended && (
            <div className="absolute inset-0 backdrop-blur-md bg-background/60 flex flex-col items-center justify-center gap-3 rounded-xl">
              <Lock className="h-10 w-10 text-destructive" />
              <h3 className="text-xl font-bold">Access Restricted</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Meet monthly purchase minimum to unlock. Required: R{req?.min_monthly_spend} · You: R{req?.current_month_spend}.
              </p>
              <a href="mailto:support@umojarise.com" className="text-accent text-sm underline">Contact Support</a>
            </div>
          )}
        </div>
      )}

      <section className="space-y-3 pt-6">
        <h2 className="text-xl font-bold">Your Tracked Products ({trackedProducts.length})</h2>
        {trackedProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Track products to see them here. Click ❤️ on any product above.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackedProducts.map((p) => (
              <ProductCard key={p.id} product={p} tracked onTrack={() => toggleTrack(p.id)} onCalc={() => setCalcProduct(p)} disabled={suspended} />
            ))}
          </div>
        )}
      </section>

      <MarginCalcModal product={calcProduct} onClose={() => setCalcProduct(null)} />
    </div>
  );
}

function ProductCard({
  product: p,
  tracked,
  onTrack,
  onCalc,
  disabled,
}: {
  product: Product;
  tracked: boolean;
  onTrack: () => void;
  onCalc: () => void;
  disabled?: boolean;
}) {
  const isNew =
    p.trending_since ? Date.now() - +new Date(p.trending_since) < 7 * 86_400_000 : false;
  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] bg-muted">
        {p.image_url ? (
          <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-4xl">📦</div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {isNew && <Badge className="bg-orange-500/90 text-white">🔥 Trending</Badge>}
          {p.featured && <Badge className="bg-amber-500/90 text-white">⭐</Badge>}
          {p.sa_available === false && <Badge className="bg-emerald-500/90 text-white">🇿🇦 Not in SA</Badge>}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{p.product_name}</h3>
        <div className="flex items-center justify-between text-xs">
          <span className={`px-2 py-0.5 rounded-full font-medium capitalize ${sourceStyle(p.source)}`}>{p.source ?? "manual"}</span>
          <span className="text-muted-foreground">{fmt(p.views_count)} views</span>
        </div>
        <div className={`text-2xl font-bold ${marginColor(p.margin_percentage)}`}>
          {p.margin_percentage ? `${Math.round(p.margin_percentage)}%` : "—"}
          <span className="text-xs font-normal text-muted-foreground ml-1">margin</span>
        </div>
        <div className="flex gap-2 mt-auto">
          <Button size="sm" variant={tracked ? "default" : "outline"} onClick={onTrack} disabled={disabled} className="flex-1">
            <Heart className={`h-4 w-4 ${tracked ? "fill-current" : ""}`} /> {tracked ? "Tracked" : "Track"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onCalc} disabled={disabled} className="flex-1">
            <Calculator className="h-4 w-4" /> Margin
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MarginCalcModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [qty, setQty] = useState(1);
  const [sellPrice, setSellPrice] = useState(0);

  useEffect(() => {
    if (product) {
      setQty(1);
      setSellPrice(Number(product.estimated_sa_market_price ?? 0));
    }
  }, [product]);

  if (!product) return null;
  const fob = Number(product.estimated_fob_price ?? 0);
  const shipping = fob * 0.15;
  const cif = fob + shipping;
  const duty = cif * 0.25;
  const vat = (cif + duty) * 0.15;
  const landed = cif + duty + vat;
  const unitProfit = sellPrice - landed;
  const totalProfit = unitProfit * qty;
  const margin = sellPrice > 0 ? (unitProfit / sellPrice) * 100 : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.product_name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Card className="p-4 space-y-2">
            <h4 className="font-bold text-base">Import Cost</h4>
            <Row k="FOB Price" v={`R${fob.toFixed(2)}`} />
            <Row k="Shipping (15%)" v={`R${shipping.toFixed(2)}`} />
            <Row k="CIF Total" v={`R${cif.toFixed(2)}`} />
            <Row k="Customs Duty (25%)" v={`R${duty.toFixed(2)}`} />
            <Row k="VAT (15%)" v={`R${vat.toFixed(2)}`} />
            <hr className="border-border" />
            <Row k="Total Landed" v={`R${landed.toFixed(2)}`} bold />
          </Card>
          <Card className="p-4 space-y-3">
            <h4 className="font-bold text-base">Your Pricing</h4>
            <div>
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <Label className="text-xs">Selling Price (R)</Label>
              <Input type="number" min={0} value={sellPrice} onChange={(e) => setSellPrice(Number(e.target.value))} />
            </div>
            <hr className="border-border" />
            <Row k="Unit Profit" v={`R${unitProfit.toFixed(2)}`} />
            <Row k="Total Profit" v={`R${totalProfit.toFixed(2)}`} bold />
            <Row k="Margin %" v={<span className={marginColor(margin)}>{margin.toFixed(1)}%</span>} bold />
          </Card>
          <Card className="p-4 space-y-2">
            <h4 className="font-bold text-base">Market Intel</h4>
            <Row k="Opportunity Score" v={<Badge>{product.trending_score ?? "—"}</Badge>} />
            <Row k="SA Availability" v={product.sa_available === false ? "Not in SA ✅" : "Available"} />
            <Row k="Views" v={fmt(product.views_count)} />
            <Row k="Trending since" v={product.trending_since ? new Date(product.trending_since).toLocaleDateString() : "—"} />
            <Row k="Recommended SA price" v={`R${Number(product.estimated_sa_market_price ?? 0).toFixed(2)}`} />
            <Row k="Expected margin" v={`${Math.round(product.margin_percentage ?? 0)}%`} />
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, bold }: { k: string; v: React.ReactNode; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-bold text-base" : ""}`}>
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function LockedView({ products }: { products: Product[] }) {
  const demos = products.filter((p) => (p.tags ?? []).includes("demo")).slice(0, 3);
  const fallbackDemos = demos.length > 0 ? demos : products.filter((p) => p.featured).slice(0, 3);
  const previewProducts = fallbackDemos.length > 0 ? fallbackDemos : products.slice(0, 3);
  const previewIds = new Set(previewProducts.map((p) => p.id));
  const blurred = products.filter((p) => !previewIds.has(p.id)).slice(0, 8);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-8 pb-28 md:pb-10">
      <header className="space-y-3 text-center max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-display font-bold flex items-center justify-center gap-2">
          <Flame className="h-8 w-8 text-accent" /> Coming Wave — Spark Trade Members Only
        </h1>
        <p className="text-accent font-medium">Early-mover advantage on viral products</p>
        <Badge className="bg-amber-500/90 text-white">🏆 Gold Members: Free Access Included</Badge>
        <p className="text-xs text-muted-foreground pt-1">
          Join 28 members already inside · 12 new products added this week
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Badge variant="outline">Preview</Badge> Sample of what's inside
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {previewProducts.map((p) => (
            <Card key={p.id} className="overflow-hidden flex flex-col">
              <div className="relative aspect-[4/3] bg-muted">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-4xl">📦</div>
                )}
                <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">Preview</Badge>
              </div>
              <div className="p-3 flex flex-col gap-2 flex-1">
                <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{p.product_name}</h3>
                <div className={`text-2xl font-bold ${marginColor(p.margin_percentage)}`}>
                  {p.margin_percentage ? `${Math.round(p.margin_percentage)}%` : "—"}
                  <span className="text-xs font-normal text-muted-foreground ml-1">margin</span>
                </div>
                <p className="text-xs text-muted-foreground">{fmt(p.views_count)} views</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {blurred.length > 0 && (
        <section className="space-y-3 relative">
          <h2 className="text-lg font-bold">More trending products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 select-none">
            {blurred.map((p) => (
              <Card key={p.id} className="overflow-hidden flex flex-col blur-sm pointer-events-none">
                <div className="relative aspect-[4/3] bg-muted">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-4xl">📦</div>
                  )}
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{p.product_name}</h3>
                  <div className="text-2xl font-bold text-muted-foreground">— %</div>
                </div>
              </Card>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/80 backdrop-blur-sm border border-border rounded-full px-5 py-2 text-sm font-semibold flex items-center gap-2 shadow-lg">
              <Lock className="h-4 w-4" /> Unlock with Spark Trade
            </div>
          </div>
        </section>
      )}

      <Card className="p-6 md:p-8 space-y-5 bg-gradient-to-br from-primary/10 via-accent/5 to-amber-500/10 border-primary/30">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Unlock Full Trending Intelligence</h2>
          <p className="text-sm text-muted-foreground">Everything you need to ride the wave before SA catches on.</p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <li>✅ See all trending viral products</li>
          <li>✅ China supplier pricing (FOB costs)</li>
          <li>✅ Margin calculators with import costs</li>
          <li>✅ Track products you're interested in</li>
          <li>✅ Join group buys for better pricing</li>
          <li>✅ Access before SA market saturation</li>
        </ul>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <Card className="p-4 space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Bronze</div>
            <div className="text-xl font-bold">R2,000<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
          </Card>
          <Card className="p-4 space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Silver</div>
            <div className="text-xl font-bold">R5,000<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
          </Card>
          <Card className="p-4 space-y-1 border-amber-500/50 ring-1 ring-amber-500/40">
            <div className="text-xs uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold">Gold 🏆</div>
            <div className="text-xl font-bold">R10,000<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
            <div className="text-[11px] text-amber-700 dark:text-amber-300">Includes Trending access FREE</div>
          </Card>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <a href="/founding"><Button className="bg-primary text-primary-foreground">Upgrade to Spark Trade</Button></a>
          <a href="/founding"><Button variant="outline">View Founding Tiers</Button></a>
        </div>
      </Card>
    </div>
  );
}
