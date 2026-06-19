import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyCountry, fmtMoney } from "@/hooks/useCountryConfig";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Package, ArrowRight } from "lucide-react";
import { usePaystack, buildReference } from "@/hooks/usePaystack";

interface Opportunity {
  id: number;
  product_name: string;
  supplier_name: string;
  supplier_country: string;
  moq_required: number;
  current_reserved: number;
  unit_cost_zar: number;
  suggested_selling_price_zar: number;
  expected_margin_percentage: number;
  expected_order_date: string;
  expected_arrival_date: string;
  product_image_url: string;
}

export default function SparkTradeProductOpportunities() {
  const { user } = useAuth();
  const { config } = useMyCountry();
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [capital, setCapital] = useState(0);
  const [sortBy, setSortBy] = useState("margin");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [units, setUnits] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("spark_trade_opportunities" as any)
      .select("*")
      .eq("is_approved_for_ai_recommendation", true);
    setOpportunities(((data as any[]) ?? []) as Opportunity[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (user) {
      supabase.from("members").select("spark_trade_capital").eq("id", user.id).maybeSingle()
        .then(({ data }) => setCapital(Number((data as any)?.spark_trade_capital ?? 0)));
    }
  }, [user]);

  const sorted = useMemo(() => {
    const s = search.toLowerCase();
    const filtered = opportunities.filter(o => !s || o.product_name.toLowerCase().includes(s));
    return [...filtered].sort((a, b) => {
      if (sortBy === "margin") return b.expected_margin_percentage - a.expected_margin_percentage;
      if (sortBy === "moq") return a.moq_required - b.moq_required;
      if (sortBy === "date") return new Date(a.expected_arrival_date).getTime() - new Date(b.expected_arrival_date).getTime();
      return 0;
    });
  }, [opportunities, sortBy, search]);

  const totalCost = selected ? units * Number(selected.unit_cost_zar) : 0;
  const insufficient = capital > 0 && totalCost > capital;

  const handleReserve = async () => {
    if (!selected || !user || units < 1) return;
    setSubmitting(true);
    const { error } = await supabase.from("spark_trade_inventory_reservations" as any).insert({
      member_id: user.id,
      opportunity_id: selected.id,
      units_reserved: units,
      total_capital_allocated: totalCost,
      reservation_status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not reserve", { description: error.message });
      return;
    }
    toast.success(`Reserved ${units} units of ${selected.product_name}`);
    setSelected(null);
    setUnits(0);
    load();
  };

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Step 7 of 10</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">Product Opportunities</h1>
        <p className="mt-2 text-muted-foreground">Browse and reserve inventory for your business.</p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="margin">Highest Margin</SelectItem>
              <SelectItem value="moq">Lowest MOQ</SelectItem>
              <SelectItem value="date">Soonest Arrival</SelectItem>
            </SelectContent>
          </Select>
          {capital > 0 && (
            <Badge variant="secondary" className="self-start sm:self-center">Capital: {fmtMoney(capital, config)}</Badge>
          )}
        </div>

        {sorted.length === 0 ? (
          <Card className="mt-10 p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No opportunities available yet. Check back soon.</p>
          </Card>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sorted.map((o) => (
              <Card key={o.id} className="overflow-hidden flex flex-col">
                {o.product_image_url ? (
                  <img src={o.product_image_url} alt={o.product_name} className="w-full h-44 object-cover" />
                ) : (
                  <div className="w-full h-44 bg-muted grid place-items-center"><Package className="h-10 w-10 text-muted-foreground" /></div>
                )}
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <h3 className="font-semibold">{o.product_name}</h3>
                  <p className="text-xs text-muted-foreground">{o.supplier_name} • {o.supplier_country}</p>
                  <div className="text-sm space-y-1 mt-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">MOQ</span><span className="font-medium">{o.moq_required.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Unit cost</span><span className="font-medium">{fmtMoney(Number(o.unit_cost_zar), config)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Sell price</span><span className="font-semibold">{fmtMoney(Number(o.suggested_selling_price_zar), config)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Margin</span><span className="font-semibold text-green-600">{o.expected_margin_percentage}%</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Order {new Date(o.expected_order_date).toLocaleDateString()} • Arrive {new Date(o.expected_arrival_date).toLocaleDateString()}
                  </p>
                  <Button className="mt-3" onClick={() => { setSelected(o); setUnits(0); }}>Reserve Units</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-end">
          <Button size="lg" variant="outline" onClick={() => navigate("/spark-trade/dashboard")}>
            Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reserve {selected?.product_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">How many units? (max {selected.moq_required.toLocaleString()})</label>
                <Input type="number" min={1} max={selected.moq_required} value={units || ""} onChange={(e) => setUnits(Math.max(0, parseInt(e.target.value) || 0))} />
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Unit cost</span><span>{fmtMoney(Number(selected.unit_cost_zar), config)}</span></div>
                <div className="flex justify-between font-semibold"><span>Total cost</span><span>{fmtMoney(totalCost, config)}</span></div>
                {capital > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Your capital</span><span>{fmtMoney(capital, config)}</span></div>}
                {insufficient && <p className="text-xs text-destructive">Insufficient capital for this reservation</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleReserve} disabled={submitting || units < 1 || insufficient}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Reserve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
