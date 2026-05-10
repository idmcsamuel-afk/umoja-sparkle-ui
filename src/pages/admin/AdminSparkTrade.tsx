import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, X } from "lucide-react";
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
}

export default function AdminSparkTrade() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("spark_trade_shortlist").select("id, asin, product_name, category, moq, target_slots, joined_count, status").order("added_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateRow = async (id: string, patch: Partial<Row>) => {
    const { error } = await supabase.from("spark_trade_shortlist").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Spark Trade Shortlist</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage MOQ, slots, and approval status.</p>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 rounded-3xl border border-border bg-gradient-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="text-left p-4">Product</th>
                <th className="text-left p-4">ASIN</th>
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
                  <td className="p-4 text-xs">{r.asin}</td>
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
                    <div className="inline-flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => updateRow(r.id, { status: "approved" })}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateRow(r.id, { status: "closed" })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No shortlist entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
