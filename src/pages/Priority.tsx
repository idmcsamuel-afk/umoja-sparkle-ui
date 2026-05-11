import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Trophy, TrendingUp, Users, Award, Calendar, Target, Sparkles, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";

interface ScoreRow {
  bid_id: string;
  member_id: string;
  full_name: string;
  fiat_amount: number;
  consistency_pct: number;
  days_waiting: number;
  consistency_score: number;
  time_waiting_score: number;
  volume_score: number;
  community_score: number;
  bid_boost_score: number;
  priority_score: number;
  eligible: boolean;
  override_type: string | null;
  override_value: number;
  breakdown: Record<string, unknown>;
}

const TIERS = ["seed", "growth", "harvest"] as const;
type TierKey = typeof TIERS[number];

const PAYOUTS_PER_SESSION: Record<TierKey, number> = { seed: 2, growth: 1, harvest: 1 };
const SESSIONS_PER_WEEK: Record<TierKey, number> = { seed: 14, growth: 7, harvest: 3 };

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");
const fmt = (n: number, d = 1) => Number(n ?? 0).toFixed(d);

export default function Priority() {
  const { user } = useAuth();
  const [tier, setTier] = useState<TierKey>("seed");
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Record<TierKey, number>>(PAYOUTS_PER_SESSION);
  const [lastSnapshot, setLastSnapshot] = useState<{ priority_score: number; rank: number | null; session_at: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("payouts_seed, payouts_growth, payouts_harvest")
        .limit(1)
        .maybeSingle();
      if (data) {
        setPayouts({
          seed: data.payouts_seed ?? 2,
          growth: data.payouts_growth ?? 1,
          harvest: data.payouts_harvest ?? 1,
        });
      }
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("compute_session_scores", { _tier: tier });
      if (error) console.error(error);
      setRows((data ?? []) as ScoreRow[]);

      if (user?.id) {
        const { data: snap } = await supabase
          .from("circle_score_snapshots")
          .select("priority_score, rank, session_at")
          .eq("member_id", user.id)
          .eq("tier", tier)
          .order("session_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setLastSnapshot(snap ?? null);
      } else {
        setLastSnapshot(null);
      }
      setLoading(false);
    })();
  }, [tier, user?.id]);

  const scoreDelta = useMemo(() => {
    if (!me || !lastSnapshot) return null;
    return Number(me.priority_score) - Number(lastSnapshot.priority_score);
  }, [me, lastSnapshot]);

  const rankDelta = useMemo(() => {
    if (!myRank || !lastSnapshot?.rank) return null;
    // positive = moved up the queue (lower number)
    return Number(lastSnapshot.rank) - myRank;
  }, [myRank, lastSnapshot]);

  const me = useMemo(() => rows.find((r) => r.member_id === user?.id), [rows, user?.id]);
  const eligibleRows = useMemo(() => rows.filter((r) => r.eligible), [rows]);
  const myRank = useMemo(() => {
    if (!me) return null;
    const idx = eligibleRows.findIndex((r) => r.bid_id === me.bid_id);
    return idx === -1 ? null : idx + 1;
  }, [eligibleRows, me]);

  const estWeeks = useMemo(() => {
    if (!myRank) return null;
    const perWeek = payouts[tier] * SESSIONS_PER_WEEK[tier];
    return Math.max(1, Math.ceil(myRank / Math.max(1, perWeek)));
  }, [myRank, payouts, tier]);

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/circle" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Priority</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Your queue<br />
            <span className="text-gradient-gold italic font-[450]">position.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Higher scores get paid out first when a session closes. Improve your score by paying on time, bidding extra, and growing the community.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-md px-5 mt-6">
        <div className="inline-flex w-full rounded-2xl border border-border bg-secondary/30 p-1">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={`flex-1 px-3 py-2 rounded-xl text-sm capitalize transition-smooth ${tier === t ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !me ? (
        <section className="px-5 mt-6">
          <div className="mx-auto max-w-md rounded-3xl glass p-6 text-center">
            <p className="text-sm text-muted-foreground">
              You don't have an active bid in the <span className="capitalize text-foreground">{tier}</span> circle yet.
              Place a bid to see your priority score and queue position.
            </p>
            <Link
              to="/circle"
              className="mt-4 inline-flex items-center gap-1 rounded-2xl bg-gradient-primary text-primary-foreground px-4 h-10 text-sm shadow-glow"
            >
              Place a bid
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Score hero */}
          <section className="px-5 mt-6">
            <div className="mx-auto max-w-md rounded-3xl border border-primary/40 bg-gradient-card p-6 text-center">
              <div className="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-primary/15 text-primary">
                <Trophy className="h-5 w-5" />
              </div>
              <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-accent">Your priority score</p>
              <p className="mt-1 font-display text-5xl text-gradient-gold">{fmt(me.priority_score)}</p>
              <p className="mt-2 text-xs text-muted-foreground">out of 100 possible</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Rank in queue</p>
                  <p className="font-display text-2xl">
                    {myRank ? `#${myRank}` : <span className="text-destructive text-base">Disqualified</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">of {eligibleRows.length}</p>
                </div>
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Estimated payout</p>
                  <p className="font-display text-2xl">{estWeeks ? `~${estWeeks}w` : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{payouts[tier]} winner{payouts[tier] === 1 ? "" : "s"}/session</p>
                </div>
              </div>
              {!me.eligible && (
                <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  Not currently eligible. Reach 80% payment consistency and KYC level 2+ to enter the queue.
                </p>
              )}
            </div>
          </section>

          {/* Breakdown */}
          <section className="px-5 mt-6">
            <div className="mx-auto max-w-md space-y-3">
              <h2 className="font-display text-xl">Score breakdown</h2>
              {[
                { icon: TrendingUp, label: "Consistency", score: me.consistency_score, max: 40, hint: `${fmt(me.consistency_pct)}% payment rate` },
                { icon: Calendar,   label: "Time waiting", score: me.time_waiting_score, max: 30, hint: `${me.days_waiting} days waiting` },
                { icon: Target,     label: "Contribution", score: me.volume_score, max: 15, hint: `${fmtR(me.fiat_amount)} bid` },
                { icon: Users,      label: "Community", score: me.community_score, max: 10, hint: `${(me.breakdown as { referrals?: number })?.referrals ?? 0} referrals · KYC L${(me.breakdown as { kyc_level?: number })?.kyc_level ?? 0}` },
                { icon: Sparkles,   label: "Bid boost", score: me.bid_boost_score, max: 5, hint: "Bid above tier minimum to earn boost" },
              ].map((row) => {
                const Icon = row.icon;
                const pct = Math.min(100, Math.round((Number(row.score) / row.max) * 100));
                return (
                  <div key={row.label} className="rounded-3xl border border-border bg-gradient-card p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-secondary text-accent">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between">
                          <p className="text-sm font-medium">{row.label}</p>
                          <p className="font-mono text-sm">{fmt(row.score)}<span className="text-muted-foreground">/{row.max}</span></p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{row.hint}</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Improve */}
          <section className="px-5 mt-6">
            <div className="mx-auto max-w-md rounded-3xl glass p-5">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-accent" />
                <h3 className="font-display text-lg">How to climb the queue</h3>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>• Maintain 100% payment consistency to max your 40-point base</li>
                <li>• Refer friends — each successful referral adds 2 community points</li>
                <li>• Complete KYC Level 3 for a +2 community bonus</li>
                <li>• Bid above the tier minimum for up to +5 boost points</li>
              </ul>
            </div>
          </section>
        </>
      )}

      <BottomNav />
    </main>
  );
}
