import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, X, RefreshCw, Zap, Clock, Globe2, Plus, Calculator, Download, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SparkTradeCostCalculator, type CostBreakdown } from "@/components/umoja/SparkTradeCostCalculator";

interface Row {
  id: string;
  asin: string;
  product_name: string | null;
  category: string | null;
  moq: number | null;
  target_slots: number | null;
  joined_count: number | null;
  status: string | null;
  data_source: string | null;
  sale_price: number | null;
  cost_price: number | null;
  estimated_monthly_sales: number | null;
  is_demo: boolean | null;
  cost_breakdown: CostBreakdown | null;
  cost_updated_at: string | null;
}

interface Opportunity {
  title: string;
  category: string;
  markets: string[];
  flags: string[];
  takealot_count: number;
  estimated_margin_zar: number;
  sale_price_zar: number;
  cost_price_zar: number;
  thumbnail?: string;
}

export default function AdminSparkTrade() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [scouting, setScouting] = useState(false);
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("spark_trade_shortlist")
      .select("id, asin, product_name, category, moq, target_slots, joined_count, status, data_source, sale_price, cost_price, estimated_monthly_sales, is_demo")
      .order("added_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateRow = async (id: string, patch: Partial<Row>) => {
    const { error } = await supabase.from("spark_trade_shortlist").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const fetchMakro = async () => {
    setFetching(true);
    const { data, error } = await supabase.functions.invoke("makro-fetch");
    setFetching(false);
    if (error) return toast.error(error.message);
    const count = (data as any)?.inserted ?? (data as any)?.products?.length ?? 0;
    toast.success(`Synced ${count} Makro products`);
    load();
  };

  const findBuySoon = async () => {
    setScouting(true);
    const { data, error } = await supabase.functions.invoke("serpapi-trending");
    setScouting(false);
    if (error) return toast.error(error.message);
    const list = (data as any)?.opportunities ?? [];
    setOpps(list);
    if (!list.length) toast.message("No opportunities found this run.");
  };

  const addOpportunity = async (o: Opportunity) => {
    const sku = "SERP-" + o.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    setAdding(sku);
    const { error } = await supabase.from("spark_trade_shortlist").insert({
      asin: sku,
      product_name: o.title,
      category: "Buy Soon",
      sale_price: o.sale_price_zar,
      cost_price: o.cost_price_zar,
      estimated_margin: o.estimated_margin_zar,
      margin_pct: o.sale_price_zar > 0 ? Number(((o.estimated_margin_zar / o.sale_price_zar) * 100).toFixed(2)) : 0,
      data_source: "serpapi",
      status: "buy_soon",
      target_slots: 25,
      moq: 5,
    } as any);
    setAdding(null);
    if (error) return toast.error(error.message);
    toast.success(`Added ${o.title}`);
    load();
  };

  const sourceBadge = (s: string | null) => {
    const map: Record<string, { label: string; tone: string }> = {
      makro: { label: "Makro · Live", tone: "bg-accent/20 text-accent" },
      makro_seed: { label: "Makro · Seed", tone: "bg-amber-500/20 text-amber-400" },
      amazon: { label: "Amazon", tone: "bg-primary/20 text-primary" },
      serpapi: { label: "🌍 Buy Soon", tone: "bg-emerald-700/30 text-amber-300" },
    };
    const label = s === "manuel" ? "Manual" : (s ?? "Manual");
    const m = map[s ?? ""] ?? { label, tone: "bg-secondary text-muted-foreground" };
    return <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-1 ${m.tone}`}>{m.label}</span>;
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Spark Trade Shortlist</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage MOQ, slots, source, and approval status.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={findBuySoon} disabled={scouting} variant="outline" className="gap-2">
            {scouting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
            Find Buy Soon Products
          </Button>
          <Button onClick={fetchMakro} disabled={fetching} className="gap-2">
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Fetch Products from Makro
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 rounded-3xl border border-border bg-gradient-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="text-left p-4">Product</th>
                <th className="text-left p-4">Source</th>
                <th className="text-left p-4">SKU/ASIN</th>
                <th className="text-left p-4">Price</th>
                <th className="text-left p-4">Sold/mo</th>
                <th className="text-left p-4">MOQ</th>
                <th className="text-left p-4">Slots</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="p-4">
                    <div className="font-medium flex items-center gap-2">
                      {r.product_name ?? "—"}
                      {r.is_demo && <span className="text-[9px] uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-400 px-1.5 py-0.5">DEMO</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.category}</div>
                  </td>
                  <td className="p-4">{sourceBadge(r.data_source)}</td>
                  <td className="p-4 text-xs">{r.asin}</td>
                  <td className="p-4 text-xs">R{Number(r.sale_price ?? 0).toFixed(0)}</td>
                  <td className="p-4 text-xs whitespace-nowrap">
                    {r.estimated_monthly_sales ? (
                      <span className="inline-flex items-center gap-1">
                        ~{r.estimated_monthly_sales.toLocaleString()}
                        {r.data_source === "makro" ? (
                          <span className="text-emerald-400" title="Live data">✓</span>
                        ) : r.data_source === "makro_seed" ? (
                          <span className="text-amber-400" title="Estimated (no live API)">⚠️</span>
                        ) : null}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-4">
                    <Input type="number" defaultValue={r.moq ?? 0} className="w-20 h-9" onBlur={(e) => {
                      const v = Number(e.target.value); if (v !== r.moq) updateRow(r.id, { moq: v });
                    }} />
                  </td>
                  <td className="p-4 text-xs">{r.joined_count ?? 0}/{r.target_slots ?? 0}</td>
                  <td className="p-4">
                    <span className="text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-1">{r.status ?? "open"}</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" title="Buy Now" onClick={() => updateRow(r.id, { status: "buy_now" })}>
                        <Zap className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" title="Buy Soon" onClick={() => updateRow(r.id, { status: "buy_soon" })}>
                        <Clock className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" title="Approve" onClick={() => updateRow(r.id, { status: "approved" })}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" title="Close" onClick={() => updateRow(r.id, { status: "closed" })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">No shortlist entries. Click "Fetch Products from Makro" to seed.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={opps !== null} onOpenChange={(o) => !o && setOpps(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">🌍 International Buy Soon Opportunities</DialogTitle>
            <DialogDescription>
              Trending in US/UK/AU with low Takealot availability. Add the best to your shortlist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {opps?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No opportunities found this run.</p>
            )}
            {opps?.map((o, i) => {
              const sku = "SERP-" + o.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
              return (
                <div key={i} className="rounded-2xl border border-border bg-secondary/40 p-4 flex gap-3">
                  {o.thumbnail && (
                    <img src={o.thumbnail} alt="" className="h-16 w-16 rounded-xl object-cover bg-secondary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2">{o.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Popular in: <span className="text-base">{o.flags.join(" ")}</span></span>
                      <span className={o.takealot_count <= 1 ? "text-amber-300" : ""}>
                        Takealot: {o.takealot_count} listing{o.takealot_count === 1 ? "" : "s"}
                      </span>
                      <span className="text-emerald-400">~R{o.estimated_margin_zar} margin</span>
                    </div>
                  </div>
                  <Button size="sm" disabled={adding === sku} onClick={() => addOpportunity(o)} className="gap-1">
                    {adding === sku ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Add
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
