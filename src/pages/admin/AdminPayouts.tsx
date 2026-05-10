import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

interface Bid {
  id: string;
  member_id: string;
  tier: string;
  fiat_amount: number;
  net_amount: number;
  payout_amount: number | null;
  status: string | null;
  vault_end: string | null;
}

export default function AdminPayouts() {
  const [rows, setRows] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("circle_bids")
      .select("id, member_id, tier, fiat_amount, net_amount, payout_amount, status, vault_end")
      .in("status", ["pending", "active", "matched"])
      .order("vault_end", { ascending: true })
      .limit(200);
    setRows((data ?? []) as Bid[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("circle_bids").update({ status: "paid" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked paid");
    load();
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Payouts</h1>
      <p className="text-sm text-muted-foreground mt-1">Pending and overdue circle payouts.</p>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 rounded-3xl border border-border bg-gradient-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="text-left p-4">Member</th>
                <th className="text-left p-4">Tier</th>
                <th className="text-right p-4">Net</th>
                <th className="text-right p-4">Payout</th>
                <th className="text-left p-4">Vault end</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="p-4 text-xs">{r.member_id.slice(0, 8)}…</td>
                  <td className="p-4 capitalize">{r.tier}</td>
                  <td className="p-4 text-right">{fmtR(Number(r.net_amount))}</td>
                  <td className="p-4 text-right text-accent-soft">{r.payout_amount != null ? fmtR(Number(r.payout_amount)) : "—"}</td>
                  <td className="p-4 text-xs">{r.vault_end ? new Date(r.vault_end).toLocaleString() : "—"}</td>
                  <td className="p-4 text-xs">{r.status}</td>
                  <td className="p-4 text-right">
                    <Button size="sm" variant="outline" onClick={() => markPaid(r.id)}>Mark paid</Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No pending payouts.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
