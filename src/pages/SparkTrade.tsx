import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, TrendingUp, Users, Package, Flame, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { SparksDisclaimer } from "@/components/umoja/SparksDisclaimer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Shortlist {
  id: string;
  asin: string;
  product_name: string | null;
  category: string | null;
  sale_price: number | null;
  estimated_margin: number | null;
  margin_pct: number | null;
  sales_velocity: number | null;
  target_slots: number | null;
  joined_count: number | null;
  moq: number | null;
  status: string | null;
  added_at: string | null;
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

// Show every shortlisted product in every bucket — copy on the tabs differentiates them
// until enough products exist to split into distinct phases.

const SparkTrade = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Shortlist[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [sRes, oRes] = await Promise.all([
      supabase
        .from("spark_trade_shortlist")
        .select("*")
        .or("status.eq.open,status.eq.approved,status.is.null")
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

  const buckets = useMemo(
    () => ({ now: items, soon: items, wave: items }),
    [items]
  );

  const join = async (p: Shortlist) => {
    if (!user) return toast.error("Sign in to join");
    setJoining(p.id);
    const next = Number(p.joined_count ?? 0) + 1;
    const { error } = await supabase.rpc("join_spark_trade", { _id: p.id });
    setJoining(null);
    if (error) return toast.error(error.message);
    toast.success(`You're in on ${p.product_name ?? p.asin}`);
    setItems((arr) => arr.map((x) => (x.id === p.id ? { ...x, joined_count: next } : x)));
  };

  const Card = ({ p }: { p: Shortlist }) => {
    const target = Number(p.target_slots ?? 0) || 1;
    const joined = Number(p.joined_count ?? 0);
    const pct = Math.min(100, Math.round((joined / target) * 100));
    return (
      <article className="group relative overflow-hidden rounded-3xl glass p-5 animate-slide-up">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{p.category ?? "Product"}</p>
            <p className="mt-1 font-display text-lg leading-tight truncate">{p.product_name ?? p.asin}</p>
            <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-2">
              <Package className="h-3 w-3" /> ASIN {p.asin} · MOQ {p.moq ?? 1}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sell at</p>
            <p className="font-display text-base text-gradient-gold">{fmtR(p.sale_price)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-secondary/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margin</p>
            <p className="mt-1 font-display text-sm">{Math.round(Number(p.margin_pct ?? 0))}%</p>
          </div>
          <div className="rounded-2xl bg-secondary/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p>
            <p className="mt-1 font-display text-sm">{fmtR(p.estimated_margin)}</p>
          </div>
          <div className="rounded-2xl bg-secondary/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Velocity</p>
            <p className="mt-1 font-display text-sm inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-accent" /> {p.sales_velocity ?? 0}/d
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {joined} / {target} slots
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <button
          onClick={() => join(p)}
          disabled={joining === p.id || joined >= target}
          className="mt-5 w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {joining === p.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : joined >= target ? (
            "Slots full"
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Join the buy
            </>
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
        </div>
      </section>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <Tabs defaultValue="now" className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-secondary/60 p-1 h-12">
              <TabsTrigger value="now" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow text-xs">
                Buy Now
              </TabsTrigger>
              <TabsTrigger value="soon" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground text-xs">
                Buy Soon
              </TabsTrigger>
              <TabsTrigger value="wave" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground text-xs">
                Coming Wave
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
              </>
            )}
          </Tabs>
        </div>
      </section>

      {/* My trade activity */}
      <section className="px-5 pt-10">
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-xl">My trades</h2>
          {loading ? null : orders.length === 0 ? (
            <div className="mt-4">
              <Empty msg="No trades yet — join a buy above to begin." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-4 p-4 animate-fade-in">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {o.units} units @ {fmtR(o.unit_price)}
                    </p>
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
    </main>
  );
};

export default SparkTrade;
