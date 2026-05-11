import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Zap, SkipForward, RotateCcw, CheckCheck, History, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const TIERS = ["seed", "growth", "harvest"] as const;
type TierKey = typeof TIERS[number];

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

interface AllocationRow {
  id: string;
  tier: string;
  session_at: string;
  pool_total: number;
  winners_count: number;
  payout_per_winner: number;
  created_at: string;
}

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");
const fmt = (n: number, d = 1) => Number(n ?? 0).toFixed(d);

export default function AdminAllocations() {
  const [tier, setTier] = useState<TierKey>("seed");
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Record<TierKey, number>>({ seed: 2, growth: 1, harvest: 1 });
  const [history, setHistory] = useState<AllocationRow[]>([]);
  const [overrideOpen, setOverrideOpen] = useState<{ bid: ScoreRow; type: "boost" | "skip" } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideValue, setOverrideValue] = useState("20");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [scoresRes, settingsRes, histRes] = await Promise.all([
      supabase.rpc("compute_session_scores", { _tier: tier }),
      supabase.from("platform_settings").select("payouts_seed, payouts_growth, payouts_harvest").limit(1).maybeSingle(),
      supabase.from("circle_allocations").select("id, tier, session_at, pool_total, winners_count, payout_per_winner, created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    if (scoresRes.error) console.error(scoresRes.error);
    setRows((scoresRes.data ?? []) as ScoreRow[]);
    if (settingsRes.data) {
      setPayouts({
        seed: settingsRes.data.payouts_seed ?? 2,
        growth: settingsRes.data.payouts_growth ?? 1,
        harvest: settingsRes.data.payouts_harvest ?? 1,
      });
    }
    setHistory((histRes.data ?? []) as AllocationRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tier]);

  const eligible = useMemo(() => rows.filter((r) => r.eligible), [rows]);
  const winners = useMemo(() => eligible.slice(0, payouts[tier]), [eligible, payouts, tier]);
  const poolTotal = useMemo(() => winners.reduce((s, w) => s + Number(w.fiat_amount ?? 0), 0), [winners]);
  const perWinner = winners.length ? Math.round((poolTotal / winners.length) * 100) / 100 : 0;

  const submitOverride = async () => {
    if (!overrideOpen) return;
    const { bid, type } = overrideOpen;
    const val = type === "boost" ? Number(overrideValue) : 0;
    if (type === "boost" && (!Number.isFinite(val) || val <= 0)) {
      toast.error("Boost must be a positive number"); return;
    }
    if (!overrideReason.trim()) { toast.error("Reason required"); return; }
    const { error } = await supabase.from("circle_allocation_overrides").insert({
      bid_id: bid.bid_id,
      tier,
      override_type: type,
      boost_value: val,
      reason: overrideReason.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(type === "boost" ? `Boost +${val} applied` : "Member skipped this session");
    setOverrideOpen(null);
    setOverrideReason("");
    setOverrideValue("20");
    load();
  };

  const clearOverride = async (bid: ScoreRow) => {
    const { error } = await supabase
      .from("circle_allocation_overrides")
      .delete()
      .eq("bid_id", bid.bid_id)
      .eq("consumed", false);
    if (error) { toast.error(error.message); return; }
    toast("Override cleared");
    load();
  };

  const confirmAllocation = async () => {
    if (winners.length === 0) { toast.error("No eligible winners"); return; }
    setBusy(true);
    const breakdown: Record<string, unknown> = { tier, generated_at: new Date().toISOString(), leaderboard: rows };
    winners.forEach((w) => { breakdown[w.bid_id] = w.breakdown; });
    const { error } = await supabase.rpc("apply_allocation", {
      _tier: tier,
      _winner_bid_ids: winners.map((w) => w.bid_id),
      _pool_total: poolTotal,
      _breakdown: breakdown as never,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Allocated ${winners.length} payout${winners.length === 1 ? "" : "s"}`);
    setPreviewOpen(false);
    load();
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl">Allocations</h1>
          <p className="text-sm text-muted-foreground mt-1">Compute the priority queue and award payouts when a session closes.</p>
        </div>
      </div>

      <div className="mt-6 inline-flex rounded-2xl border border-border bg-secondary/30 p-1">
        {TIERS.map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`px-4 py-2 rounded-xl text-sm capitalize transition-smooth ${tier === t ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 grid sm:grid-cols-4 gap-3">
        <div className="rounded-3xl border border-border bg-gradient-card p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Eligible</p>
          <p className="font-display text-2xl">{eligible.length}</p>
        </div>
        <div className="rounded-3xl border border-border bg-gradient-card p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Payouts this session</p>
          <p className="font-display text-2xl">{payouts[tier]}</p>
        </div>
        <div className="rounded-3xl border border-border bg-gradient-card p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Pool total</p>
          <p className="font-display text-2xl text-gradient-gold">{fmtR(poolTotal)}</p>
        </div>
        <div className="rounded-3xl border border-border bg-gradient-card p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Per winner</p>
          <p className="font-display text-2xl text-gradient-gold">{fmtR(perWinner)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={load} variant="outline" className="rounded-2xl">
          <RotateCcw className="h-4 w-4 mr-1" /> Recompute
        </Button>
        <Button
          onClick={() => setPreviewOpen(true)}
          disabled={loading || winners.length === 0}
          className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <CheckCheck className="h-4 w-4 mr-1" /> Auto-Allocate ({winners.length})
        </Button>
      </div>

      <h2 className="mt-8 font-display text-xl">Leaderboard (top 20)</h2>
      {loading ? (
        <div className="mt-6 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-border bg-gradient-card p-10 text-center text-sm text-muted-foreground">
          No active bids in this tier.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-3xl border border-border bg-gradient-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-3">#</th>
                <th className="p-3">Member</th>
                <th className="p-3 text-right">Score</th>
                <th className="p-3 text-right">Bid</th>
                <th className="p-3 text-right">Cons.</th>
                <th className="p-3 text-right">Days</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r, i) => {
                const willWin = r.eligible && i < payouts[tier] && winners.some((w) => w.bid_id === r.bid_id);
                return (
                  <tr key={r.bid_id} className={`border-b border-border/40 last:border-b-0 ${willWin ? "bg-primary/5" : ""}`}>
                    <td className="p-3 font-mono">{i + 1}</td>
                    <td className="p-3">
                      <p className="font-medium truncate max-w-[12rem]">{r.full_name}</p>
                      {r.override_type && (
                        <p className={`text-[10px] uppercase ${r.override_type === "boost" ? "text-primary" : "text-destructive"}`}>
                          {r.override_type}{r.override_type === "boost" ? ` +${r.override_value}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right font-display">{fmt(r.priority_score)}</td>
                    <td className="p-3 text-right">{fmtR(Number(r.fiat_amount))}</td>
                    <td className="p-3 text-right">{fmt(r.consistency_pct, 0)}%</td>
                    <td className="p-3 text-right">{r.days_waiting}</td>
                    <td className="p-3">
                      {willWin ? (
                        <span className="text-[10px] uppercase tracking-wider text-primary">Winner</span>
                      ) : r.eligible ? (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Queued</span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-destructive">Disqualified</span>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {r.override_type ? (
                        <Button size="sm" variant="ghost" onClick={() => clearOverride(r)}>Clear</Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => { setOverrideOpen({ bid: r, type: "boost" }); setOverrideValue("20"); setOverrideReason(""); }}>
                            <Zap className="h-3 w-3 mr-1" /> Boost
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setOverrideOpen({ bid: r, type: "skip" }); setOverrideReason(""); }}>
                            <SkipForward className="h-3 w-3 mr-1" /> Skip
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 font-display text-xl flex items-center gap-2"><History className="h-4 w-4" /> Allocation history</h2>
      {history.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-border bg-gradient-card p-6 text-center text-sm text-muted-foreground">
          No past allocations yet.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {history.map((h) => (
            <div key={h.id} className="rounded-3xl border border-border bg-gradient-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-accent capitalize">{h.tier}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(h.created_at).toLocaleString()}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-[10px] text-muted-foreground">Pool</p><p className="font-display text-base text-gradient-gold">{fmtR(Number(h.pool_total))}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Winners</p><p className="font-display text-base">{h.winners_count}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Each</p><p className="font-display text-base">{fmtR(Number(h.payout_per_winner))}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Override dialog */}
      <Dialog open={!!overrideOpen} onOpenChange={(v) => !v && setOverrideOpen(null)}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl capitalize">{overrideOpen?.type} {overrideOpen?.bid.full_name}</DialogTitle>
            <DialogDescription>
              {overrideOpen?.type === "boost"
                ? "Add an emergency boost to this member's priority score for this session."
                : "Skip this member for this session. Their bid stays active and re-enters next session."}
            </DialogDescription>
          </DialogHeader>
          {overrideOpen?.type === "boost" && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Boost points</Label>
              <Input
                type="number"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                className="h-11 rounded-2xl bg-secondary/40 border-border"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reason (required)</Label>
            <Textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Audit note for this override"
              className="rounded-2xl bg-secondary/40 border-border min-h-[90px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOverrideOpen(null)}>Cancel</Button>
            <Button onClick={submitOverride} className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm allocation preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Confirm allocation</DialogTitle>
            <DialogDescription>
              {winners.length} winner{winners.length === 1 ? "" : "s"} · {fmtR(perWinner)} each from a {fmtR(poolTotal)} pool. This action is final.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {winners.map((w, i) => (
              <li key={w.bid_id} className="flex items-center justify-between rounded-2xl bg-secondary/40 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">#{i + 1} · {w.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">Score {fmt(w.priority_score)} · Bid {fmtR(Number(w.fiat_amount))}</p>
                </div>
                <p className="font-display text-sm text-gradient-gold">{fmtR(perWinner)}</p>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={confirmAllocation} disabled={busy} className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
