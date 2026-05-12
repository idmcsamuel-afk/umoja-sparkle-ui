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
  const [serpUsage, setSerpUsage] = useState<{ plan?: string; searches_used?: number | null; searches_left?: number | null } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const [calcOpen, setCalcOpen] = useState(false);
  const [calcRow, setCalcRow] = useState<Row | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [newRate, setNewRate] = useState<number>(2.45);
  const [applying, setApplying] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("spark_trade_shortlist")
      .select("id, asin, product_name, category, moq, target_slots, joined_count, status, data_source, sale_price, cost_price, estimated_monthly_sales, is_demo, cost_breakdown, cost_updated_at")
      .order("added_at", { ascending: false });
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateRow = async (id: string, patch: Partial<Row>) => {
    const { error } = await supabase.from("spark_trade_shortlist").update(patch as any).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const openCalc = (r: Row) => { setCalcRow(r); setCalcOpen(true); };

  const applyNewRate = async () => {
    if (newRate <= 0) return toast.error("Rate must be > 0");
    setApplying(true);
    const targets = rows.filter(r => r.cost_breakdown);
    for (const r of targets) {
      const cb = r.cost_breakdown!;
      const qty = cb.quantity || 1;
      const productZar = cb.product_cost_cny * newRate * qty;
      const shipping = cb.shipping_cost; // shipping is ZAR-based, unchanged
      const clearing = 0.15 * (cb.product_cost_cny * newRate);
      const landing = (productZar + shipping + clearing) * 1.05;
      const total = landing + cb.handling_fee + cb.storage_fee;
      const perUnit = total / qty;
      const m = cb.target_margin_percent;
      const bronzePrice = m < 100 ? perUnit / (1 - m / 100) : perUnit;
      const bronzeProfit = bronzePrice - perUnit;
      const updated: CostBreakdown = {
        ...cb,
        exchange_rate: newRate,
        clearing_cost: Math.round(clearing * 100) / 100,
        landing_cost: Math.round(landing * 100) / 100,
        total_cost_zar: Math.round(total * 100) / 100,
        cost_per_unit: Math.round(perUnit * 100) / 100,
        bronze_sell_price: Math.round(bronzePrice * 100) / 100,
        bronze_profit: Math.round(bronzeProfit * 100) / 100,
        silver_sell_price: Math.round(bronzePrice * 1.05 * 100) / 100,
        silver_profit: Math.round(bronzeProfit * 1.05 * 100) / 100,
        gold_sell_price: Math.round(bronzePrice * 1.10 * 100) / 100,
        gold_profit: Math.round(bronzeProfit * 1.10 * 100) / 100,
        calculated_at: new Date().toISOString(),
      };
      await supabase.from("spark_trade_shortlist").update({
        cost_breakdown: updated as any,
        cost_updated_at: new Date().toISOString(),
        sale_price: updated.bronze_sell_price,
        cost_price: updated.cost_per_unit,
        estimated_margin: updated.bronze_profit,
      }).eq("id", r.id);
    }
    setApplying(false);
    setRateOpen(false);
    toast.success(`Recalculated ${targets.length} products`);
    load();
  };

  const exportCsv = () => {
    const header = ["Product","ASIN","MOQ","Product Cost CNY","Rate","Shipping","Clearing","Landing","Handling","Storage","Total Cost","Cost/Unit","Margin %","Bronze Price","Bronze Profit","Silver Price","Silver Profit","Gold Price","Gold Profit","Updated"];
    const lines = [header.join(",")];
    rows.forEach(r => {
      const cb = r.cost_breakdown;
      lines.push([
        JSON.stringify(r.product_name ?? ""), r.asin, r.moq ?? "",
        cb?.product_cost_cny ?? "", cb?.exchange_rate ?? "",
        cb?.shipping_cost ?? "", cb?.clearing_cost ?? "", cb?.landing_cost ?? "",
        cb?.handling_fee ?? "", cb?.storage_fee ?? "", cb?.total_cost_zar ?? "",
        cb?.cost_per_unit ?? "", cb?.target_margin_percent ?? "",
        cb?.bronze_sell_price ?? "", cb?.bronze_profit ?? "",
        cb?.silver_sell_price ?? "", cb?.silver_profit ?? "",
        cb?.gold_sell_price ?? "", cb?.gold_profit ?? "",
        r.cost_updated_at ?? "",
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `spark-trade-costs-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const ago = (iso: string | null) => {
    if (!iso) return null;
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
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
    if (error) {
      console.error("serpapi-trending failed", error);
      return toast.error(error.message || "SerpAPI search failed");
    }
    const payload = data as any;
    if (payload?.ok === false) {
      console.error("serpapi-trending payload error", payload);
      return toast.error(payload.error || "SerpAPI search failed");
    }
    const list = payload?.opportunities ?? [];
    setOpps(list);
    setSerpUsage(payload?.usage ?? null);
    if (!list.length) toast.message("No opportunities found this run.");
    else toast.success(`Found ${list.length} new Buy Soon opportunities`);
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
          <Button onClick={exportCsv} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export Costs
          </Button>
          <Button onClick={() => setRateOpen(true)} variant="outline" className="gap-2">
            <DollarSign className="h-4 w-4" /> Update Exchange Rate
          </Button>
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
                    {r.cost_breakdown && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="text-[10px] rounded-full bg-secondary px-2 py-0.5">R{Math.round(r.cost_breakdown.cost_per_unit)} cost</span>
                        <span className="text-[10px] rounded-full bg-emerald-700/20 text-emerald-400 px-2 py-0.5">R{Math.round(r.cost_breakdown.bronze_profit)}–R{Math.round(r.cost_breakdown.gold_profit)} profit</span>
                        <span className="text-[10px] rounded-full bg-accent/20 text-accent px-2 py-0.5">{r.cost_breakdown.target_margin_percent}% margin</span>
                        {r.cost_updated_at && <span className="text-[10px] text-muted-foreground">Updated {ago(r.cost_updated_at)}</span>}
                      </div>
                    )}
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
                      <Button size="sm" variant="outline" title="Edit Costs" onClick={() => openCalc(r)} className="gap-1">
                        <Calculator className="h-3 w-3" /> Costs
                      </Button>
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
              Trending in US/UK/AU/CA with low Takealot availability. Add the best to your shortlist.
            </DialogDescription>
            {serpUsage && (
              <p className="text-[11px] text-muted-foreground mt-1">
                SerpAPI {serpUsage.plan ?? "Free"} ·{" "}
                {serpUsage.searches_used != null ? `${serpUsage.searches_used} used` : "usage n/a"}
                {serpUsage.searches_left != null ? ` · ${serpUsage.searches_left} searches left` : ""}
              </p>
            )}
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

      <SparkTradeCostCalculator
        open={calcOpen}
        onOpenChange={setCalcOpen}
        productId={calcRow?.id ?? null}
        productName={calcRow?.product_name ?? calcRow?.asin ?? ""}
        initial={calcRow?.cost_breakdown ?? null}
        onSaved={load}
      />

      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Exchange Rate</DialogTitle>
            <DialogDescription>
              Recalculates costs for {rows.filter(r => r.cost_breakdown).length} product(s) with stored cost breakdowns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">New rate (CNY → ZAR)</label>
              <Input type="number" step="0.01" value={newRate || ""} onChange={(e) => setNewRate(Number(e.target.value))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRateOpen(false)}>Cancel</Button>
              <Button onClick={applyNewRate} disabled={applying} className="gap-1">
                {applying && <Loader2 className="h-4 w-4 animate-spin" />} Apply to All Products
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
