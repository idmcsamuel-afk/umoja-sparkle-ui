import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Flame, Clock, ChevronRight, Upload, Copy, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CircleAcceptanceModal, hasAcceptedCircle } from "@/components/umoja/CircleAcceptanceModal";
import { CircleSessionTimer, getSessionState } from "@/components/umoja/CircleSessionTimer";
import { SparksDisclaimer } from "@/components/umoja/SparksDisclaimer";
import { CircleStatusBanner } from "@/components/umoja/CircleStatusBanner";
import { TimezoneSelector } from "@/components/umoja/TimezoneSelector";
import { PaymentMethodSelector, type PaymentMethod } from "@/components/umoja/PaymentMethodSelector";
import { usePaystack, buildReference } from "@/hooks/usePaystack";
import { cn } from "@/lib/utils";
import { CircleTierCard, type MyQueueStatus } from "@/components/umoja/CircleTierCard";
import { ReferralPromo } from "@/components/umoja/ReferralPromo";
import { LiveActivityTicker } from "@/components/umoja/LiveActivityTicker";
import { useSocialProof } from "@/hooks/useSocialProof";
import { ttTrack } from "@/lib/tiktokPixel";

interface Tier {
  tier: string;
  min_entry: number;
  max_entry: number;
  growth_rate: number;
  vault_days: number;
  daily_velocity_cap: number;
  sessions_per_day: number | null;
  is_active: boolean | null;
}

interface Bid {
  id: string;
  tier: string;
  fiat_amount: number;
  net_amount: number;
  status: string | null;
  created_at: string | null;
  vault_end: string | null;
  payout_amount: number | null;
  payment_deadline: string | null;
  payment_proof_url: string | null;
  payment_reference: string | null;
}

interface TierStats { pool: number; members: number; target: number; }

interface Settings {
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  branch_code: string | null;
  payment_instructions: string | null;
}

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

function fmtCountdown(ms: number) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const KNOWN_TIERS = new Set(["seed", "growth", "harvest"]);

