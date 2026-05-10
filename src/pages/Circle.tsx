import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Users, Flame, Clock, ChevronRight, Lock } from "lucide-react";
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
import { CircleSessionTimer } from "@/components/umoja/CircleSessionTimer";
import { SparksDisclaimer } from "@/components/umoja/SparksDisclaimer";
import { CircleStatusBanner } from "@/components/umoja/CircleStatusBanner";
import { TimezoneSelector } from "@/components/umoja/TimezoneSelector";

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

interface TierStats {
  pool: number;
  members: number;
  target: number;
}

const fmtR = (n: number) =>
  "R" + Math.round(n).toLocaleString("en-ZA");

const Circle = () => {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [stats, setStats] = useState<Record<string, TierStats>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Tier | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tiersRes, bidsRes, allBidsRes] = await Promise.all([
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
        .in("status", ["pending", "active", "matched"]),
    ]);

    if (tiersRes.error) console.error(tiersRes.error);
    if (bidsRes.error) console.error(bidsRes.error);

    const t = (tiersRes.data ?? []) as Tier[];
    setTiers(t);
    setBids((bidsRes.data ?? []) as Bid[]);

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

  const contribute = async () => {
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

    const { error } = await supabase.from("circle_bids").insert({
      member_id: user.id,
      tier: open.tier,
      fiat_amount: amt,
      spark_amount: 0,
      platform_fee,
      ubuntu_fund_cut,
      net_amount,
      status: "pending",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Contributed ${fmtR(amt)} to ${open.tier}`);
    setOpen(null);
    setAmount("");
    load();
  };

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
        <div className="mx-auto max-w-md">
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
                        <div
                          className="h-full rounded-full bg-gradient-gold transition-all"
                          style={{ width: `${pct}%` }}
                        />
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

                    <div className="mt-5 flex gap-2">
                      <button
                        disabled={locked}
                        onClick={() => {
                          if (locked) return;
                          if (!hasAcceptedCircle()) { toast.info("Please accept the Circle terms first."); return; }
                          setOpen(t); setAmount(String(t.min_entry));
                        }}
                        className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {locked ? <><Lock className="h-4 w-4" /> Locked</> : <><Plus className="h-4 w-4" /> Enter {niceName}</>}
                      </button>
                      <button
                        disabled={locked}
                        onClick={() => {
                          if (locked) return;
                          if (!hasAcceptedCircle()) { toast.info("Please accept the Circle terms first."); return; }
                          setOpen(t); setAmount(String(t.max_entry));
                        }}
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

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl capitalize">{open?.tier}</DialogTitle>
            <DialogDescription>
              Contribute between {open && fmtR(open.min_entry)} and {open && fmtR(open.max_entry)}.
              A 2% platform fee and 3% Ubuntu fund cut apply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Amount (R)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 rounded-2xl bg-secondary/60 border-border"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
            <Button
              onClick={contribute}
              disabled={busy}
              className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
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
