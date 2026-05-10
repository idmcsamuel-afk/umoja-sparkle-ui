import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

interface Tier { id: string; name: string; pool_target: number; weekly_contribution: number; circle_size: number; status: string | null; }
interface Circle { id: string; name: string | null; tier_id: string | null; current_pool: number | null; target_pool: number; members_count: number | null; status: string | null; winner_id: string | null; }

export default function AdminDrive() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, c] = await Promise.all([
        supabase.from("drive_tiers").select("id, name, pool_target, weekly_contribution, circle_size, status").order("pool_target"),
        supabase.from("drive_circles").select("id, name, tier_id, current_pool, target_pool, members_count, status, winner_id").order("created_at", { ascending: false }),
      ]);
      setTiers((t.data ?? []) as Tier[]);
      setCircles((c.data ?? []) as Circle[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-3xl">Drive tiers</h1>
        {loading ? <div className="mt-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.id} className="rounded-3xl border border-border bg-gradient-card p-5">
                <p className="font-display text-xl">{t.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">Target {fmtR(t.pool_target)} · Weekly {fmtR(t.weekly_contribution)}</p>
                <p className="mt-2 text-xs">Circle size: {t.circle_size}</p>
                <span className="inline-block mt-3 text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-1">{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl">Active circles</h2>
        <div className="mt-4 rounded-3xl border border-border bg-gradient-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="text-left p-4">Circle</th>
                <th className="text-right p-4">Pool / Target</th>
                <th className="text-right p-4">Members</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Winner</th>
              </tr>
            </thead>
            <tbody>
              {circles.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="p-4">{c.name ?? "—"}</td>
                  <td className="p-4 text-right">{fmtR(Number(c.current_pool ?? 0))} / {fmtR(c.target_pool)}</td>
                  <td className="p-4 text-right">{c.members_count ?? 0}</td>
                  <td className="p-4 text-xs">{c.status}</td>
                  <td className="p-4 text-xs text-muted-foreground">{c.winner_id ? c.winner_id.slice(0, 8) : "—"}</td>
                </tr>
              ))}
              {circles.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">No circles yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
