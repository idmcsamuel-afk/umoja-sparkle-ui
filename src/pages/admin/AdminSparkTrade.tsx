import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, X, RefreshCw, Zap, Clock } from "lucide-react";
import { toast } from "sonner";

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
}

export default function AdminSparkTrade() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("spark_trade_shortlist")
      .select("id, asin, product_name, category, moq, target_slots, joined_count, status, data_source, sale_price, cost_price")
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

  const sourceBadge = (s: string | null) => {
    const label = s === "makro" ? "Makro" : s === "amazon" ? "Amazon" : (s ?? "Manual");
    const tone = s === "makro" ? "bg-accent/20 text-accent" : s === "amazon" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground";
    return <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-1 ${tone}`}>{label}</span>;
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Spark Trade Shortlist</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage MOQ, slots, source, and approval status.</p>
        </div>
        <Button onClick={fetchMakro} disabled={fetching} className="gap-2">
          {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Fetch Products from Makro
        </Button>
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
                    <div className="font-medium">{r.product_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.category}</div>
                  </td>
                  <td className="p-4">{sourceBadge(r.data_source)}</td>
                  <td className="p-4 text-xs">{r.asin}</td>
                  <td className="p-4 text-xs">R{Number(r.sale_price ?? 0).toFixed(0)}</td>
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
                <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">No shortlist entries. Click "Fetch Products from Makro" to seed.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
