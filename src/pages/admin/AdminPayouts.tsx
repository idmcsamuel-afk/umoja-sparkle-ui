import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

interface Bid {
  id: string;
  member_id: string;
  tier: string;
  fiat_amount: number;
  net_amount: number;
  payout_amount: number | null;
  payout_date: string | null;
  status: string | null;
  vault_end: string | null;
  member?: { full_name: string; email: string | null; phone: string };
}

export default function AdminPayouts() {
  const [rows, setRows] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<Bid | null>(null);
  const [override, setOverride] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: bids } = await supabase
      .from("circle_bids")
      .select("id, member_id, tier, fiat_amount, net_amount, payout_amount, payout_date, status, vault_end")
      .in("status", ["matched", "pending", "active"])
      .order("vault_end", { ascending: true })
      .limit(200);
    const ids = Array.from(new Set((bids ?? []).map((b: any) => b.member_id)));
    let memberMap = new Map<string, any>();
    if (ids.length) {
      const { data: members } = await supabase
        .from("members")
        .select("id, full_name, email, phone")
        .in("id", ids);
      memberMap = new Map((members ?? []).map((m: any) => [m.id, m]));
    }
    setRows(((bids ?? []) as any[]).map((b) => ({ ...b, member: memberMap.get(b.member_id) })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openConfirm = (b: Bid) => {
    setOverride(String(b.payout_amount ?? b.net_amount ?? ""));
    setConfirm(b);
  };

  const markPaid = async () => {
    if (!confirm) return;
    setBusy(true);
    const amt = Number(override);
    const { error } = await supabase
      .from("circle_bids")
      .update({
        status: "paid",
        payout_amount: isFinite(amt) && amt > 0 ? amt : confirm.payout_amount ?? confirm.net_amount,
        payout_date: new Date().toISOString(),
      })
      .eq("id", confirm.id);
    if (!error) {
      // notify member (in-app; future WhatsApp)
      await supabase.from("notifications").insert({
        member_id: confirm.member_id,
        title: "Payout sent 💰",
        body: `Your ${confirm.tier} circle payout of ${fmtR(amt)} has been processed.`,
        kind: "payout",
        link: "/circle",
      });
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payout marked paid & member notified");
    setConfirm(null);
    load();
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Fast-track payouts</h1>
      <p className="text-sm text-muted-foreground mt-1">Matched circle bids ready to pay.</p>

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
                  <td className="p-4">
                    <div className="font-medium">{r.member?.full_name ?? r.member_id.slice(0, 8) + "…"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.member?.email ?? r.member?.phone}</div>
                  </td>
                  <td className="p-4 capitalize">{r.tier}</td>
                  <td className="p-4 text-right">{fmtR(Number(r.net_amount))}</td>
                  <td className="p-4 text-right text-accent-soft">{r.payout_amount != null ? fmtR(Number(r.payout_amount)) : "—"}</td>
                  <td className="p-4 text-xs">{r.vault_end ? new Date(r.vault_end).toLocaleString() : "—"}</td>
                  <td className="p-4 text-xs capitalize">{r.status}</td>
                  <td className="p-4 text-right">
                    <Button size="sm" className="bg-gradient-gold text-amber-950 hover:opacity-95" onClick={() => openConfirm(r)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark paid
                    </Button>
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

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payout</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && (
                <>
                  Pay <b>{confirm.member?.full_name ?? confirm.member_id.slice(0, 8)}</b> for the{" "}
                  <b className="capitalize">{confirm.tier}</b> circle. Adjust amount if needed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1">
            <label className="text-xs text-muted-foreground">Payout amount (R)</label>
            <Input value={override} onChange={(e) => setOverride(e.target.value)} type="number" className="mt-1" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={markPaid} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark paid & notify"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
