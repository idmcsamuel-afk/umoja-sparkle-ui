import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Car, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const fmtR = (n: number) => "R" + Math.round(Number(n || 0)).toLocaleString("en-ZA");

interface Tier {
  id: string; tier_name: string; display_name: string;
  pool_target: number; cars_per_allocation: number; umoja_cost: number;
}
interface Pool { tier_id: string; pool_total: number; active_members: number; }
interface PreviewWinner { id: string; member_id: string; priority_score: number; total_contributed: number; full_name?: string; phone?: string; }

export default function AdminDrive() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [pools, setPools] = useState<Record<string, Pool>>({});
  const [loading, setLoading] = useState(true);
  const [previewTier, setPreviewTier] = useState<Tier | null>(null);
  const [previewWinners, setPreviewWinners] = useState<PreviewWinner[]>([]);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [t, p] = await Promise.all([
      supabase.from("drive_tiers").select("*").eq("is_active", true).not("tier_name", "is", null).order("retail_value"),
      supabase.from("drive_tier_pool_v" as any).select("*"),
    ]);
    setTiers((t.data ?? []) as Tier[]);
    const pmap: Record<string, Pool> = {};
    ((p.data ?? []) as Pool[]).forEach((x) => { pmap[x.tier_id] = x; });
    setPools(pmap);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openPreview = async (tier: Tier) => {
    setPreviewTier(tier);
    setPreviewWinners([]);
    // recalculate scores then load top N
    const { data: enrolls } = await supabase
      .from("drive_enrollments").select("id").eq("tier_id", tier.id).eq("status", "active");
    await Promise.all((enrolls ?? []).map((e: any) =>
      supabase.rpc("calculate_drive_score", { p_enrollment_id: e.id })
    ));
    const { data: top } = await supabase
      .from("drive_enrollments")
      .select("id, member_id, priority_score, total_contributed")
      .eq("tier_id", tier.id).eq("status", "active")
      .order("priority_score", { ascending: false })
      .limit(tier.cars_per_allocation);
    const ids = (top ?? []).map((r: any) => r.member_id);
    let names: Record<string, { full_name: string; phone: string }> = {};
    if (ids.length) {
      const { data: ms } = await supabase.from("members").select("id, full_name, phone").in("id", ids);
      (ms ?? []).forEach((m: any) => { names[m.id] = { full_name: m.full_name, phone: m.phone }; });
    }
    setPreviewWinners(((top ?? []) as any[]).map((r) => ({
      ...r, full_name: names[r.member_id]?.full_name, phone: names[r.member_id]?.phone,
    })));
  };

  const confirm = async () => {
    if (!previewTier) return;
    setRunning(true);
    const { data, error } = await supabase.rpc("run_drive_allocation", { p_tier_id: previewTier.id });
    setRunning(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Allocated ${(data as any)?.cars ?? 0} cars`);
    setPreviewTier(null);
    load();
  };

  if (loading) return <div className="mt-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Drive — allocations</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((t) => {
          const pool = pools[t.id];
          const poolTotal = pool?.pool_total ?? 0;
          const pct = Math.round((poolTotal / t.pool_target) * 100);
          const ready = poolTotal >= t.pool_target;
          return (
            <div key={t.id} className="rounded-3xl border border-border bg-gradient-card p-5">
              <div className="flex items-center gap-2"><Car className="h-4 w-4 text-primary" /><p className="font-display text-xl">{t.display_name}</p></div>
              <p className="mt-2 text-xs text-muted-foreground">Pool target {fmtR(t.pool_target)} · {t.cars_per_allocation} cars/round</p>
              <p className="mt-3 font-display text-lg">{fmtR(poolTotal)} <span className="text-sm text-muted-foreground">({pct}%)</span></p>
              <p className="text-xs text-muted-foreground">{pool?.active_members ?? 0} active members</p>
              <div className="mt-4">
                <Button className="w-full" disabled={!ready} onClick={() => openPreview(t)}>
                  <Trophy className="h-4 w-4" /> {ready ? "Run allocation" : "Pool not ready"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!previewTier} onOpenChange={(o) => !o && setPreviewTier(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Allocation preview · {previewTier?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm max-h-80 overflow-y-auto">
            {previewWinners.length === 0 && <p className="text-muted-foreground">No eligible members.</p>}
            {previewWinners.map((w, i) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p>{i + 1}. {w.full_name ?? "Member"}</p>
                  <p className="text-xs text-muted-foreground">{w.phone ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p>{Math.round(w.priority_score)}pts</p>
                  <p className="text-xs text-muted-foreground">{fmtR(w.total_contributed)}</p>
                </div>
              </div>
            ))}
          </div>
          {previewTier && (
            <p className="text-xs text-muted-foreground">
              Pool will be reduced by approximately {fmtR(previewWinners.length * previewTier.umoja_cost)}.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewTier(null)}>Cancel</Button>
            <Button onClick={confirm} disabled={running || previewWinners.length === 0}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Confirm allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
