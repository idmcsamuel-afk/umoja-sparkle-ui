import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Filter = "all" | "high" | "mid" | "low";

interface Row {
  id: number;
  product_name: string;
  category: string | null;
  amazon_price_zar: number | null;
  china_api_price_zar: number | null;
  estimated_margin_pct: number | null;
  date_sent_to_supplier: string | null;
  status: string;
}

interface Draft {
  moq: string;
  price: string;
  lead: string;
  notes: string;
  saving?: boolean;
  done?: "confirmed" | "skipped";
}

export default function AdminSupplierDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_discovery" as any)
      .select("id, product_name, category, amazon_price_zar, china_api_price_zar, estimated_margin_pct, date_sent_to_supplier, status")
      .in("status", ["queued_for_supplier", "awaiting_response"])
      .order("estimated_margin_pct", { ascending: false })
      .order("date_sent_to_supplier", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const m = Number(r.estimated_margin_pct ?? 0);
      if (filter === "high") return m > 40;
      if (filter === "mid") return m >= 30 && m <= 40;
      if (filter === "low") return m < 30;
      return true;
    });
  }, [rows, filter]);

  const updateDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { moq: "", price: "", lead: "", notes: "", ...d[id], ...patch } }));

  const confirm = async (row: Row) => {
    const d = drafts[row.id];
    if (!d?.moq || !d?.price || !d?.lead) { toast.error("Fill MOQ, price and lead time"); return; }
    updateDraft(row.id, { saving: true });
    const { error } = await supabase
      .from("product_discovery" as any)
      .update({
        status: "confirmed",
        final_moq: Number(d.moq),
        final_supplier_price_zar: Number(d.price),
        lead_time_days: Number(d.lead),
        supplier_response_notes: d.notes || null,
        date_supplier_responded: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) { toast.error(error.message); updateDraft(row.id, { saving: false }); return; }
    updateDraft(row.id, { saving: false, done: "confirmed" });
    toast.success(`✅ ${row.product_name} confirmed`);
  };

  const skip = async (row: Row) => {
    updateDraft(row.id, { saving: true });
    const { error } = await supabase
      .from("product_discovery" as any)
      .update({ status: "awaiting_response" })
      .eq("id", row.id);
    if (error) { toast.error(error.message); updateDraft(row.id, { saving: false }); return; }
    updateDraft(row.id, { saving: false, done: "skipped" });
    toast.message(`⏳ ${row.product_name} skipped`);
  };

  const completed = Object.values(drafts).filter((d) => d.done === "confirmed").length;
  const skipped = Object.values(drafts).filter((d) => d.done === "skipped").length;
  const pending = filtered.filter((r) => !drafts[r.id]?.done).length;

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl md:text-4xl">Supplier Dashboard</h1>
            <p className="mt-1 text-muted-foreground">{rows.length} products pending response</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Reload
          </Button>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {(["all", "high", "mid", "low"] as Filter[]).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "high" ? "High Margin >40%" : f === "mid" ? "Medium 30–40%" : "Low <30%"}
            </Button>
          ))}
        </div>

        <Card className="mt-4 p-4 flex items-center justify-between text-sm">
          <div className="flex gap-4">
            <span><CheckCircle2 className="inline h-4 w-4 text-emerald-600 mr-1" />{completed} confirmed</span>
            <span><Clock className="inline h-4 w-4 text-amber-600 mr-1" />{skipped} skipped</span>
            <span className="text-muted-foreground">{pending} remaining</span>
          </div>
        </Card>

        {loading ? (
          <div className="grid h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card className="mt-4 p-8 text-center text-muted-foreground">Nothing pending in this filter.</Card>
        ) : (
          <div className="mt-4 space-y-3">
            {filtered.map((row, idx) => {
              const d = drafts[row.id];
              const done = d?.done;
              const margin = Number(row.estimated_margin_pct ?? 0);
              const sell = Number(row.amazon_price_zar ?? 0);
              const cost = Number(row.china_api_price_zar ?? 0);
              return (
                <Card
                  key={row.id}
                  className={`p-4 border-l-4 ${done === "confirmed" ? "border-l-emerald-500 bg-emerald-500/5" : done === "skipped" ? "border-l-amber-500 bg-amber-500/5" : "border-l-primary"}`}
                >
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Product {idx + 1} of {filtered.length}</div>
                      <h3 className="font-semibold text-lg">{row.product_name}</h3>
                      <div className="text-xs text-muted-foreground mt-0.5">{row.category ?? "—"}</div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="secondary">Sell ~ R{sell.toFixed(0)}</Badge>
                      <Badge variant="secondary">Cost ~ R{cost.toFixed(0)}</Badge>
                      <Badge>{margin.toFixed(0)}% margin</Badge>
                    </div>
                  </div>

                  {done ? (
                    <div className="mt-3 text-sm">
                      {done === "confirmed" ? "✅ Confirmed" : "⏳ Skipped — will try again tomorrow"}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                      <div>
                        <label className="text-xs text-muted-foreground">MOQ (units)</label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={d?.moq ?? ""}
                          onChange={(e) => updateDraft(row.id, { moq: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && confirm(row)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Final price (ZAR)</label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={d?.price ?? ""}
                          onChange={(e) => updateDraft(row.id, { price: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && confirm(row)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Lead time (days)</label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={d?.lead ?? ""}
                          onChange={(e) => updateDraft(row.id, { lead: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && confirm(row)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Notes</label>
                        <Input
                          value={d?.notes ?? ""}
                          onChange={(e) => updateDraft(row.id, { notes: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && confirm(row)}
                        />
                      </div>
                      <div className="md:col-span-4 flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => skip(row)} disabled={d?.saving}>Skip</Button>
                        <Button onClick={() => confirm(row)} disabled={d?.saving}>
                          {d?.saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Confirm
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
