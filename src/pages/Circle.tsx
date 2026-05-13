import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Users, Flame, Clock, ChevronRight, Lock, Upload, Copy, Check, X } from "lucide-react";
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
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [stats, setStats] = useState<Record<string, TierStats>>({});
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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
    const [tiersRes, bidsRes, allBidsRes, settingsRes] = await Promise.all([
      supabase.from("circle_tiers").select("*").order("min_entry"),
      user
        ? supabase
            .from("circle_bids")
            .select("id, tier, fiat_amount, net_amount, status, created_at, vault_end, payout_amount")
            .eq("member_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null } as const),
      supabase
        .from("circle_bids")
        .select("tier, net_amount, member_id, status")
        .in("status", ["pending", "payment_pending", "active", "matched"]),
      supabase.rpc("get_member_platform_settings"),
    ]);

    if (tiersRes.error) console.error(tiersRes.error);
    if (bidsRes.error) console.error(bidsRes.error);

    const t = (tiersRes.data ?? []) as Tier[];
    setTiers(t);
    setBids((bidsRes.data ?? []) as Bid[]);
    const settingsRow = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
    setSettings((settingsRow ?? null) as Settings | null);

    const grouped: Record<string, TierStats> = {};
    for (const tier of t) {
      grouped[tier.tier] = {
        pool: 0,
        members: 0,
        target: Number(tier.max_entry) * Number(tier.daily_velocity_cap || 1),
      };
    }
    const seen: Record<string, Set<string>> = {};
    for (const b of (allBidsRes.data ?? []) as { tier: string; net_amount: number; member_id: string }[]) {
      if (!grouped[b.tier]) continue;
      grouped[b.tier].pool += Number(b.net_amount || 0);
      seen[b.tier] = seen[b.tier] ?? new Set();
      seen[b.tier].add(b.member_id);
    }
    for (const k of Object.keys(grouped)) grouped[k].members = seen[k]?.size ?? 0;
    setStats(grouped);
    setLoading(false);
  };

  useEffect(() => {
    load();
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
      if (result.ok) load();
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
              {bids.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center gap-4 p-4 animate-fade-in">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium capitalize">{b.tier}</p>
                    <p className="truncate text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {b.status ?? "pending"} · {b.created_at ? new Date(b.created_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <span className="text-sm font-display text-gradient-gold">{fmtR(Number(b.fiat_amount))}</span>
                </li>
              ))}
            </ul>
          )}
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
                const pct = Math.min(100, Math.round((s.pool / Math.max(1, s.target)) * 100));
                const locked = !t.is_active;
                const myBids = bids.filter((b) => b.tier === t.tier);
                const myTotal = myBids.reduce((sum, b) => sum + Number(b.fiat_amount ?? 0), 0);
                const niceName = `${t.tier.charAt(0).toUpperCase() + t.tier.slice(1)} Circle`;
                const sess = sessionFor(t.tier);
                const sessionOpen = !sess || sess.status === "open";
                const disabled = locked || !sessionOpen;
                const sessionLabel = sess
                  ? sess.status === "open"
                    ? `🟢 Session open — closes in ${fmtCountdown(sess.target - now)}`
                    : `🔴 Session closed — opens in ${fmtCountdown(sess.target - now)}`
                  : null;

                return (
                  <article
                    key={t.tier}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className={`group relative overflow-hidden rounded-3xl glass p-5 animate-slide-up ${locked ? "opacity-80" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                          Vault {t.vault_days}d · +{Math.round(Number(t.growth_rate) * 100)}%
                        </p>
                        <p className="mt-1 font-display text-xl">{niceName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {fmtR(Number(t.min_entry))} – {fmtR(Number(t.max_entry))}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full px-2 py-1 ${locked ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>
                          {locked ? <><Lock className="h-3 w-3" /> Locked</> : "Active"}
                        </span>
                        <p className="font-display text-base text-gradient-gold">{fmtR(s.pool)}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {s.members} member{s.members === 1 ? "" : "s"}
                        </span>
                        <span>{pct}% of {fmtR(s.target)}</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="mt-4">
                      <CircleSessionTimer tier={t.tier} />
                    </div>
                    {myTotal > 0 && (
                      <div className="mt-3 flex items-center justify-end text-xs">
                        <span className="inline-flex items-center gap-1 text-accent-soft">
                          <Flame className="h-3 w-3" /> Your stake {fmtR(myTotal)}
                        </span>
                      </div>
                    )}

                    {sessionLabel && !locked && (
                      <p className={`mt-3 text-[11px] text-center font-medium ${sessionOpen ? "text-primary" : "text-destructive"}`}>
                        {sessionLabel}
                      </p>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        disabled={disabled}
                        onClick={() => startBid(t, t.min_entry)}
                        className={`flex-1 h-11 rounded-2xl text-sm font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                          disabled
                            ? "bg-secondary text-muted-foreground border border-border"
                            : "bg-gradient-primary text-primary-foreground shadow-glow"
                        }`}
                      >
                        {locked ? (
                          <><Lock className="h-4 w-4" /> Locked</>
                        ) : !sessionOpen ? (
                          <><Lock className="h-4 w-4" /> Session closed</>
                        ) : (
                          <><Plus className="h-4 w-4" /> Enter {niceName}</>
                        )}
                      </button>
                      <button
                        disabled={disabled}
                        onClick={() => startBid(t, t.max_entry)}
                        className="h-11 px-5 rounded-2xl border border-border text-sm font-medium hover:bg-secondary transition-smooth inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Bid <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </article>
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
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl capitalize">{open?.tier} Circle</DialogTitle>
                  <DialogDescription>
                    Bid between {open && fmtR(open.min_entry)} and {open && fmtR(open.max_entry)}.
                    A 2% platform fee and 3% Ubuntu fund cut apply.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bid amount (R)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 rounded-2xl bg-secondary/60 border-border text-lg"
                  />
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
