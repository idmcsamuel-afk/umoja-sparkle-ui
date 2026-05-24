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

interface MyBid {
  id: string;
  status: string | null;
  fiat_amount: number;
  tier: string;
  created_at: string;
}

interface CommunityStats {
  referrals: number;
  kyc_level: number;
}

interface QueueSummary {
  total: number;
  userBidExists: boolean;
  userRank: number | null;
}

interface CircleBidForScore {
  id?: string;
  member_id?: string | null;
  status: string | null;
  tier: string | null;
  fiat_amount: number | null;
  created_at: string | null;
  vault_start?: string | null;
  priority_score?: number | null;
}

interface MemberForScore {
  referral_count?: number | null;
  kyc_level?: number | null;
}

const TIER_MIN: Record<TierKey, number> = { seed: 200, growth: 2000, harvest: 10000 };

const getTierMin = (tierName?: string | null) => {
  if (tierName === "seed") return 200;
  if (tierName === "growth") return 2000;
  return 10000;
};

const contributionScoreForAmount = (amount: number, tierName?: string | null) => {
  const tierMin = getTierMin(tierName);
  return Math.min(15, (amount / Math.max(tierMin * 5, 1)) * 15);
};

const calculatePriorityScore = (member: MemberForScore | null, bids: CircleBidForScore[], selectedTier: TierKey) => {
  const totalBids = bids.filter((bid) => bid.status !== "rejected").length;
  const paidBids = bids.filter((bid) => ["paid", "vault", "matched"].includes(bid.status ?? "")).length;
  const paymentRate = totalBids > 0 ? paidBids / totalBids : 1;
  const consistencyScore = paymentRate * 40;

  const activeBids = bids.filter((bid) => bid.status === "vault");
  const selectedTierActiveBids = activeBids.filter((bid) => bid.tier === selectedTier);
  const queueBids = selectedTierActiveBids.length > 0 ? selectedTierActiveBids : activeBids;
  const oldestActiveBid = queueBids.reduce<CircleBidForScore | null>((oldest, bid) => {
    if (!bid.created_at) return oldest;
    if (!oldest?.created_at) return bid;
    return new Date(bid.created_at).getTime() < new Date(oldest.created_at).getTime() ? bid : oldest;
  }, null);
  const currentBid = queueBids.reduce<CircleBidForScore | null>((latest, bid) => {
    if (!bid.created_at) return latest ?? bid;
    if (!latest?.created_at) return bid;
    return new Date(bid.created_at).getTime() > new Date(latest.created_at).getTime() ? bid : latest;
  }, null);

  const daysWaiting = oldestActiveBid?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(oldestActiveBid.created_at).getTime()) / 86400000))
    : 0;
  const timeWaitingScore = Math.min(daysWaiting, 30);
  const bidAmount = Number(currentBid?.fiat_amount ?? 0);
  const contributionScore = contributionScoreForAmount(bidAmount, currentBid?.tier ?? selectedTier);
  const referralCount = Number(member?.referral_count ?? 0);
  const kycLevel = Number(member?.kyc_level ?? 0);
  let communityScore = Math.min(referralCount * 0.5, 6);
  if (kycLevel >= 3) communityScore += 2;
  if (kycLevel >= 2) communityScore += 1;
  communityScore = Math.min(communityScore, 10);
  const tierMin = getTierMin(currentBid?.tier ?? selectedTier);
  const boostAmount = Math.max(0, bidAmount - tierMin);
  const bidBoostScore = Math.min(boostAmount / 100, 5);
  const totalScore = consistencyScore + timeWaitingScore + contributionScore + communityScore + bidBoostScore;

  return {
    paymentRate,
    consistencyScore,
    daysWaiting,
    timeWaitingScore,
    bidAmount,
    contributionScore,
    referralCount,
    kycLevel,
    communityScore,
    bidBoostScore,
    totalScore,
  };
};

