import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Wallet, Coins, Loader2 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface TrendRow {
  day: string;
  purchases: number;
  withdrawals: number;
  flip_house: number;
}

interface RevenueData {
  today: {
    spark_purchases_zar: number;
    withdrawals_zar: number;
    withdrawals_count: number;
    flip_house_sparks: number;
    new_signups: number;
    active_players: number;
  };
  totals: { total_members: number; churn_rate_pct: number };
  trend: TrendRow[];
}

const Z = (v?: number) => `R${Number(v ?? 0).toLocaleString("en-ZA", { maximumFractionDigits: 2 })}`;

export default function AdminRevenueDashboard() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.rpc("admin_revenue_dashboard", { _days: 30 });
      setData(d as unknown as RevenueData);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading revenue data…
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground">No data.</p>;

  const t = data.today;
  const sparkRate = 1.4;
  const flipHouseZar = (t.flip_house_sparks ?? 0) * sparkRate;
  const netToday = (t.spark_purchases_zar ?? 0) + flipHouseZar - (t.withdrawals_zar ?? 0);
  const monthlyProjection = netToday * 30;

  const tiles = [
    { label: "Spark purchases (24h)", value: Z(t.spark_purchases_zar), icon: Coins },
    { label: "Game house revenue", value: Z(flipHouseZar), icon: TrendingUp },
    { label: "Withdrawals (24h)", value: `${Z(t.withdrawals_zar)} · ${t.withdrawals_count}`, icon: Wallet },
    { label: "Net profit today", value: Z(netToday), icon: TrendingUp },
    { label: "Monthly projection", value: Z(monthlyProjection), icon: TrendingUp },
    { label: "New signups", value: String(t.new_signups), icon: Users },
    { label: "Active players (24h)", value: String(t.active_players), icon: Users },
    { label: "Churn rate", value: `${data.totals.churn_rate_pct}%`, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-emerald-400" /> Revenue Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          {data.totals.total_members.toLocaleString()} total members · live 24h metrics
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <p className="text-[10px] uppercase tracking-wider">{label}</p>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold mt-1">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">30-day revenue trend (ZAR)</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="purchases" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="withdrawals" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="flip_house" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
