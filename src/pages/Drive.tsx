import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Loader2, Lock, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Tier {
  id: string;
  tier_name: string;
  display_name: string;
  vehicle_description: string | null;
  retail_value: number;
  umoja_cost: number;
  pool_target: number;
  cars_per_allocation: number;
  min_contribution_before: number;
  weekly_payment_before_min: number;
  weekly_payment_before_max: number;
  weekly_payment_after: number;
  payback_weeks: number;
  requires_buyers_club_tier: string | null;
}

interface Pool { tier_id: string; pool_total: number; active_members: number; }

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function Drive() {
  const { user, member } = useAuth();
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [pools, setPools] = useState<Record<string, Pool>>({});
  const [enrollments, setEnrollments] = useState<Record<string, string>>({}); // tier_id -> enrollment_id
  const [loading, setLoading] = useState(true);
  const [enrollTier, setEnrollTier] = useState<Tier | null>(null);
  const [weeklyAmount, setWeeklyAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tiersRes, poolsRes, enrollRes] = await Promise.all([
      supabase.from("drive_tiers").select("*").eq("is_active", true).not("tier_name", "is", null).order("retail_value"),
      supabase.from("drive_tier_pool_v" as any).select("*"),
      user
        ? supabase.from("drive_enrollments").select("id, tier_id").eq("member_id", user.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setTiers((tiersRes.data ?? []) as Tier[]);
    const pmap: Record<string, Pool> = {};
    ((poolsRes.data ?? []) as unknown as Pool[]).forEach((p) => { pmap[p.tier_id] = p; });
    setPools(pmap);
    const emap: Record<string, string> = {};
    ((enrollRes.data ?? []) as { id: string; tier_id: string }[]).forEach((e) => { emap[e.tier_id] = e.id; });
    setEnrollments(emap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const openEnroll = (t: Tier) => {
    setEnrollTier(t);
    setWeeklyAmount(t.weekly_payment_before_min);
  };

  const confirmEnroll = async () => {
    if (!enrollTier || !user) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("drive_enrollments")
      .insert({
        member_id: user.id,
        tier_id: enrollTier.id,
        weekly_amount: weeklyAmount,
        status: "active",
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Enrolled in ${enrollTier.display_name}!`);
    setEnrollTier(null);
    // calculate first score
    if (data?.id) {
      await supabase.rpc("calculate_drive_score", { p_enrollment_id: data.id });
    }
    navigate("/drive/dashboard");
  };

  const buyersClubTier = (member as any)?.buyers_club_tier as string | null;
  const tierLocked = (t: Tier) => {
    if (!t.requires_buyers_club_tier) return false;
    const ranks = { bronze: 1, silver: 2, gold: 3 } as const;
    const need = ranks[t.requires_buyers_club_tier as keyof typeof ranks] ?? 0;
    const have = ranks[(buyersClubTier ?? "") as keyof typeof ranks] ?? 0;
    return have < need;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Logo />
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <section className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <Car className="h-3.5 w-3.5" /> UMOJA Drive
          </div>
          <h1 className="mt-4 font-display text-4xl md:text-5xl tracking-tight">Own Your Vehicle in 18 Months</h1>
          <p className="mt-3 text-muted-foreground">Stop renting. Start building equity. Same weekly payment.</p>
        </section>

        {loading ? (
          <div className="mt-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <section className="mt-10 grid gap-5 md:grid-cols-3">
            {tiers.map((t) => {
              const pool = pools[t.id];
              const poolTotal = pool?.pool_total ?? 0;
              const pct = Math.min(100, Math.round((poolTotal / t.pool_target) * 100));
              const ready = poolTotal >= t.pool_target;
              const enrolled = enrollments[t.id];
              const locked = tierLocked(t);
              const youSave = t.retail_value - (t.min_contribution_before + t.weekly_payment_after * t.payback_weeks);

              return (
                <article key={t.id} className="rounded-3xl border border-border bg-gradient-card p-5 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="inline-block text-[10px] uppercase tracking-[0.18em] rounded-full bg-secondary px-2 py-1">{t.tier_name}</span>
                    {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <h2 className="mt-3 font-display text-2xl">{t.display_name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.vehicle_description}</p>

                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Before you win</dt>
                      <dd>Weekly: {fmtR(t.weekly_payment_before_min)}–{fmtR(t.weekly_payment_before_max)}</dd>
                      <dd className="text-muted-foreground text-xs">Min total: {fmtR(t.min_contribution_before)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">After you win</dt>
                      <dd>{fmtR(t.weekly_payment_after)}/week × {t.payback_weeks} weeks</dd>
                      <dd className="text-muted-foreground text-xs">Total payback: {fmtR(t.weekly_payment_after * t.payback_weeks)}</dd>
                    </div>
                    <div className="pt-2 border-t border-border/60">
                      <dd className="text-xs text-muted-foreground">Retail {fmtR(t.retail_value)}</dd>
                      <dd className="font-display text-lg text-primary">You save {fmtR(youSave)}</dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Pool</span>
                      <span>{fmtR(poolTotal)} / {fmtR(t.pool_target)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {ready ? `Allocation ready — top ${t.cars_per_allocation} get cars` : `${pct}% funded`}
                    </p>
                  </div>

                  <div className="mt-5">
                    {locked ? (
                      <Button disabled className="w-full">Requires Buyers Club {t.requires_buyers_club_tier}</Button>
                    ) : enrolled ? (
                      <Button variant="secondary" className="w-full" onClick={() => navigate("/drive/dashboard")}>
                        <CheckCircle2 className="h-4 w-4" /> Enrolled — Open dashboard
                      </Button>
                    ) : (
                      <Button className="w-full" onClick={() => openEnroll(t)}>Join {t.display_name}</Button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      <Dialog open={!!enrollTier} onOpenChange={(o) => !o && setEnrollTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join {enrollTier?.display_name}</DialogTitle>
            <DialogDescription>You're about to enroll in the vehicle program.</DialogDescription>
          </DialogHeader>
          {enrollTier && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-border p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Commitment</p>
                <p>Weekly payment: {fmtR(enrollTier.weekly_payment_before_min)}–{fmtR(enrollTier.weekly_payment_before_max)}</p>
                <p>Minimum contributed: {fmtR(enrollTier.min_contribution_before)}</p>
                <p>If you win: {fmtR(enrollTier.weekly_payment_after)}/week for {enrollTier.payback_weeks} weeks</p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your weekly amount</p>
                  <p className="font-display text-lg">{fmtR(weeklyAmount)}</p>
                </div>
                <Slider
                  className="mt-3"
                  value={[weeklyAmount]}
                  min={enrollTier.weekly_payment_before_min}
                  max={enrollTier.weekly_payment_before_max}
                  step={50}
                  onValueChange={(v) => setWeeklyAmount(v[0])}
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{fmtR(enrollTier.weekly_payment_before_min)}</span>
                  <span>{fmtR(enrollTier.weekly_payment_before_max)}</span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Higher = funds the pool faster and boosts your priority score. You can increase later but not decrease.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnrollTier(null)}>Cancel</Button>
            <Button onClick={confirmEnroll} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Confirm Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