export default function Priority() {
  const { user } = useAuth();
  const [tier, setTier] = useState<TierKey>("seed");
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Record<TierKey, number>>(PAYOUTS_PER_SESSION);
  const [lastSnapshot, setLastSnapshot] = useState<{ priority_score: number; rank: number | null; session_at: string } | null>(null);
  const [myBid, setMyBid] = useState<MyBid | null>(null);
  const [community, setCommunity] = useState<CommunityStats>({ referrals: 0, kyc_level: 0 });
  const [queueSummary, setQueueSummary] = useState<QueueSummary>({ total: 0, userBidExists: false, userRank: null });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_member_platform_settings");
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setPayouts({
          seed: row.payouts_seed ?? 2,
          growth: row.payouts_growth ?? 1,
          harvest: row.payouts_harvest ?? 1,
        });
      }
    })();
  }, []);

  // Load user-level signals (any-status bid in tier + community impact)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: bid, error: bidErr } = await supabase
        .from("circle_bids")
        .select("id, status, fiat_amount, tier, created_at")
        .eq("member_id", user.id)
        .eq("tier", tier)
        .in("status", ["vault", "active", "payment_pending", "matched", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      console.log("[Priority] my bid:", { bid, bidErr, tier });
      setMyBid((bid as MyBid) ?? null);

      const { data: me } = await supabase
        .from("members")
        .select("referral_count, kyc_level")
        .eq("id", user.id)
        .maybeSingle();
      setCommunity({
        referrals: Number((me as MemberForScore | null)?.referral_count ?? 0),
        kyc_level: Number((me as MemberForScore | null)?.kyc_level ?? 0),
      });
    })();
  }, [user?.id, tier]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [activeCountRes, activeRowsRes, userBidRes, memberRes, userBidsRes] = await Promise.all([
        supabase
          .from("circle_bids")
          .select("*", { count: "exact", head: true })
          .eq("tier", tier)
          .eq("status", "vault")
          .not("vault_start", "is", null),
        supabase
          .from("circle_bids")
          .select("id, member_id, fiat_amount, tier, status, created_at, vault_start")
          .eq("tier", tier)
          .eq("status", "vault")
          .not("vault_start", "is", null)
          .order("created_at", { ascending: true })
          .limit(10),
        user?.id
          ? supabase
              .from("circle_bids")
              .select("id, member_id, fiat_amount, tier, status, created_at, vault_start")
              .eq("member_id", user.id)
              .eq("tier", tier)
              .eq("status", "vault")
              .not("vault_start", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
        user?.id
          ? supabase.from("members").select("*").eq("id", user.id).single()
          : Promise.resolve({ data: null, error: null } as const),
        user?.id
          ? supabase
              .from("circle_bids")
              .select("id, member_id, fiat_amount, tier, status, created_at, vault_start")
              .eq("member_id", user.id)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null } as const),
      ]);

      if (activeCountRes.error) console.error(activeCountRes.error);
      if (activeRowsRes.error) console.error(activeRowsRes.error);
      if ((userBidRes as any).error) console.error((userBidRes as any).error);
      if ((memberRes as any).error) console.error((memberRes as any).error);
      if ((userBidsRes as any).error) console.error((userBidsRes as any).error);

      const activeUserBid = (userBidRes as { data: CircleBidForScore | null }).data;
      const memberForScore = (memberRes as { data: MemberForScore | null }).data;
      const userBidsForScore = ((userBidsRes as { data: CircleBidForScore[] | null }).data ?? []);
      const liveScore = calculatePriorityScore(memberForScore, userBidsForScore, tier);
      let userRank: number | null = null;
      if (activeUserBid) {
        const { count: betterBids, error: betterBidsError } = await supabase
          .from("circle_bids")
          .select("*", { count: "exact", head: true })
          .eq("tier", tier)
          .eq("status", "vault")
          .not("vault_start", "is", null)
          .lt("created_at", activeUserBid.created_at);
        if (betterBidsError) console.error(betterBidsError);
        userRank = (betterBids ?? 0) + 1;
      }

      const activeRows = [...((activeRowsRes.data ?? []) as CircleBidForScore[])];
      if (activeUserBid && !activeRows.some((bid) => bid.id === activeUserBid.id)) {
        activeRows.push(activeUserBid);
      }
      activeRows.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());

      const visibleRows = activeRows.map((bid) => {
        const isUserBid = bid.member_id === user?.id;
        const bidAmount = Number(bid.fiat_amount ?? 0);
        const daysWaiting = bid.created_at ? Math.max(0, Math.floor((Date.now() - new Date(bid.created_at).getTime()) / 86400000)) : 0;
        const contributionScore = contributionScoreForAmount(bidAmount);
        const tierMin = getTierMin(bid.tier ?? tier);
        const bidBoostScore = Math.min(Math.max(0, bidAmount - tierMin) / 100, 5);
        const priorityScore = isUserBid
          ? liveScore.totalScore
          : 40 + Math.min(daysWaiting, 30) + contributionScore + bidBoostScore;
        return {
        bid_id: bid.id,
        member_id: bid.member_id,
        full_name: isUserBid ? "You" : "Member",
        fiat_amount: isUserBid ? liveScore.bidAmount : bidAmount,
        consistency_pct: isUserBid ? liveScore.paymentRate * 100 : 100,
        days_waiting: isUserBid ? liveScore.daysWaiting : daysWaiting,
        consistency_score: isUserBid ? liveScore.consistencyScore : 40,
        time_waiting_score: isUserBid ? liveScore.timeWaitingScore : Math.min(daysWaiting, 30),
        volume_score: isUserBid ? liveScore.contributionScore : contributionScore,
        community_score: isUserBid ? liveScore.communityScore : 0,
        bid_boost_score: isUserBid ? liveScore.bidBoostScore : bidBoostScore,
        priority_score: priorityScore,
        eligible: true,
        override_type: null,
        override_value: 0,
        breakdown: isUserBid ? { referrals: liveScore.referralCount, kyc_level: liveScore.kycLevel } : {},
        };
      }) satisfies ScoreRow[];
      setRows(visibleRows);

      const total = activeCountRes.count ?? 0;
      setQueueSummary({
        total,
        userBidExists: !!activeUserBid,
        userRank,
      });

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

  const me = useMemo(() => rows.find((r) => r.member_id === user?.id), [rows, user?.id]);
  const myRank = useMemo(() => {
    if (queueSummary.userRank) return queueSummary.userRank;
    if (!me) return null;
    const idx = rows.findIndex((r) => r.bid_id === me.bid_id);
    return idx === -1 ? null : idx + 1;
  }, [rows, me, queueSummary.userRank]);

  const queueMessage = useMemo(() => {
    if (queueSummary.total === 0) return "No active bids yet";
    if (queueSummary.userBidExists && myRank) return `You're in position #${myRank} of ${queueSummary.total}`;
    return "You're not in the queue yet";
  }, [queueSummary.total, queueSummary.userBidExists, myRank]);

  const estWeeks = useMemo(() => {
    if (!myRank) return null;
    const perWeek = payouts[tier] * SESSIONS_PER_WEEK[tier];
    return Math.max(1, Math.ceil(myRank / Math.max(1, perWeek)));
  }, [myRank, payouts, tier]);

  const scoreDelta = useMemo(() => {
    if (!me || !lastSnapshot) return null;
    return Number(me.priority_score) - Number(lastSnapshot.priority_score);
  }, [me, lastSnapshot]);

  const rankDelta = useMemo(() => {
    if (!myRank || !lastSnapshot?.rank) return null;
    // positive = moved up the queue (lower number is better)
    return Number(lastSnapshot.rank) - myRank;
  }, [myRank, lastSnapshot]);

  // Community impact (max 10)
  const communityScore = Math.min(
    10,
    Math.min(community.referrals * 0.5, 6) + (community.kyc_level >= 3 ? 2 : 0) + (community.kyc_level >= 2 ? 1 : 0),
  );

  // Potential score for a hypothetical first bid at tier minimum
  const potentialScore = useMemo(() => {
    const cons = 40; // first bid → no missed payments
    const time = 0;
    const min = TIER_MIN[tier];
    const vol = Math.min(15, (min / Math.max(min * 5, 1)) * 15);
    const boost = 0;
    return Math.round(cons + time + vol + communityScore + boost);
  }, [tier, communityScore]);


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
        <>
          <section className="px-5 mt-6">
            <div className="mx-auto max-w-md rounded-3xl glass p-6">
              {myBid ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-accent text-center">Bid in progress</p>
                  <p className="mt-2 text-sm text-center text-muted-foreground">
                    Your <span className="capitalize text-foreground">{tier}</span> bid of{" "}
                    <b className="text-foreground">{fmtR(Number(myBid.fiat_amount))}</b> is{" "}
                    <span className="text-foreground">{(myBid.status ?? "pending").replace(/_/g, " ")}</span>.
                    Once payment is confirmed it joins the priority queue below.
                  </p>
                </>
              ) : (
                <p className="text-sm text-center text-muted-foreground">
                  You don't have an active bid in the <span className="capitalize text-foreground">{tier}</span> circle yet.
                  Here's where you'd land based on your community impact.
                </p>
              )}
              <div className="mt-4 grid place-items-center">
                <Link to="/circle" className="inline-flex items-center gap-1 rounded-2xl bg-gradient-primary text-primary-foreground px-4 h-10 text-sm shadow-glow">
                  {myBid ? "View Circle" : "Make your first bid"}
                </Link>
              </div>
            </div>
          </section>

          <section className="px-5 mt-6">
            <div className="mx-auto max-w-md rounded-3xl border border-accent/30 bg-gradient-card p-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                <h3 className="font-display text-lg">Community impact</h3>
                <span className="ml-auto font-mono text-sm">{fmt(communityScore, 1)}<span className="text-muted-foreground">/10</span></span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li className="flex justify-between"><span>Referrals · {community.referrals} × 0.5pts</span><span className="font-mono text-foreground">+{Math.min(community.referrals * 0.5, 6).toFixed(1)}</span></li>
                <li className="flex justify-between"><span>KYC Level 2 bonus</span><span className="font-mono text-foreground">{community.kyc_level >= 2 ? "+1.0" : "0.0"}</span></li>
                <li className="flex justify-between"><span>KYC Level 3 bonus</span><span className="font-mono text-foreground">{community.kyc_level >= 3 ? "+2.0" : "0.0"}</span></li>
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground">
                These points carry over to every bid — grow them now to climb faster later.
              </p>
            </div>
          </section>

          <section className="px-5 mt-6">
            <div className="mx-auto max-w-md rounded-3xl border border-primary/30 bg-gradient-card p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h3 className="font-display text-lg">Your potential score</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                If you bid {fmtR(TIER_MIN[tier])} in <span className="capitalize text-foreground">{tier}</span> today:
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                <li className="flex justify-between"><span className="text-muted-foreground">Consistency (baseline)</span><span className="font-mono">40.0</span></li>
                <li className="flex justify-between"><span className="text-muted-foreground">Time waiting</span><span className="font-mono">0.0</span></li>
                <li className="flex justify-between"><span className="text-muted-foreground">Contribution volume</span><span className="font-mono">~3.0</span></li>
                <li className="flex justify-between"><span className="text-muted-foreground">Community impact</span><span className="font-mono">{fmt(communityScore, 1)}</span></li>
                <li className="flex justify-between"><span className="text-muted-foreground">Bid boost</span><span className="font-mono">0.0</span></li>
              </ul>
              <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm">Estimated score</span>
                <span className="font-display text-2xl text-gradient-gold">~{potentialScore}<span className="text-base text-muted-foreground">/100</span></span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {queueSummary.userBidExists && myRank
                  ? `You're in position #${myRank} of ${queueSummary.total}`
                  : queueSummary.total === 0
                    ? "No active bids yet"
                    : `You're not in the queue yet — join ${tier} to compete`}
              </p>
            </div>
          </section>

          <section className="px-5 mt-6">
            <div className="mx-auto max-w-md rounded-3xl glass p-5">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-accent" />
                <h3 className="font-display text-lg capitalize">{tier} queue: <span className="text-[11px] font-sans text-muted-foreground">{queueSummary.total} active</span></h3>
              </div>
              {queueSummary.total === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">No active bids yet</p>
              ) : (
                <ol className="mt-3 space-y-1.5">
                  {rows.slice(0, 10).map((r, i) => (
                    <li key={r.bid_id} className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground w-5">#{i + 1}</span>
                        <span className="truncate max-w-[140px]">{r.full_name}</span>
                      </span>
                      <span className="font-mono text-xs">{fmt(r.priority_score)}pts</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                {queueMessage === "You're not in the queue yet" ? (
                  <>You're not in the queue yet — <Link to="/circle" className="underline">join {tier}</Link> to compete.</>
                ) : queueMessage}
              </p>
            </div>
          </section>
        </>
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
              {scoreDelta !== null && (
                <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${scoreDelta > 0.05 ? "bg-emerald-500/15 text-emerald-400" : scoreDelta < -0.05 ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                  {scoreDelta > 0.05 ? <ArrowUp className="h-3 w-3" /> : scoreDelta < -0.05 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {scoreDelta > 0 ? "+" : ""}{fmt(scoreDelta, 1)} since last session
                </div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Rank in queue</p>
                  <p className="font-display text-2xl">
                    {myRank ? `#${myRank}` : <span className="text-destructive text-base">Disqualified</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">of {queueSummary.total}</p>
                  {rankDelta !== null && rankDelta !== 0 && (
                    <p className={`mt-1 inline-flex items-center gap-0.5 text-[10px] ${rankDelta > 0 ? "text-emerald-400" : "text-destructive"}`}>
                      {rankDelta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(rankDelta)} {rankDelta > 0 ? "up" : "down"}
                    </p>
                  )}
                  {rankDelta === 0 && (
                    <p className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Minus className="h-3 w-3" /> no change
                    </p>
                  )}
                </div>
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Estimated payout</p>
                  <p className="font-display text-2xl">{estWeeks ? `~${estWeeks}w` : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{payouts[tier]} winner{payouts[tier] === 1 ? "" : "s"}/session</p>
                </div>
              </div>
              {lastSnapshot && (
                <p className="mt-3 text-[10px] text-muted-foreground">
                  Last session: {new Date(lastSnapshot.session_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </p>
              )}
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

          {/* Next steps to improve */}
          <section className="px-5 mt-6">
            <div className="mx-auto max-w-md rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/10 to-primary/5 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h3 className="font-display text-lg">Next steps to improve</h3>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {Number(me.consistency_pct) < 100 && (
                  <li className="flex gap-2"><span className="text-accent">→</span><span>Pay on time for the next session to push consistency from <b>{fmt(me.consistency_pct,0)}%</b> to 100% (+{fmt(40 - Number(me.consistency_score),1)} pts).</span></li>
                )}
                {Number(me.community_score) < 10 && (
                  <li className="flex gap-2"><span className="text-accent">→</span><span>Refer 1 more verified member for +2 community points.</span></li>
                )}
                {Number(me.bid_boost_score) < 5 && (
                  <li className="flex gap-2"><span className="text-accent">→</span><span>Add ~R300 to your next bid to gain up to +{fmt(5 - Number(me.bid_boost_score),1)} boost points.</span></li>
                )}
                {((me.breakdown as { kyc_level?: number })?.kyc_level ?? 0) < 3 && (
                  <li className="flex gap-2"><span className="text-accent">→</span><span><Link to="/kyc" className="underline">Complete KYC Level 3</Link> for +2 community points.</span></li>
                )}
              </ul>
              <div className="mt-4 rounded-2xl bg-secondary/40 p-3 text-xs text-muted-foreground">
                <p>Estimated payout at current score: <b className="text-foreground">~{estWeeks ?? "—"} week{estWeeks === 1 ? "" : "s"}</b></p>
                {Number(me.priority_score) < 95 && (
                  <p className="mt-1">If your score reaches 95: ~{Math.max(1, Math.ceil((estWeeks ?? 8) * 0.35))} weeks</p>
                )}
              </div>
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
