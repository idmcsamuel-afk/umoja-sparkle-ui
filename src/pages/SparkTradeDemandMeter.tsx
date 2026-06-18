import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Package, TrendingUp } from "lucide-react";

interface DemandRow {
  id: number;
  product_name: string;
  moq_required: number;
  total_reserved: number;
  units_remaining: number;
  fill_percentage: number;
  expected_order_date: string;
  product_image_url: string | null;
  members_interested: number;
}

function fillColor(pct: number) {
  if (pct >= 90) return "bg-green-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-blue-500";
}

function fillLabel(pct: number) {
  if (pct >= 90) return { label: "Urgent", variant: "default" as const };
  if (pct >= 50) return { label: "Momentum", variant: "secondary" as const };
  return { label: "Early bird", variant: "outline" as const };
}

export default function SparkTradeDemandMeter() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("community_demand_meter" as any)
        .select("*")
        .order("fill_percentage", { ascending: false });
      setRows(((data as any[]) ?? []) as DemandRow[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-7 w-7 text-primary" />
          <h1 className="font-display text-3xl md:text-4xl">Community Demand Meter</h1>
        </div>
        <p className="mt-2 text-muted-foreground">See what the community is reserving — products closest to MOQ ship first.</p>

        {rows.length === 0 ? (
          <Card className="mt-10 p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No active demand yet.</p>
          </Card>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rows.map((r) => {
              const pct = Math.min(100, Number(r.fill_percentage) || 0);
              const status = fillLabel(pct);
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex gap-3">
                    {r.product_image_url ? (
                      <img src={r.product_image_url} alt={r.product_name} className="h-16 w-16 object-cover rounded-lg" />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-muted grid place-items-center"><Package className="h-6 w-6 text-muted-foreground" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{r.product_name}</h3>
                      <Badge variant={status.variant} className="mt-1">{status.label}</Badge>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{pct}% filled</span>
                      <span className="text-muted-foreground">{Number(r.total_reserved).toLocaleString()} / {r.moq_required.toLocaleString()}</span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${fillColor(pct)} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground"><Users className="h-4 w-4" /> {r.members_interested} interested</span>
                    {r.expected_order_date && (
                      <span className="text-xs text-muted-foreground">Order {new Date(r.expected_order_date).toLocaleDateString()}</span>
                    )}
                  </div>

                  <Button size="sm" className="w-full mt-4" onClick={() => navigate("/spark-trade/onboarding/product-opportunities")}>
                    Join the Demand
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
