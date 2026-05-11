import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, Users, Sparkles, Car, TrendingUp, ChevronRight, Loader2, User as UserIcon, Shield,
  Calculator as CalcIcon, ShoppingBag, Repeat, Building2, ShieldAlert, Gift, Palette,
} from "lucide-react";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { ThemeToggle } from "@/components/umoja/ThemeToggle";
import { NotificationBell } from "@/components/umoja/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ActivityRow {
  id: string;
  kind: "circle" | "spark" | "drive" | "predict";
  title: string;
  meta: string;
  amount: string;
  positive: boolean;
  at: number;
}

interface PredictorTeaser {
  id: string;
  question: string;
  options: string[];
  counts: Record<string, number>;
}

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");
const fmtCompact = (n: number) =>
  n >= 1_000_000
    ? `R${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
    : n >= 1_000
    ? `R${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
    : fmtR(n);

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

const ICONS = { circle: Users, spark: Sparkles, drive: Car, predict: TrendingUp } as const;

const Dashboard = () => {
  const { member, user } = useAuth();
  const firstName = member?.full_name?.split(" ")[0] ?? "friend";

  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ circle: 0, spark: 0, drive: 0, sparks: 0 });
  const [counts, setCounts] = useState({ circle: 0, spark: 0, drive: 0, predict: 0 });
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [teaser, setTeaser] = useState<PredictorTeaser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [kycLevel, setKycLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("[Dashboard] admin check failed:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) { setKycLevel(null); return; }
    supabase.from("members").select("kyc_level").eq("id", user.id).maybeSingle()
      .then(({ data }) => setKycLevel(data?.kyc_level ?? 0));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [
        bidsRes, ordersRes, driveRes, walletRes, predRes, memberRes,
        liveQRes, ledgerRes,
      ] = await Promise.all([
        supabase.from("circle_bids")
          .select("id, fiat_amount, net_amount, status, tier, created_at")
          .eq("member_id", uid),
        supabase.from("st_orders")
          .select("id, units, unit_price, order_total, status, created_at")
          .eq("member_id", uid),
        supabase.from("drive_members")
          .select("id, circle_id, total_contributed, status, joined_at")
          .eq("member_id", uid),
        supabase.from("spark_wallets").select("balance").eq("member_id", uid).maybeSingle(),
        supabase.from("predictor_entries")
          .select("id, selected_answer, sparks_won, sparks_spent, is_correct, created_at, question_id")
          .eq("member_id", uid),
        supabase.from("members").select("created_at").eq("id", uid).maybeSingle(),
        supabase.from("predictor_questions")
          .select("id, question, options, closes_at")
          .eq("status", "active")
          .gt("closes_at", new Date().toISOString())
          .order("closes_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.from("core_ledger")
          .select("id, event_type, amount, note, created_at")
          .eq("member_id", uid)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      const bids = bidsRes.data ?? [];
      const orders = ordersRes.data ?? [];
      const drives = driveRes.data ?? [];
      const wallet = walletRes.data;
      const preds = predRes.data ?? [];

      const circleTotal = bids
        .filter((b) => b.status === "active")
        .reduce((s, b) => s + Number(b.net_amount ?? b.fiat_amount ?? 0), 0);
      const driveTotal = drives.reduce((s, d) => s + Number(d.total_contributed ?? 0), 0);
      const sparkTotal = orders.reduce((s, o) => s + Number(o.order_total ?? 0), 0);
      const sparksBalance = Number(wallet?.balance ?? 0);

      setTotals({ circle: circleTotal, spark: sparkTotal, drive: driveTotal, sparks: sparksBalance });
      setCounts({
        circle: bids.filter((b) => b.status === "active").length,
        spark: orders.length,
        drive: drives.length,
        predict: preds.length,
      });
      setMemberSince(memberRes.data?.created_at ?? null);

      // Activity feed
      const feed: ActivityRow[] = [
        ...bids.map((b) => ({
          id: `b-${b.id}`,
          kind: "circle" as const,
          title: "Circle contribution",
          meta: `${b.tier ?? "circle"} · ${b.status ?? "pending"}`,
          amount: `−${fmtR(Number(b.fiat_amount ?? 0))}`,
          positive: false,
          at: b.created_at ? new Date(b.created_at).getTime() : 0,
        })),
        ...orders.map((o) => ({
          id: `o-${o.id}`,
          kind: "spark" as const,
          title: "Spark Trade order",
          meta: `${o.units} units · ${o.status ?? "pending"}`,
          amount: `−${fmtR(Number(o.order_total ?? 0))}`,
          positive: false,
          at: o.created_at ? new Date(o.created_at).getTime() : 0,
        })),
        ...drives.map((d) => ({
          id: `d-${d.id}`,
          kind: "drive" as const,
          title: "Drive circle joined",
          meta: d.status ?? "active",
          amount: fmtR(Number(d.total_contributed ?? 0)),
          positive: true,
          at: d.joined_at ? new Date(d.joined_at).getTime() : 0,
        })),
        ...preds.map((p) => ({
          id: `p-${p.id}`,
          kind: "predict" as const,
          title: "Predictor entry placed",
          meta: p.is_correct === true ? "Won" : p.is_correct === false ? "Lost" : "Awaiting result",
          amount:
            p.is_correct === true
              ? `+${p.sparks_won ?? 0} SP`
              : `−${p.sparks_spent ?? 0} SP`,
          positive: p.is_correct === true,
          at: p.created_at ? new Date(p.created_at).getTime() : 0,
        })),
        ...((ledgerRes.data ?? []) as Array<{ id: string; event_type: string; amount: number; note: string | null; created_at: string | null }>).map((l) => {
          const amt = Number(l.amount ?? 0);
          const positive = amt >= 0;
          return {
            id: `l-${l.id}`,
            kind: "spark" as const,
            title: l.event_type.replace(/_/g, " "),
            meta: l.note ?? "ledger",
            amount: `${positive ? "+" : "−"}${fmtR(Math.abs(amt))}`,
            positive,
            at: l.created_at ? new Date(l.created_at).getTime() : 0,
          };
        }),
      ]
        .sort((a, b) => b.at - a.at)
        .slice(0, 12);
      setActivity(feed);

      // Predictor teaser with vote distribution
      if (liveQRes.data) {
        const q = liveQRes.data as { id: string; question: string; options: unknown };
        const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
        const { data: votes } = await supabase
          .from("predictor_entries")
          .select("selected_answer")
          .eq("question_id", q.id);
        const c: Record<string, number> = {};
        opts.forEach((o) => (c[o] = 0));
        for (const v of votes ?? []) {
          if (v.selected_answer && c[v.selected_answer] !== undefined) c[v.selected_answer] += 1;
        }
        setTeaser({ id: q.id, question: q.question, options: opts, counts: c });
      } else {
        setTeaser(null);
      }

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  const totalWealth = useMemo(
    () => totals.circle + totals.drive + totals.sparks,
    [totals]
  );

  const quickActions = [
    { to: "/circle", icon: Users, label: "Circle", desc: `${counts.circle} active`, tint: "from-primary/30 to-primary/5" },
    { to: "/spark", icon: Sparkles, label: "Spark", desc: `${counts.spark} order${counts.spark === 1 ? "" : "s"}`, tint: "from-accent/30 to-accent/5" },
    { to: "/drive", icon: Car, label: "Drive", desc: fmtCompact(totals.drive), tint: "from-primary/25 to-accent/10" },
    { to: "/predictor", icon: TrendingUp, label: "Predict", desc: `${counts.predict} pick${counts.predict === 1 ? "" : "s"}`, tint: "from-accent/25 to-primary/10" },
  ];

  const totalVotes = teaser ? Object.values(teaser.counts).reduce((s, n) => s + n, 0) : 0;

  return (
    <main className="relative min-h-screen pb-32">
      {/* Top bar */}
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            {isAdmin && (
              <Link to="/admin" aria-label="Admin" title="Admin Console" className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <Shield className="h-4 w-4" />
              </Link>
            )}
            <Link to="/profile" aria-label="Profile" className="grid h-10 w-10 place-items-center rounded-2xl glass">
              <UserIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* KYC banner */}
      {kycLevel !== null && kycLevel < 3 && (
        <section className="px-5 pt-4">
          <Link
            to="/kyc"
            className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/15 to-primary/10 p-4 transition-smooth hover:border-accent/70 animate-fade-in"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent/20 text-accent">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">⚠️ Complete verification to unlock payouts</p>
              <p className="text-[11px] text-muted-foreground">Level {kycLevel} of 3 complete</p>
            </div>
            <span className="shrink-0 rounded-full bg-gradient-gold px-3 py-1.5 text-[11px] font-medium text-amber-950">
              Verify Now →
            </span>
          </Link>
        </section>
      )}

      {/* Greeting */}
      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Sawubona, {firstName}</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Your wealth is<br/>
            <span className="text-gradient-gold italic font-[450]">growing in trust.</span>
          </h1>
          {memberSince && (
            <p className="mt-2 text-xs text-muted-foreground">
              Member since {new Date(memberSince).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      </section>

      {/* Balance card */}
      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-scale-in">
          <div className="relative overflow-hidden rounded-[28px] p-6 bg-gradient-primary shadow-glow">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
            <div className="absolute inset-0 grain opacity-40" />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/80">Total wealth</p>
              <div className="mt-2 flex items-baseline gap-2">
                {loading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-primary-foreground/80" />
                ) : (
                  <p className="font-display text-[44px] leading-none text-primary-foreground tracking-tight">{fmtR(totalWealth)}</p>
                )}
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/15 px-3 py-1 text-xs text-primary-foreground">
                <Sparkles className="h-3.5 w-3.5" /> {Math.round(totals.sparks)} SP balance
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { k: "Circle", v: fmtCompact(totals.circle) },
                  { k: "Spark", v: fmtCompact(totals.spark) },
                  { k: "Drive", v: fmtCompact(totals.drive) },
                ].map((s) => (
                  <div key={s.k} className="rounded-2xl bg-background/15 backdrop-blur p-3">
                    <p className="text-[10px] uppercase tracking-wider text-primary-foreground/75">{s.k}</p>
                    <p className="mt-1 font-display text-base text-primary-foreground">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl">Pillars</h2>
            <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-smooth">
              Customize <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickActions.map(({ to, icon: Icon, label, desc, tint }, i) => (
              <Link
                to={to}
                key={label}
                style={{ animationDelay: `${i * 80}ms` }}
                className="group relative overflow-hidden rounded-3xl border border-border bg-gradient-card p-4 transition-smooth hover:border-primary/40 hover:-translate-y-0.5 animate-slide-up"
              >
                <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tint} blur-2xl`} />
                <div className="relative flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-smooth" />
                </div>
                <p className="relative mt-5 font-display text-lg">{label}</p>
                <p className="relative text-xs text-muted-foreground">{desc}</p>
              </Link>
            ))}
          </div>

          {/* Secondary tools */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { to: "/calculator", icon: CalcIcon, label: "Calculator" },
              { to: "/referrals", icon: Gift, label: "Invite 🎁" },
              { to: "/exchange", icon: Repeat, label: "Exchange" },
              { to: "/property", icon: Building2, label: "Property" },
            ].map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className="group rounded-2xl border border-border bg-gradient-card p-3 text-center transition-smooth hover:border-accent/50 hover:-translate-y-0.5"
              >
                <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-secondary text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground group-hover:text-foreground">{label}</p>
              </Link>
            ))}
          </div>

          {/* Flame Marketing shortcut */}
          <Link
            to="/flame-marketing"
            className="mt-4 group relative block overflow-hidden rounded-3xl border border-orange-500/30 bg-gradient-to-br from-emerald-950/60 via-card to-orange-950/40 p-4 transition-smooth hover:border-orange-500/60 hover:-translate-y-0.5"
          >
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-amber-400/40 to-orange-500/20 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-[0_10px_30px_-10px_hsl(20_90%_50%/0.7)]">
                <Palette className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base">Create Marketing Content 🎨</p>
                <p className="text-xs text-muted-foreground">AI captions, flyers & plans for your hustle — free</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-amber-400 group-hover:translate-x-0.5 transition-smooth" />
            </div>
          </Link>
        </div>
      </section>

      {/* Activity */}
      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-xl">Activity</h2>
          {loading ? (
            <div className="mt-4 grid place-items-center rounded-3xl glass p-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : activity.length === 0 ? (
            <div className="mt-4 rounded-3xl glass p-6 text-center text-sm text-muted-foreground">
              Nothing here yet — your story is about to begin.
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
              {activity.map((row, i) => {
                const Icon = ICONS[row.kind];
                return (
                  <li
                    key={row.id}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className="flex items-center gap-4 p-4 animate-fade-in"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.meta} · {timeAgo(row.at)}
                      </p>
                    </div>
                    <span className={`text-sm font-display ${row.positive ? "text-accent-soft" : "text-muted-foreground"}`}>
                      {row.amount}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Predictor teaser */}
      {teaser && (
        <section className="px-5 pt-8">
          <div className="mx-auto max-w-md">
            <Link to="/predictor" className="group block relative overflow-hidden rounded-3xl border border-border p-6 bg-gradient-card hover:border-accent/50 transition-smooth">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Today's predictor</p>
              <h3 className="mt-2 font-display text-2xl leading-tight">{teaser.question}</h3>
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {teaser.options.slice(0, 3).map((opt, idx) => {
                    const pct = totalVotes ? Math.round((teaser.counts[opt] / totalVotes) * 100) : 0;
                    return (
                      <span
                        key={opt}
                        className={`rounded-full text-xs px-3 py-1 ${
                          idx === 0 ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {opt} {pct}%
                      </span>
                    );
                  })}
                </div>
                <span className="text-sm font-medium text-foreground inline-flex items-center gap-1 group-hover:text-accent transition-smooth shrink-0">
                  Play <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      <BottomNav />
    </main>
  );
};

export default Dashboard;
