import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Trophy, Copy, MessageCircle, Wallet, CreditCard, Building2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePaystack, buildReference } from "@/hooks/usePaystack";

const fmtR = (n: number) => "R" + Math.round(Number(n || 0)).toLocaleString("en-ZA");
const COOLDOWN_DAYS = 6;

interface Tier {
  id: string; tier_name: string; display_name: string;
  pool_target: number; cars_per_allocation: number;
  min_contribution_before: number; weekly_payment_after: number; payback_weeks: number;
}
interface Enrollment {
  id: string; tier_id: string; status: string; weekly_amount: number;
  total_contributed: number; weeks_contributed: number; weeks_paid_on_time: number;
  referrals_count: number; priority_score: number; enrolled_at: string;
}
interface LeaderRow { id: string; member_id: string; priority_score: number; total_contributed: number; weeks_contributed: number; }
interface Contribution { id: string; week_number: number; amount: number; payment_date: string; is_on_time: boolean; }

export default function DriveDashboard() {
  const { user, member } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [poolTotal, setPoolTotal] = useState(0);
  const [allEnrollments, setAllEnrollments] = useState<LeaderRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<"paystack" | "eft">("paystack");
  const [bank, setBank] = useState<{ bank_name: string; account_name: string; account_number: string; branch_code: string } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { pay: paystackPay, ready: paystackReady } = usePaystack();

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: enr } = await supabase
      .from("drive_enrollments")
      .select("*")
      .eq("member_id", user.id)
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!enr) { setLoading(false); return; }
    setEnrollment(enr as Enrollment);

    // refresh score
    await supabase.rpc("calculate_drive_score", { p_enrollment_id: (enr as any).id });
    const { data: enrFresh } = await supabase
      .from("drive_enrollments").select("*").eq("id", (enr as any).id).maybeSingle();
    if (enrFresh) setEnrollment(enrFresh as Enrollment);

    const [{ data: t }, { data: pool }, { data: lead }, { data: contribs }] = await Promise.all([
      supabase.from("drive_tiers").select("*").eq("id", (enr as any).tier_id).maybeSingle(),
      supabase.from("drive_tier_pool_v" as any).select("*").eq("tier_id", (enr as any).tier_id).maybeSingle(),
      supabase.from("drive_enrollments").select("id, member_id, priority_score, total_contributed, weeks_contributed")
        .eq("tier_id", (enr as any).tier_id)
        .eq("status", "active")
        .order("priority_score", { ascending: false })
        .limit(50),
      supabase.from("drive_contributions").select("*")
        .eq("enrollment_id", (enr as any).id).order("week_number", { ascending: false }).limit(20),
    ]);
    setTier(t as Tier);
    setPoolTotal(((pool as any)?.pool_total ?? 0) as number);
    setAllEnrollments((lead ?? []) as LeaderRow[]);
    setContributions((contribs ?? []) as Contribution[]);

    const memberIds = Array.from(new Set((lead ?? []).map((r: any) => r.member_id))).filter(Boolean);
    if (memberIds.length) {
      const { data: ms } = await supabase.from("members").select("id, full_name").in("id", memberIds);
      const nm: Record<string, string> = {};
      (ms ?? []).forEach((m: any) => { nm[m.id] = m.full_name ?? "Member"; });
      setMemberNames(nm);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const myRank = useMemo(() => {
    if (!enrollment) return 0;
    const idx = allEnrollments.findIndex((r) => r.id === enrollment.id);
    return idx >= 0 ? idx + 1 : 0;
  }, [allEnrollments, enrollment]);

  const breakdown = useMemo(() => {
    if (!enrollment || !tier) return null;
    const volume = Math.min((Number(enrollment.total_contributed) / Math.max(1, Number(tier.min_contribution_before))) * 30, 30);
    const consistency = enrollment.weeks_contributed > 0
      ? (enrollment.weeks_paid_on_time / enrollment.weeks_contributed) * 30
      : 0;
    const referrals = Math.min(enrollment.referrals_count * 3, 15);
    const maxWeeks = Math.max(1, ...allEnrollments.map((r) => r.weeks_contributed || 1));
    const myWeeks = (Date.now() - new Date(enrollment.enrolled_at).getTime()) / (7 * 86400 * 1000);
    const time = Math.min((myWeeks / maxWeeks) * 10, 10);
    return { volume, consistency, referrals, time };
  }, [enrollment, tier, allEnrollments]);

  // Cooldown: must be at least 6 days since last contribution
  const lastContribAt = contributions[0]?.payment_date ? new Date(contributions[0].payment_date).getTime() : 0;
  const daysSinceLast = lastContribAt ? (Date.now() - lastContribAt) / 86_400_000 : Infinity;
  const canPayNow = daysSinceLast >= COOLDOWN_DAYS;
  const daysUntilNext = canPayNow ? 0 : Math.ceil(COOLDOWN_DAYS - daysSinceLast);

  const openPayModal = async () => {
    if (!enrollment) return;
    if (!canPayNow) {
      toast.error(`Next payment available in ${daysUntilNext} day${daysUntilNext === 1 ? "" : "s"}`);
      return;
    }
    setMethod("paystack");
    setProofFile(null);
    setPayOpen(true);
    // Lazy-load bank details for EFT tab
    if (!bank) {
      const { data } = await supabase.rpc("get_active_bank_account", { _project: "drive" });
      const row = Array.isArray(data) ? data[0] : null;
      if (row) setBank(row as any);
    }
  };

  const handlePaystackPay = async () => {
    if (!user || !enrollment || !tier) return;
    if (!canPayNow) { toast.error("Cooldown active"); return; }
    if (!member?.email) { toast.error("Email required for card payment"); return; }
    setPaying(true);
    const ref = buildReference("DRIVE", enrollment.id, (member as any)?.referral_code ?? user.id.slice(0, 8));
    const result = await paystackPay({
      email: member.email,
      amountZar: Number(enrollment.weekly_amount),
      reference: ref,
      metadata: {
        payment_type: "drive_contribution",
        enrollment_id: enrollment.id,
        member_id: user.id,
        tier: tier.tier_name,
      },
    });
    setPaying(false);
    if (result.ok) {
      setPayOpen(false);
      await load();
    }
  };

  const handleEftSubmit = async () => {
    if (!user || !enrollment) return;
    if (!canPayNow) { toast.error("Cooldown active"); return; }
    if (!proofFile) { toast.error("Please upload your proof of payment"); return; }
    setPaying(true);
    const ref = `DRIVE-${enrollment.id.slice(0, 8)}-WK${enrollment.weeks_contributed + 1}-${Date.now()}`;
    const path = `${user.id}/${ref}-${proofFile.name}`.replace(/\s+/g, "_");
    const up = await supabase.storage.from("drive-payment-proofs").upload(path, proofFile, { upsert: false });
    if (up.error) { toast.error("Upload failed: " + up.error.message); setPaying(false); return; }
    const { error } = await supabase.rpc("submit_drive_eft_contribution", {
      _enrollment: enrollment.id,
      _amount: Number(enrollment.weekly_amount),
      _ref: ref,
      _proof_url: path,
    });
    setPaying(false);
    if (error) { toast.error(error.message); return; }
    toast.success("EFT proof submitted — awaiting admin review");
    setPayOpen(false);
    load();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!enrollment || !tier) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl">No Drive enrollment yet</h1>
        <p className="text-muted-foreground">Pick a tier to start building equity.</p>
        <Button onClick={() => navigate("/drive")}>View tiers</Button>
      </div>
    );
  }

  const score = Math.round(Number(enrollment.priority_score || 0));
  const pct = Math.min(100, Math.round((poolTotal / tier.pool_target) * 100));
  const refLink = `${window.location.origin}/drive?ref=${(member as any)?.referral_code ?? ""}`;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/drive" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All tiers
          </Link>
          <Logo />
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="rounded-3xl border border-border bg-gradient-card p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">You're enrolled in</p>
          <h1 className="mt-1 font-display text-3xl">{tier.display_name}</h1>
        </section>

        <section className="rounded-3xl border border-border bg-gradient-card p-6">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Priority score</p>
              <p className="font-display text-5xl">{score}<span className="text-2xl text-muted-foreground">/100</span></p>
              <p className="text-sm text-muted-foreground mt-1">Rank #{myRank} of {allEnrollments.length}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">Next allocation</p>
              <p>Top {tier.cars_per_allocation} get cars</p>
            </div>
          </div>

          {breakdown && (
            <div className="mt-5 space-y-2 text-sm">
              {[
                { label: "Contribution Volume", val: breakdown.volume, max: 30, hint: `${fmtR(enrollment.total_contributed)} / ${fmtR(tier.min_contribution_before)} min` },
                { label: "Payment Consistency", val: breakdown.consistency, max: 30, hint: `${enrollment.weeks_paid_on_time}/${enrollment.weeks_contributed} on time` },
                { label: "Referrals", val: breakdown.referrals, max: 15, hint: `${enrollment.referrals_count} refs (max 5)` },
                { label: "Time Waiting", val: breakdown.time, max: 10, hint: `Enrolled ${new Date(enrollment.enrolled_at).toLocaleDateString()}` },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs">
                    <span>{row.label} <span className="text-muted-foreground">— {row.hint}</span></span>
                    <span>{Math.round(row.val)}/{row.max}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(row.val / row.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-gradient-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg">Pool progress</p>
            <span className="text-xs text-muted-foreground">{fmtR(poolTotal)} / {fmtR(tier.pool_target)}</span>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {pct >= 100 ? `Allocation ready — top ${tier.cars_per_allocation} scorers get cars` : `${pct}% funded`}
          </p>
        </section>

        <section className="rounded-3xl border border-border bg-gradient-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-display text-lg">Weekly payment</p>
              <p className="text-sm text-muted-foreground">
                Week {enrollment.weeks_contributed + 1} · {fmtR(enrollment.weekly_amount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {contributions[0]
                  ? `Last payment: Week ${contributions[0].week_number} on ${new Date(contributions[0].payment_date).toLocaleDateString()}`
                  : "No payments yet"}
              </p>
            </div>
            {canPayNow ? (
              <Button onClick={openPayModal} className="w-full sm:w-auto"><Wallet className="h-4 w-4" /> Make Payment Now</Button>
            ) : (
              <div className="text-right">
                <Button disabled className="w-full sm:w-auto">Next payment in {daysUntilNext} day{daysUntilNext === 1 ? "" : "s"}</Button>
                <p className="mt-1 text-[11px] text-muted-foreground">Cooldown prevents duplicate payments</p>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {contributions.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            {contributions.slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <span>Week {c.week_number} · {new Date(c.payment_date).toLocaleDateString()} <span className="text-muted-foreground">· {c.payment_method ?? "eft"}</span></span>
                <span>
                  {fmtR(c.amount)}
                  {c.status === "pending" ? <span className="ml-1 text-amber-500">·pending</span> : (c.is_on_time ? " ✓" : " ·late")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-gradient-card p-5">
          <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /><p className="font-display text-lg">Leaderboard</p></div>
          <div className="mt-3 space-y-2 text-sm">
            {allEnrollments.slice(0, 10).map((row, i) => {
              const isMe = row.id === enrollment.id;
              const medal = ["🥇","🥈","🥉"][i] ?? `${i + 1}.`;
              return (
                <div key={row.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${isMe ? "bg-primary/10 border border-primary/40" : ""}`}>
                  <span>{medal} {isMe ? "YOU" : (memberNames[row.member_id] ?? "Member")}</span>
                  <span className="text-muted-foreground">{Math.round(row.priority_score)}pts · {fmtR(row.total_contributed)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-gradient-card p-5">
          <p className="font-display text-lg">Refer drivers · +4 pts each</p>
          <p className="mt-1 text-sm text-muted-foreground break-all">{refLink}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(refLink); toast.success("Link copied"); }}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button variant="secondary" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent("Join UMOJA Drive — own your car in 18 months: " + refLink)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
          </div>
        </section>
      </main>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drive Payment — Week {enrollment.weeks_contributed + 1}</DialogTitle>
            <DialogDescription>
              {tier.display_name} · Amount due: <strong>{fmtR(enrollment.weekly_amount)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod("paystack")}
                className={`rounded-xl border p-3 text-left text-sm transition ${method === "paystack" ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <div className="flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4" /> Card</div>
                <p className="text-xs text-muted-foreground mt-1">Paystack · Instant ✓</p>
              </button>
              <button
                type="button"
                onClick={() => setMethod("eft")}
                className={`rounded-xl border p-3 text-left text-sm transition ${method === "eft" ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <div className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" /> EFT</div>
                <p className="text-xs text-muted-foreground mt-1">Requires proof · Admin review</p>
              </button>
            </div>

            {method === "eft" && (
              <div className="space-y-3 text-sm">
                {bank ? (
                  <div className="rounded-xl border border-border p-3 space-y-1 text-xs">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bank details</p>
                    <p>Bank: <strong>{bank.bank_name}</strong></p>
                    <p>Account: <strong>{bank.account_number}</strong></p>
                    <p>Branch: <strong>{bank.branch_code}</strong></p>
                    <p className="pt-1">Reference: <strong>DRIVE-{enrollment.id.slice(0,8)}-WK{enrollment.weeks_contributed + 1}</strong></p>
                    <p className="text-muted-foreground">Use the exact reference above when transferring.</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading bank details…</p>
                )}
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  />
                  <Button variant="secondary" type="button" onClick={() => fileRef.current?.click()} className="w-full">
                    <Upload className="h-4 w-4" /> {proofFile ? proofFile.name : "Upload proof of payment"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button>
            {method === "paystack" ? (
              <Button onClick={handlePaystackPay} disabled={paying || !paystackReady}>
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Pay {fmtR(enrollment.weekly_amount)}
              </Button>
            ) : (
              <Button onClick={handleEftSubmit} disabled={paying || !proofFile}>
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Submit EFT proof
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
