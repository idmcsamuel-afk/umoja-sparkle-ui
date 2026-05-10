import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function AdminCircles() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<{
    tier: string; min_entry: number; max_entry: number; growth_rate: number;
    vault_days: number; is_active: boolean | null; pool: number; members: number;
  }>>([]);

  useEffect(() => {
    (async () => {
      const [t, b] = await Promise.all([
        supabase.from("circle_tiers").select("*").order("min_entry"),
        supabase.from("circle_bids").select("tier, net_amount, member_id, status").in("status", ["pending","active","matched"]),
      ]);
      const bids = (b.data ?? []) as { tier: string; net_amount: number; member_id: string }[];
      const tiers = (t.data ?? []) as Array<{ tier: string; min_entry: number; max_entry: number; growth_rate: number; vault_days: number; is_active: boolean | null }>;
      setRows(tiers.map((x) => {
        const tBids = bids.filter((q) => q.tier === x.tier);
        return {
          ...x,
          pool: tBids.reduce((s, q) => s + Number(q.net_amount ?? 0), 0),
          members: new Set(tBids.map((q) => q.member_id)).size,
        };
      }));
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl">Circles</h1>
      <p className="text-sm text-muted-foreground mt-1">All saving tiers and live pool stats.</p>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.tier} className="rounded-3xl border border-border bg-gradient-card p-5">
              <div className="flex items-center justify-between">
                <p className="font-display text-xl capitalize">{r.tier}</p>
                <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-1 ${r.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {r.is_active ? "Active" : "Locked"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{fmtR(r.min_entry)} – {fmtR(r.max_entry)} · {r.vault_days}d · +{Math.round(Number(r.growth_rate) * 100)}%</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Pool</p>
                  <p className="font-display text-lg text-gradient-gold">{fmtR(r.pool)}</p>
                </div>
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Members</p>
                  <p className="font-display text-lg">{r.members}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
