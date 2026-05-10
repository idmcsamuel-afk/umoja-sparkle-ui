import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Coins, Activity, TrendingUp } from "lucide-react";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    members: 0, totalPool: 0, activeCircles: 0, revenueToday: 0, todayBids: 0,
  });

  useEffect(() => {
    (async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [m, b, c, today] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("circle_bids").select("net_amount, platform_fee, ubuntu_fund_cut, created_at, status").in("status", ["pending","active","matched"]),
        supabase.from("circle_tiers").select("tier", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("circle_bids").select("platform_fee, created_at").gte("created_at", startOfDay.toISOString()),
      ]);
      const bids = b.data ?? [];
      const todayRows = today.data ?? [];
      setStats({
        members: m.count ?? 0,
        totalPool: bids.reduce((s, x) => s + Number(x.net_amount ?? 0), 0),
        activeCircles: c.count ?? 0,
        revenueToday: todayRows.reduce((s, x) => s + Number(x.platform_fee ?? 0), 0),
        todayBids: todayRows.length,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Members", value: stats.members.toLocaleString(), icon: Users },
    { label: "Total pool", value: fmtR(stats.totalPool), icon: Coins },
    { label: "Active circles", value: stats.activeCircles, icon: Activity },
    { label: "Revenue today", value: fmtR(stats.revenueToday), icon: TrendingUp, sub: `${stats.todayBids} bids` },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl">Overview</h1>
      <p className="text-sm text-muted-foreground mt-1">Live metrics across the UMOJA network.</p>

      {loading ? (
        <div className="mt-8 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, sub }) => (
            <div key={label} className="rounded-3xl border border-border bg-gradient-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 font-display text-3xl text-gradient-gold">{value}</p>
              {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