const Circle = () => {
  const { user } = useAuth();
  const proof = useSocialProof();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [stats, setStats] = useState<Record<string, TierStats>>({});
  const [queueStatus, setQueueStatus] = useState<Record<string, MyQueueStatus>>({});
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { ttTrack("ViewContent", { content_type: "Circles" }); }, []);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Bid modal flow
  const [open, setOpen] = useState<Tier | null>(null);
  const [step, setStep] = useState<"amount" | "pay">("amount");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingBid, setPendingBid] = useState<{ id: string; amount: number; ref: string } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("paystack");
  const { pay: payWithPaystack } = usePaystack();
  const [copied, setCopied] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<Array<{ member_id: string; full_name: string; priority_score: number }>>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [leadersError, setLeadersError] = useState<string | null>(null);

  const loadLeaders = async (tier: string) => {
    setLeadersLoading(true);
    setLeadersError(null);
    const { data, error } = await supabase.rpc("compute_session_scores", { _tier: tier });
    if (error) {
      setLeadersError(error.message || "Could not load leaders");
      setLeaders([]);
    } else {
      const top = ((data ?? []) as Array<{ member_id: string; full_name: string; priority_score: number; eligible: boolean }>)
        .filter((s) => s.eligible)
        .slice(0, 2)
        .map((s) => ({ member_id: s.member_id, full_name: s.full_name, priority_score: Number(s.priority_score) }));
      setLeaders(top);
    }
    setLeadersLoading(false);
  };

  // Tick for closed-session countdowns on buttons
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    setLoading(true);
    // Best-effort: expire any unpaid bids whose deadline has passed.
    try { await supabase.rpc("expire_unpaid_bids"); } catch {}

    const [tiersRes, bidsRes, statsRes, settingsRes, queueRes] = await Promise.all([
      supabase.from("circle_tiers").select("*").order("min_entry"),
      user
        ? supabase
            .from("circle_bids")
            .select("id, tier, fiat_amount, net_amount, status, created_at, vault_end, payout_amount, payment_deadline, payment_proof_url, payment_reference")
            .eq("member_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null } as const),
      supabase.rpc("circle_tier_stats"),
      supabase.rpc("get_member_platform_settings"),
      user
        ? supabase.rpc("get_my_circle_queue_status")
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    if (tiersRes.error) console.error(tiersRes.error);
    if (bidsRes.error) console.error(bidsRes.error);
    if (statsRes.error) console.error(statsRes.error);
    if ((queueRes as any).error) console.error("[Circle] queue status error:", (queueRes as any).error);

    const t = (tiersRes.data ?? []) as Tier[];
    setTiers(t);
    setBids((bidsRes.data ?? []) as Bid[]);
    const settingsRow = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
    setSettings((settingsRow ?? null) as Settings | null);

    const qmap: Record<string, MyQueueStatus> = {};
    for (const r of (((queueRes as any).data ?? []) as MyQueueStatus[])) {
      qmap[(r as any).tier] = r;
    }
    setQueueStatus(qmap);
    console.log("[Circle] user queue status:", { userId: user?.id, queue: qmap });

    const grouped: Record<string, TierStats> = {};
    for (const tier of t) {
      grouped[tier.tier] = {
        pool: 0,
        members: 0,
        target: Number(tier.max_entry) * Number(tier.daily_velocity_cap || 1),
      };
    }
    for (const row of (statsRes.data ?? []) as { tier: string; pool: number | string; members: number | string }[]) {
      if (!grouped[row.tier]) continue;
      grouped[row.tier].pool = Number(row.pool || 0);
      grouped[row.tier].members = Number(row.members || 0);
    }
    setStats(grouped);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`user_circle_updates_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_bids", filter: `member_id=eq.${user.id}` },
        (payload) => {
          console.log("[Circle] bid changed:", payload);
          load();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const sessionFor = (tierKey: string) => {
    const k = tierKey?.toLowerCase();
    if (!KNOWN_TIERS.has(k)) return null;
    return getSessionState(k as "seed" | "growth" | "harvest", now);
  };

  const startBid = (t: Tier, defaultAmt: number) => {
    if (!t.is_active) return;
    if (!hasAcceptedCircle()) { toast.info("Please accept the Circle terms first."); return; }
    const sess = sessionFor(t.tier);
    if (sess && sess.status !== "open") {
      toast.error("Session closed. Please wait for the next session to bid.");
      return;
    }
    setOpen(t);
    setStep("amount");
    setAmount(String(defaultAmt));
    setPendingBid(null);
    setProofFile(null);
  };

  const closeModal = () => {
    setOpen(null);
    setStep("amount");
    setPendingBid(null);
    setProofFile(null);
  };

  // Step 1 → create the bid as 'pending', advance to step 2
  const confirmBid = async () => {
    if (!open || !user) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < open.min_entry || amt > open.max_entry) {
      toast.error(`Enter between ${fmtR(open.min_entry)} and ${fmtR(open.max_entry)}`);
      return;
    }
    setBusy(true);
    const platform_fee = +(amt * 0.02).toFixed(2);
    const ubuntu_fund_cut = +(amt * 0.03).toFixed(2);
    const net_amount = +(amt - platform_fee - ubuntu_fund_cut).toFixed(2);

    const { data, error } = await supabase
      .from("circle_bids")
      .insert({
        member_id: user.id,
        tier: open.tier,
        fiat_amount: amt,
        spark_amount: 0,
        platform_fee,
        ubuntu_fund_cut,
        net_amount,
        status: "pending",
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not place bid");
      return;
    }
    const ref = `BID-${data.id.slice(0, 8).toUpperCase()}-${user.id.slice(0, 4).toUpperCase()}`;
    await supabase.from("circle_bids").update({ payment_reference: ref }).eq("id", data.id);
    setPendingBid({ id: data.id, amount: amt, ref });
    setStep("pay");
    ttTrack("InitiateCheckout", {
      value: amt,
      currency: "ZAR",
      content_type: "circle_contribution",
      content_id: open.tier,
    });
    // Load top 2 leaders for this tier (privacy: only initials + masked code)
    loadLeaders(open.tier);
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join(".") + ".";
  const memberCode = (id: string) => id.slice(0, 6).toUpperCase();

  // Step 2 → upload proof, mark payment_pending, notify admins
  const submitPayment = async () => {
    if (!pendingBid || !user || !open) return;

    // Paystack flow — instant activation via verification edge fn
    if (method === "paystack") {
      setBusy(true);
      const memberShort = user.id.slice(0, 6).toUpperCase();
      const ref = buildReference("CIRCLE", open.tier, memberShort);
      console.log("[Paystack Debug] Circle submitPayment →", {
        email: user.email,
        amount: pendingBid.amount,
        reference: ref,
        tier: open.tier,
        bidId: pendingBid.id,
      });
      if (!user.email) {
        setBusy(false);
        toast.error("Your account has no email — add one in Profile to use card payments");
        return;
      }
      const { error: refErr } = await supabase
        .from("circle_bids")
        .update({
          payment_method: "paystack",
          paystack_reference: ref,
          payment_reference: ref,
          status: "payment_pending",
          payment_submitted_at: new Date().toISOString(),
        })
        .eq("id", pendingBid.id);
      if (refErr) { setBusy(false); return toast.error(refErr.message); }
      // Close this dialog first so Radix focus trap doesn't block Paystack iframe inputs
      closeModal();
      await new Promise((r) => setTimeout(r, 150));
      const result = await payWithPaystack({
        email: user.email ?? "",
        amountZar: pendingBid.amount,
        reference: ref,
        metadata: { member_id: user.id, payment_type: "circle_contribution", tier: open.tier },
      });
      setBusy(false);
      if (result.ok) {
        ttTrack("CompletePayment", {
          value: pendingBid.amount,
          currency: "ZAR",
          content_type: "circle_contribution",
          content_id: open.tier,
        });
        load();
      }
      return;
    }

    if (!proofFile) {
      toast.error("Please attach proof of payment");
      return;
    }
    setBusy(true);
    const ext = proofFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${pendingBid.id}.${ext}`;
    const up = await supabase.storage
      .from("payment-proofs")
      .upload(path, proofFile, { upsert: true, contentType: proofFile.type || undefined });
    if (up.error) {
      setBusy(false);
      toast.error(up.error.message);
      return;
    }
    const { error: updErr } = await supabase
      .from("circle_bids")
      .update({
        status: "payment_pending",
        payment_proof_url: path,
        payment_method: "eft",
        payment_submitted_at: new Date().toISOString(),
      })
      .eq("id", pendingBid.id);
    if (updErr) {
      setBusy(false);
      toast.error(updErr.message);
      return;
    }
    // Notify all admins
    const { data: admins } = await supabase.from("admin_users").select("user_id");
    if (admins?.length) {
      const memberName = user.email ?? "Member";
      await supabase.from("notifications").insert(
        admins.map((a) => ({
          member_id: a.user_id,
          title: "💰 New EFT to verify",
          body: `${memberName} submitted ${fmtR(pendingBid.amount)} for ${open?.tier} (ref ${pendingBid.ref})`,
          kind: "payment",
          link: "/admin/circles",
        })),
      );
    }
    setBusy(false);
    ttTrack("CompletePayment", {
      value: pendingBid.amount,
      currency: "ZAR",
      content_type: "circle_contribution_eft",
      content_id: open.tier,
    });
    toast.success("Payment submitted — awaiting admin confirmation");
    closeModal();
    load();
  };

  const cancelBid = async () => {
    if (!pendingBid) { closeModal(); return; }
    setBusy(true);
    await supabase.from("circle_bids").delete().eq("id", pendingBid.id);
    setBusy(false);
    toast("Bid cancelled");
    closeModal();
    load();
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch { /* no-op */ }
  };

  const settingsReady = useMemo(
    () => !!(settings?.bank_name && settings?.account_number),
    [settings],
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

      <div className="sticky top-2 z-30 px-5 pt-4">
        <div className="mx-auto max-w-md space-y-3">
          <div className="flex justify-end">
            <TimezoneSelector compact />
          </div>
          <CircleStatusBanner />
        </div>
      </div>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Circle</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Save & bid<br />
            <span className="text-gradient-gold italic font-[450]">together.</span>
          </h1>
        </div>
      </section>

      {/* My bids */}
      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-xl">My bids</h2>
          {loading ? (
            <div className="mt-4 grid place-items-center rounded-3xl glass p-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : bids.length === 0 ? (
            <div className="mt-4 rounded-3xl glass p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No bids yet. Contribute to a circle below to begin your journey.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
              {bids.slice(0, 5).map((b) => {
                const status = b.status ?? "pending";
                const deadlineMs = b.payment_deadline ? new Date(b.payment_deadline).getTime() : null;
                const hoursLeft = deadlineMs ? (deadlineMs - now) / 3_600_000 : null;
                const awaiting = status === "pending" || status === "payment_pending";

                let badge: { text: string; cls: string } | null = null;
                if (status === "active" || status === "matched") badge = { text: "✅ Paid", cls: "bg-emerald-500/15 text-emerald-400" };
                else if (status === "expired") badge = { text: "⏰ Expired", cls: "bg-destructive/15 text-destructive" };
                else if (status === "rejected" || status === "cancelled" || status === "refunded") badge = { text: `🚫 ${status}`, cls: "bg-destructive/15 text-destructive" };
                else if (awaiting && hoursLeft !== null) {
                  if (hoursLeft <= 0) badge = { text: "⏰ Deadline passed", cls: "bg-destructive/15 text-destructive" };
                  else if (hoursLeft <= 6) badge = { text: `⚠️ ${Math.max(1, Math.floor(hoursLeft))}h left to pay`, cls: "bg-amber-500/15 text-amber-400" };
                  else badge = { text: `⏳ ${Math.floor(hoursLeft)}h to pay`, cls: "bg-primary/15 text-primary" };
                } else {
                  badge = { text: status, cls: "bg-secondary text-muted-foreground" };
                }

                return (
                  <li key={b.id} className="flex flex-col gap-2 p-4 animate-fade-in">
                    <div className="flex items-center gap-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                        <Flame className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium capitalize">{b.tier}</p>
                        <p className="truncate text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {b.created_at ? new Date(b.created_at).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <span className="text-sm font-display text-gradient-gold">{fmtR(Number(b.fiat_amount))}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pl-14">
                      {badge && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                          {badge.text}
                        </span>
                      )}
                      {awaiting && deadlineMs && hoursLeft !== null && hoursLeft > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          Pay by {new Date(deadlineMs).toLocaleString()}
                        </span>
                      )}
                      {b.payment_proof_url && (
                        <span className="text-[10px] text-emerald-400">✅ Proof uploaded</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Live activity ticker */}
      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          <LiveActivityTicker />
        </div>
      </section>

      {/* Referral promo */}
      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          <ReferralPromo />
        </div>
      </section>

      {/* Active circles */}
      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl">Active circles</h2>
            <span className="text-xs text-muted-foreground">{tiers.length} tiers</span>
          </div>

          {loading ? (
            <div className="mt-4 grid place-items-center rounded-3xl glass p-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : tiers.length === 0 ? (
            <div className="mt-4 rounded-3xl glass p-6 text-center">
              <p className="text-sm text-muted-foreground">No active circles right now. Check back soon.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {tiers.map((t, i) => {
                const s = stats[t.tier] ?? { pool: 0, members: 0, target: 1 };
                const myBids = bids.filter((b) => b.tier === t.tier);
                const myTotal = myBids.reduce((sum, b) => sum + Number(b.fiat_amount ?? 0), 0);
                const sess = sessionFor(t.tier);
                const sessionOpen = !sess || sess.status === "open";
                const sessionLabel = sess
                  ? sess.status === "open"
                    ? `🟢 Session open — closes in ${fmtCountdown(sess.target - now)}`
                    : `🔴 Session closed — opens in ${fmtCountdown(sess.target - now)}`
                  : null;

                return (
                  <CircleTierCard
                    key={t.tier}
                    tier={t}
                    pool={s.pool}
                    members={s.members}
                    target={s.target}
                    myTotal={myTotal}
                    sessionOpen={sessionOpen}
                    sessionLabel={sessionLabel}
                    delayMs={i * 60}
                    onBidMin={() => startBid(t, t.min_entry)}
                    onBidMax={() => startBid(t, t.max_entry)}
                    payoutsThisWeek={proof.payoutsThisWeekByTier[t.tier] ?? 0}
                    liveBidders={proof.liveBiddersByTier[t.tier] ?? 0}
                    activeInTier={s.members}
                    myStatus={queueStatus[t.tier] ?? null}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Bid + EFT modal */}
      <Dialog open={!!open} onOpenChange={(v) => { if (!v) closeModal(); }}>
        <DialogContent
          className={cn(
            "border border-border bg-gradient-card p-0 gap-0",
            // Mobile: bottom sheet
            "fixed left-0 right-0 bottom-0 top-auto w-full max-w-full translate-x-0 translate-y-0",
            "rounded-t-3xl rounded-b-none max-h-[90vh] flex flex-col",
            // Desktop: centered card
            "sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%]",
            "sm:rounded-3xl sm:max-w-md sm:max-h-[85vh]"
          )}
        >
          {step === "amount" ? (
            <>
              <div className="flex-1 overflow-y-auto p-6 pb-8 sm:pb-10 space-y-4">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl capitalize">{open?.tier} Circle</DialogTitle>
                  <DialogDescription>
                    Bid between {open && fmtR(open.min_entry)} and {open && fmtR(open.max_entry)}.
                    5% total fees (2% platform + 3% Ubuntu fund) apply to your gross payout.
                  </DialogDescription>
                </DialogHeader>
                {open && (proof.liveBiddersByTier[open.tier] ?? 0) > 0 && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-400 inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    🔥 LIVE: {proof.liveBiddersByTier[open.tier]} member{proof.liveBiddersByTier[open.tier] === 1 ? "" : "s"} bidding right now
                  </div>
                )}
                <div className="space-y-2 rounded-2xl border-2 border-accent/40 bg-accent/[0.04] p-4 sm:p-5 shadow-soft">
                  <Label htmlFor="bid-amount-input" className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-accent font-semibold">
                    <span>💰 Enter your bid amount</span>
                    <span className="text-[10px] text-muted-foreground normal-case tracking-normal">in Rands</span>
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl text-muted-foreground">R</span>
                    <Input
                      id="bid-amount-input"
                      type="number"
                      inputMode="numeric"
                      autoFocus
                      placeholder={open ? String(open.min_entry) : "0"}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-16 pl-10 rounded-2xl bg-background border-2 border-accent/50 text-2xl font-display font-semibold focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Min {open && fmtR(open.min_entry)} · Max {open && fmtR(open.max_entry)}
                  </p>
                  {open && Number(amount) > 0 && (() => {
                    const amt = Number(amount);
                    const grossRate = Number(open.growth_rate) || 0;
                    const gross = amt * (1 + grossRate);
                    const fees = gross * 0.05;
                    const net = gross - fees;
                    const profit = net - amt;
                    const netPct = amt > 0 ? (profit / amt) * 100 : 0;
                    return (
                      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-3 text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">You contribute</span><span>{fmtR(amt)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Gross payout (+{Math.round(grossRate * 100)}%)</span><span>{fmtR(gross)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Total fees (5%)</span><span>-{fmtR(fees)}</span></div>
                        <div className="flex justify-between border-t border-border pt-1 mt-1">
                          <span className="text-foreground">You receive</span>
                          <span className="font-display text-gradient-gold">{fmtR(net)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Net profit</span>
                          <span className="text-emerald-400">+{fmtR(profit)} (+{netPct.toFixed(1)}%)</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="sticky bottom-0 z-10 flex gap-3 border-t border-border bg-background/95 backdrop-blur p-4">
                <Button variant="ghost" onClick={closeModal} className="flex-1 min-h-12 rounded-2xl">Cancel</Button>
                <Button
                  onClick={confirmBid}
                  disabled={busy}
                  className="flex-1 min-h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Bid"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl">🎯 Pay to Community Pool</DialogTitle>
                  <DialogDescription>
                    This payment joins the <span className="capitalize font-medium text-foreground">{open?.tier}</span> Circle pool.
                    Payouts distributed based on priority scoring.
                  </DialogDescription>
                </DialogHeader>

                <PaymentMethodSelector value={method} onChange={setMethod} />

              {method === "eft" && !settingsReady ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-destructive">Bank details not configured</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      EFT instructions can't be shown until an admin saves the bank details.
                    </p>
                  </div>
                  {isAdmin && (
                    <Button asChild onClick={closeModal} className="w-full rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                      <Link to="/admin/settings">Configure bank details<ChevronRight className="h-4 w-4 ml-1" /></Link>
                    </Button>
                  )}
                </div>
              ) : method === "eft" ? (
                <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground pb-1">Your Payment Details</p>
                  {[
                    ["Bank", settings?.bank_name ?? ""],
                    ["Account Name", "UMOJA Community Pool"],
                    ["Account Number", settings?.account_number ?? ""],
                    ["Branch Code", settings?.branch_code ?? ""],
                    ["Reference", pendingBid?.ref ?? ""],
                    ["Amount", pendingBid ? fmtR(pendingBid.amount) : ""],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 py-1 border-b border-border/40 last:border-b-0">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-sm truncate">{value}</span>
                        {value && (
                          <button onClick={() => copy(label, String(value))} className="grid h-7 w-7 place-items-center rounded-lg bg-background/60 hover:bg-background text-muted-foreground hover:text-foreground transition-smooth" aria-label={`Copy ${label}`}>
                            {copied === label ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-primary/10 to-accent/10 p-4 text-sm space-y-2">
                <p className="font-medium text-accent inline-flex items-center gap-1">💡 How Your Payment is Split</p>
                <ul className="space-y-1 text-xs">
                  <li className="flex justify-between"><span>Community Pool</span><span className="font-display text-gradient-gold">95%</span></li>
                  <li className="flex justify-between"><span>Platform Fee</span><span className="font-mono text-muted-foreground">2%</span></li>
                  <li className="flex justify-between"><span>Ubuntu Fund</span><span className="font-mono text-muted-foreground">3%</span></li>
                </ul>
              </div>

              {method === "eft" && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proof of payment (required)</Label>
                  <label className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/30 p-3 cursor-pointer hover:bg-secondary/50 transition-smooth">
                    <Upload className="h-4 w-4 text-accent" />
                    <span className="text-sm truncate flex-1">{proofFile ? proofFile.name : "Tap to attach screenshot or PDF"}</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              )}
              </div>

              <div className="sticky bottom-0 z-10 flex gap-3 border-t border-border bg-background/95 backdrop-blur p-4">
                <Button
                  variant="outline"
                  onClick={cancelBid}
                  disabled={busy}
                  className="flex-1 min-h-12 rounded-2xl"
                >
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button
                  onClick={submitPayment}
                  disabled={busy || (method === "eft" && (!proofFile || !settingsReady))}
                  className="flex-1 min-h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : method === "paystack" ? "Pay with card" : "I've Made Payment"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <SparksDisclaimer />
        </div>
      </section>

      <CircleAcceptanceModal />
      <BottomNav />
    </main>
  );
};

export default Circle;
