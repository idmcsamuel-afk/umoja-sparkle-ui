import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Users, Sparkles, Percent, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Overview {
  total_referrals: number;
  total_signups: number;
  conversion_rate_pct: number;
  total_sparks_awarded: number;
}

interface Top { member_id: string; full_name: string; refs_this_month: number }
interface Leader { member_id: string; full_name: string; total_refs: number; sparks_earned: number }

export default function AdminReferrals() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [top, setTop] = useState<Top[]>([]);
  const [board, setBoard] = useState<Leader[]>([]);
  const [bonus, setBonus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: o }, { data: t }, { data: lb }] = await Promise.all([
      supabase.rpc("admin_referral_overview"),
      supabase.rpc("admin_top_referrers_month", { _limit: 10 }),
      supabase.rpc("referral_leaderboard", { _limit: 20 }),
    ]);
    setOv((o as any) ?? null);
    setTop((t as Top[]) ?? []);
    setBoard((lb as Leader[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const award = async (mid: string) => {
    const amt = Number(bonus[mid]);
    if (!amt || amt <= 0) { toast.error("Enter a positive Sparks amount"); return; }
    setBusy(mid);
    const { error } = await supabase.rpc("admin_award_referral_bonus", {
      _member: mid, _amount: amt, _note: "Top referrer bonus from admin",
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`+${amt} Sparks awarded`);
    setBonus((b) => ({ ...b, [mid]: "" }));
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Admin · Referrals</p>
        <h1 className="font-display text-3xl mt-1">Referral program</h1>
      </header>

      {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<Users className="h-4 w-4" />} label="Total referrals" value={ov?.total_referrals ?? 0} />
            <Stat icon={<Users className="h-4 w-4" />} label="Total signups" value={ov?.total_signups ?? 0} />
            <Stat icon={<Percent className="h-4 w-4" />} label="Conversion" value={`${ov?.conversion_rate_pct ?? 0}%`} />
            <Stat icon={<Sparkles className="h-4 w-4 text-accent" />} label="Sparks awarded" value={Math.round(ov?.total_sparks_awarded ?? 0)} />
          </div>

          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-accent" />
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top referrers this month</p>
            </div>
            {top.length === 0 ? <p className="text-sm text-muted-foreground">No referrals yet this month.</p> :
              <ul className="divide-y divide-border">
                {top.map((t, i) => (
                  <li key={t.member_id} className="py-2 flex items-center justify-between">
                    <span className="text-sm">{i + 1}. {t.full_name}</span>
                    <span className="text-xs text-muted-foreground">{t.refs_this_month} this month</span>
                  </li>
                ))}
              </ul>
            }
          </div>

          <div className="glass rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">All-time leaders · award bonus</p>
            <ul className="divide-y divide-border">
              {board.map((b, i) => (
                <li key={b.member_id} className="py-3 flex flex-wrap items-center gap-3">
                  <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 min-w-[140px] text-sm">{b.full_name}</span>
                  <span className="text-xs text-muted-foreground">{b.total_refs} refs · {Math.round(Number(b.sparks_earned))} ✨</span>
                  <Input
                    type="number" min={1} placeholder="Sparks"
                    value={bonus[b.member_id] ?? ""}
                    onChange={(e) => setBonus((s) => ({ ...s, [b.member_id]: e.target.value }))}
                    className="h-9 w-24 rounded-xl bg-secondary/60"
                  />
                  <Button size="sm" disabled={busy === b.member_id} onClick={() => award(b.member_id)}
                    className="rounded-xl bg-gradient-primary text-primary-foreground">
                    {busy === b.member_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Award"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 text-2xl font-display">{value}</div>
    </div>
  );
}
