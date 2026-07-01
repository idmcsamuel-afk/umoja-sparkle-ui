import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, TrendingUp, Users, Package, Flame, Clock, Lock, Crown, Ship, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { SparksDisclaimer } from "@/components/umoja/SparksDisclaimer";
import { toast } from "sonner";
import { BuyersClubModal } from "@/components/umoja/BuyersClubModal";

interface Opportunity {
  id: number;
  product_name: string;
  category: string | null;
  product_image_url: string | null;
  supplier_name: string | null;
  supplier_country: string | null;
  moq_required: number | null;
  current_reserved: number | null;
  stock_quantity: number | null;
  suggested_selling_price_zar: number | null;
  landed_cost_sea_zar: number | null;
  landed_cost_air_zar: number | null;
  gross_margin_sea_zar: number | null;
  gross_margin_air_zar: number | null;
  margin_sea_pct: number | null;
  margin_air_pct: number | null;
  air_available: boolean | null;
  group_buy_status: string | null;
  spotlight_rank: number | null;
  trending_direction: string | null;
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
  const [access, setAccess] = useState<{ hasAccess: boolean; isGold: boolean }>({ hasAccess: false, isGold: false });
  const hasAccess = access.hasAccess;
  const [items, setItems] = useState<Opportunity[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<number | null>(null);
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
      const isPaid = !!(m?.has_buyers_club_access && m?.buyers_club_status === "active");
      const isGold = m?.buyers_club_tier === "gold";
      setAccess({ hasAccess: isPaid || isGold, isGold });
    })();
    return () => { active = false; };
  }, [user?.id]);

  const load = async () => {
    setLoading(true);
    const [sRes, oRes] = await Promise.all([
      supabase
        .from("spark_trade_opportunities")
        .select("id, product_name, category, product_image_url, supplier_name, supplier_country, moq_required, current_reserved, stock_quantity, suggested_selling_price_zar, landed_cost_sea_zar, landed_cost_air_zar, gross_margin_sea_zar, gross_margin_air_zar, margin_sea_pct, margin_air_pct, air_available, group_buy_status, spotlight_rank, trending_direction")
        .eq("is_spotlight", true)
        .order("spotlight_rank", { ascending: true, nullsFirst: false }),
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
    setItems((sRes.data ?? []) as Opportunity[]);
    setOrders((oRes.data ?? []) as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const memberTier = (((member as any)?.buyers_club_tier as "basic" | "pro" | "fulfilled" | undefined)) ?? "basic";
  const tierBonus = { basic: 0, pro: 5, fulfilled: 10, gold: 10 }[memberTier as any] ?? 0;

  const join = async (p: Opportunity) => {
    if (!user) return toast.error("Sign in to join");
    if (!hasAccess) return setClubOpen(true);
    setJoining(p.id);
    // TODO: wire to real reservation RPC; optimistic UI for now
    setTimeout(() => {
      setJoining(null);
      toast.success(`You're in on ${p.product_name}`);
      setItems((arr) => arr.map((x) => (x.id === p.id ? { ...x, current_reserved: Number(x.current_reserved ?? 0) + 1 } : x)));
    }, 400);
  };

  const Card = ({ p }: { p: Opportunity }) => {
    const target = Number(p.moq_required ?? 0) || 1;
    const joined = Number(p.current_reserved ?? 0);
    const pct = Math.min(100, Math.round((joined / target) * 100));
    const price = Number(p.suggested_selling_price_zar ?? 0);
    const seaProfit = Number(p.gross_margin_sea_zar ?? 0);
    const airProfit = Number(p.gross_margin_air_zar ?? 0);
    const seaPct = Number(p.margin_sea_pct ?? 0);
    const airPct = Number(p.margin_air_pct ?? 0);
    const airOn = !!p.air_available && airProfit > 0;

    return (
      <article className="group relative overflow-hidden rounded-3xl glass p-5 animate-slide-up">
        <div className="flex items-start gap-3">
          {p.product_image_url ? (
            <img
              src={p.product_image_url}
              alt={p.product_name}
              loading="lazy"
              className="h-20 w-20 rounded-2xl object-cover bg-secondary shrink-0"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-secondary shrink-0">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{p.category ?? "Product"}</p>
            <p className="mt-1 font-display text-base leading-tight line-clamp-2">{p.product_name}</p>
            <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-2">
              <Package className="h-3 w-3" /> MOQ {p.moq_required ?? 1}
              {p.trending_direction === "up" && <span className="text-emerald-400 inline-flex items-center gap-0.5"><TrendingUp className="h-3 w-3" /> trending</span>}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sell at</p>
            <p className="font-display text-lg text-gradient-gold">{hasAccess ? fmtR(price) : "🔒 Locked"}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-secondary/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Ship className="h-3 w-3" /> Sea margin
            </p>
            <p className="mt-1 font-display text-sm">
              {hasAccess ? `${Math.round(seaPct)}% · ${fmtR(seaProfit)}` : "🔒 —"}
            </p>
            <p className="text-[10px] text-muted-foreground">4–6 weeks</p>
          </div>
          <div className={`rounded-2xl p-3 ${airOn ? "bg-secondary/60" : "bg-secondary/30 opacity-60"}`}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Plane className="h-3 w-3" /> Air margin
            </p>
            <p className="mt-1 font-display text-sm">
              {hasAccess ? (airOn ? `${Math.round(airPct)}% · ${fmtR(airProfit)}` : "—") : "🔒 —"}
            </p>
            <p className="text-[10px] text-muted-foreground">{airOn ? "5–10 days" : "Not available"}</p>
          </div>
        </div>

        {hasAccess && tierBonus > 0 && (
          <p className="mt-2 text-[10px] text-accent">+{tierBonus}% better margin on your tier</p>
        )}

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {hasAccess ? `${joined} / ${target} committed` : "Group buy"}
            </span>
            <span>{hasAccess ? `${pct}%` : "Locked"}</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-gradient-gold transition-all" style={{ width: `${hasAccess ? pct : 0}%` }} />
          </div>
        </div>

        <button
          onClick={() => (hasAccess ? join(p) : setClubOpen(true))}
          disabled={hasAccess && (joining === p.id || joined >= target)}
          className="mt-5 w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {!hasAccess ? (
            <><Lock className="h-4 w-4" /> Unlock with Buyers Club</>
          ) : joining === p.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : joined >= target ? (
            "Group buy full"
          ) : (
            <><Sparkles className="h-4 w-4" /> Join the group buy</>
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
                    Selling price, real margins and group-buy access are unlocked for paid Buyers Club members.
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
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl">Curated catalog</h2>
            <span className="text-[11px] text-muted-foreground">{items.length} live</span>
          </div>
          {loading ? (
            <div className="mt-6 grid place-items-center rounded-3xl glass p-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="mt-5"><Empty msg="No spotlighted products right now — check back soon." /></div>
          ) : (
            <div className="mt-5 space-y-3">
              {items.map((p) => <Card key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </section>

      <section className="px-5 pt-10">
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-xl">My orders</h2>
          {loading ? null : orders.length === 0 ? (
            <div className="mt-4">
              <Empty msg="No orders yet — join a group buy above to begin." />
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
