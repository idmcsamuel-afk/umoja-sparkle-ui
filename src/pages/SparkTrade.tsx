import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, TrendingUp, Users, Package, Flame, Clock, Lock, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { SparksDisclaimer } from "@/components/umoja/SparksDisclaimer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BuyersClubModal } from "@/components/umoja/BuyersClubModal";
import { AmazonBestsellers } from "@/components/umoja/AmazonBestsellers";

interface Shortlist {
  id: string;
  asin: string;
  product_name: string | null;
  category: string | null;
  sale_price: number | null;
  estimated_margin: number | null;
  margin_pct: number | null;
  sales_velocity: number | null;
  estimated_monthly_sales: number | null;
  target_slots: number | null;
  joined_count: number | null;
  moq: number | null;
  status: string | null;
  added_at: string | null;
  data_source: string | null;
  is_demo: boolean | null;
  cost_breakdown: any | null;
}

interface Order {
  id: string;
  units: number;
  unit_price: number;
  order_total: number;
  status: string | null;
  created_at: string | null;
}

const fmtR = (n: number | null | undefined) =>
  "R" + Math.round(Number(n ?? 0)).toLocaleString("en-ZA");

const SparkTrade = () => {
  const { user, member } = useAuth();
  const [access, setAccess] = useState<{ hasAccess: boolean; isGold: boolean; isBuyersClub: boolean }>({
    hasAccess: false,
    isGold: false,
    isBuyersClub: false,
  });
  const hasAccess = access.hasAccess;
  const [items, setItems] = useState<Shortlist[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [clubOpen, setClubOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data: m } = await supabase
        .from("members")
        .select("has_buyers_club_access, buyers_club_status, buyers_club_tier")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      const isBuyersClub = !!(m?.has_buyers_club_access && m?.buyers_club_status === "active");
      const isGold = m?.buyers_club_tier === "gold";
      setAccess({ hasAccess: isBuyersClub || isGold, isGold, isBuyersClub });
    })();
    return () => { active = false; };
  }, [user?.id]);

  const load = async () => {
    setLoading(true);
    const [sRes, oRes] = await Promise.all([
      supabase
        .from("spark_trade_shortlist")
        .select("*")
        .or("status.eq.open,status.eq.approved,status.eq.buy_now,status.eq.buy_soon,status.is.null")
        .order("added_at", { ascending: false }),
      user
        ? supabase
            .from("st_orders")
            .select("id, units, unit_price, order_total, status, created_at")
            .eq("member_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    if (sRes.error) console.error(sRes.error);
    if (oRes.error) console.error(oRes.error);
    setItems((sRes.data ?? []) as Shortlist[]);
    setOrders((oRes.data ?? []) as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const location = useLocation();
  useEffect(() => {
    if (loading) return;
    const id = location.hash.replace("#", "");
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [location.hash, loading]);

  // Members without club access only see demo products
  const visible = useMemo(
    () => (hasAccess ? items.filter((p) => !p.is_demo) : items.filter((p) => p.is_demo).slice(0, 3)),
    [items, hasAccess],
  );

  const buckets = useMemo(
    () => ({
      now: visible.filter((p) => p.status !== "buy_soon"),
      soon: visible.filter((p) => p.status === "buy_soon" || (p as any).data_source === "serpapi"),
      wave: visible,
    }),
    [visible],
  );

  const join = async (p: Shortlist) => {
    if (!user) return toast.error("Sign in to join");
    if (p.is_demo) return toast.message("Demo product — join Buyers Club to unlock real buys.");
    setJoining(p.id);
    const next = Number(p.joined_count ?? 0) + 1;
    const { error } = await supabase.rpc("join_spark_trade", { _id: p.id });
    setJoining(null);
    if (error) return toast.error(error.message);
    toast.success(`You're in on ${p.product_name ?? p.asin}`);
    setItems((arr) => arr.map((x) => (x.id === p.id ? { ...x, joined_count: next } : x)));
  };

  const memberTier = (((member as any)?.buyers_club_tier as "bronze" | "silver" | "gold" | undefined)) ?? "bronze";
  const tierLabel = { bronze: "Bronze", silver: "Silver", gold: "Gold" }[memberTier];
  const tierBonus = { bronze: 0, silver: 5, gold: 10 }[memberTier];

  const Card = ({ p }: { p: Shortlist }) => {
    const target = Number(p.target_slots ?? 0) || 1;
    const joined = Number(p.joined_count ?? 0);
    const pct = Math.min(100, Math.round((joined / target) * 100));
    const isDemo = !!p.is_demo;
    const cb = p.cost_breakdown;
    const tierPrice = cb ? Number(cb[`${memberTier}_sell_price`] ?? p.sale_price ?? 0) : Number(p.sale_price ?? 0);
    const tierProfit = cb ? Number(cb[`${memberTier}_profit`] ?? p.estimated_margin ?? 0) : Number(p.estimated_margin ?? 0);
    const tierMargin = tierPrice > 0 ? Math.round((tierProfit / tierPrice) * 100) : Number(p.margin_pct ?? 0);
    return (
      <article className={`group relative overflow-hidden rounded-3xl glass p-5 animate-slide-up ${isDemo ? "ring-1 ring-amber-500/40" : ""}`}>
        {isDemo && (
          <div className="absolute right-3 top-3 text-[10px] uppercase tracking-[0.18em] rounded-full bg-amber-500/20 text-amber-400 px-2 py-0.5">
            Demo Product
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{p.category ?? "Product"}</p>
            <p className="mt-1 font-display text-lg leading-tight truncate">{p.product_name ?? p.asin}</p>
            <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-2">
              <Package className="h-3 w-3" /> {p.data_source === "makro" ? "SKU" : "ASIN"} {p.asin} · MOQ {p.moq ?? 1}
            </p>
            {p.data_source === "serpapi" ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.18em] rounded-full bg-emerald-700/30 text-amber-300 px-2 py-0.5">
                  🌍 International Opportunity
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                  Popular in US/UK
                </span>
              </div>
            ) : p.data_source && !isDemo && (
              <span className="mt-2 inline-block text-[10px] uppercase tracking-[0.18em] rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                Sourced from {p.data_source === "makro" ? "Makro" : p.data_source === "amazon" ? "Amazon" : p.data_source}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{hasAccess ? `${tierLabel} price` : "Sell at"}</p>
            <p className="font-display text-base text-gradient-gold">{hasAccess ? `R${tierPrice.toFixed(2)}` : "🔒 Locked"}</p>
            {hasAccess && tierBonus > 0 && (
              <p className="text-[10px] text-accent">+{tierBonus}% better margin</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-secondary/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margin</p>
            <p className="mt-1 font-display text-sm">{hasAccess ? `${tierMargin}%` : "🔒 —"}</p>
          </div>
          <div className="rounded-2xl bg-secondary/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your profit</p>
            <p className="mt-1 font-display text-sm">{hasAccess ? `R${tierProfit.toFixed(2)}` : "🔒 —"}</p>
          </div>
          <div className="rounded-2xl bg-secondary/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sold/mo</p>
            <p className="mt-1 font-display text-sm inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-accent" />
              {hasAccess ? `~${Number(p.estimated_monthly_sales ?? p.sales_velocity ?? 0).toLocaleString()}` : "🔒"}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {hasAccess ? `${joined} / ${target} slots` : "Group buy"}
            </span>
            <span>{hasAccess ? `${pct}%` : "Locked"}</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-gradient-gold transition-all" style={{ width: `${hasAccess ? pct : 0}%` }} />
          </div>
        </div>


        <button
          onClick={() => (hasAccess ? join(p) : setClubOpen(true))}
          disabled={hasAccess && (isDemo || joining === p.id || joined >= target)}
          className="mt-5 w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {!hasAccess ? (
            <><Lock className="h-4 w-4" /> Unlock with Buyers Club</>
          ) : joining === p.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isDemo ? (
            <><Lock className="h-4 w-4" /> Demo only</>
          ) : joined >= target ? (
            "Slots full"
          ) : (
            <><Sparkles className="h-4 w-4" /> Join the buy</>
          )}
        </button>
      </article>
    );
  };

  const Empty = ({ msg }: { msg: string }) => (
    <div className="rounded-3xl glass p-6 text-center text-sm text-muted-foreground">{msg}</div>
  );

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Spark Trade</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            The buyers club<br />
            <span className="text-gradient-gold italic font-[450]">with edge.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Vetted products. Group buying power. Real margins.
          </p>
          {access.isGold && (
            <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] rounded-full bg-amber-500/20 text-amber-400 px-3 py-1">
              <Crown className="h-3 w-3" /> Gold Tier — Free Access
            </span>
          )}
        </div>
      </section>

      {!hasAccess && (
        <section className="px-5 pt-6">
          <div className="mx-auto max-w-md">
            <div className="rounded-3xl border border-accent/40 bg-accent/10 p-5">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-display text-lg leading-tight">Spark Trade Members Only</p>
                  <p className="mt-1 text-xs text-accent-soft leading-relaxed">
                    Full product details, supplier pricing and group buys are unlocked for paid Buyers Club members.
                  </p>
                  <button
                    onClick={() => setClubOpen(true)}
                    className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-2xl bg-gradient-primary px-4 text-sm font-medium text-primary-foreground shadow-glow"
                  >
                    <Crown className="h-4 w-4" /> Join Buyers Club
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section id="signals" className="px-5 pt-8 scroll-mt-24">
        <div className="mx-auto max-w-md">
          <Tabs defaultValue="now" className="w-full">
            <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-secondary/60 p-1 h-12">
              <TabsTrigger value="now" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow text-[11px]">
                Buy Now
              </TabsTrigger>
              <TabsTrigger value="soon" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground text-[11px]">
                Buy Soon
              </TabsTrigger>
              <TabsTrigger value="wave" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground text-[11px]">
                Coming Wave
              </TabsTrigger>
              <TabsTrigger value="amazon" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground text-[11px]">
                Amazon
              </TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="mt-6 grid place-items-center rounded-3xl glass p-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <TabsContent value="now" className="mt-5 space-y-3">
                  {buckets.now.length ? buckets.now.map((p) => <Card key={p.id} p={p} />) : <Empty msg="No products ready to buy right now." />}
                </TabsContent>
                <TabsContent value="soon" className="mt-5 space-y-3">
                  {buckets.soon.length ? buckets.soon.map((p) => <Card key={p.id} p={p} />) : <Empty msg="No products gathering soon." />}
                </TabsContent>
                <TabsContent value="wave" className="mt-5 space-y-3">
                  {buckets.wave.length ? buckets.wave.map((p) => <Card key={p.id} p={p} />) : <Empty msg="No new products on the horizon." />}
                </TabsContent>
                <TabsContent value="amazon" className="mt-5">
                  <AmazonBestsellers />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </section>

      <section className="px-5 pt-10">
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-xl">My orders</h2>
          {loading ? null : orders.length === 0 ? (
            <div className="mt-4">
              <Empty msg="No orders yet — join a buy above to begin." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-4 p-4 animate-fade-in">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.units} units @ {fmtR(o.unit_price)}</p>
                    <p className="truncate text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {o.status ?? "pending"} · {o.created_at ? new Date(o.created_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <span className="text-sm font-display text-gradient-gold">{fmtR(o.order_total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="px-5 pt-6"><div className="mx-auto max-w-md"><SparksDisclaimer /></div></section>
      <BottomNav />
      <BuyersClubModal open={clubOpen} onOpenChange={setClubOpen} onSuccess={load} />
    </main>
  );
};

export default SparkTrade;
