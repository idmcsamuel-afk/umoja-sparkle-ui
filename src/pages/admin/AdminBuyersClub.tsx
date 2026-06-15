import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, ExternalLink, Crown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Row {
  id: string; full_name: string; email: string | null;
  buyers_club_tier: string | null; buyers_club_amount: number | null;
  buyers_club_status: string | null; buyers_club_proof_url: string | null;
  buyers_club_submitted_at: string | null;
  buyers_club_renewal_at: string | null;
  has_buyers_club_access: boolean | null;
}

export default function AdminBuyersClub() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [reject, setReject] = useState<{ id: string; reason: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("members")
      .select("id, full_name, email, buyers_club_tier, buyers_club_amount, buyers_club_status, buyers_club_proof_url, buyers_club_submitted_at, buyers_club_renewal_at, has_buyers_club_access")
      .not("buyers_club_status", "is", null)
      .order("buyers_club_submitted_at", { ascending: false })
      .limit(500);
    setRows((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const viewProof = async (path: string) => {
    const { data } = await supabase.storage.from("buyers-club-proofs").createSignedUrl(path, 300);
    if (data?.signedUrl) setProofUrl(data.signedUrl);
    else toast.error("Could not load proof");
  };

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_approve_buyers_club", { _member: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Approved"); load();
  };

  const extend = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_extend_buyers_club", { _member: id, _months: 1 });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Extended +1 month"); load();
  };

  const submitReject = async () => {
    if (!reject) return;
    setBusy(reject.id);
    const { error } = await supabase.rpc("admin_reject_buyers_club", { _member: reject.id, _reason: reject.reason });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Rejected"); setReject(null); load();
  };

  const tierBadge = (t: string | null) => {
    const map: Record<string,string> = { bronze:"bg-amber-700/30 text-amber-400", silver:"bg-zinc-400/30 text-zinc-200", gold:"bg-accent/30 text-accent" };
    return <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-1 ${map[t??""] ?? "bg-secondary text-muted-foreground"}`}>{t ?? "—"}</span>;
  };

  const statusBadge = (s: string | null, active: boolean | null) => {
    if (active) return <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-1 bg-primary/20 text-primary">Active</span>;
    const tone = s === "rejected" ? "bg-destructive/20 text-destructive" : "bg-amber-500/20 text-amber-400";
    return <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-1 ${tone}`}>{s ?? "pending"}</span>;
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-accent" />
        <div>
          <h1 className="font-display text-3xl">Buyers Club</h1>
          <p className="text-sm text-muted-foreground">Approve EFT payments to unlock real product access.</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 rounded-3xl border border-border bg-gradient-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="text-left p-4">Member</th>
                <th className="text-left p-4">Tier</th>
                <th className="text-left p-4">Amount</th>
                <th className="text-left p-4">Submitted</th>
                <th className="text-left p-4">Renews</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const renew = r.buyers_club_renewal_at ? new Date(r.buyers_club_renewal_at) : null;
                const expired = renew ? renew.getTime() < Date.now() : false;
                return (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="p-4">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="p-4">{tierBadge(r.buyers_club_tier)}</td>
                  <td className="p-4 text-xs">R{Number(r.buyers_club_amount ?? 0).toLocaleString()}<span className="text-muted-foreground">/mo</span></td>
                  <td className="p-4 text-xs text-muted-foreground">{r.buyers_club_submitted_at ? new Date(r.buyers_club_submitted_at).toLocaleDateString() : "—"}</td>
                  <td className={`p-4 text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                    {renew ? renew.toLocaleDateString() : "—"}
                    {expired && <span className="block text-[10px]">expired</span>}
                  </td>
                  <td className="p-4">{statusBadge(r.buyers_club_status, r.has_buyers_club_access)}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2 flex-wrap">
                      {r.buyers_club_proof_url && (
                        <Button size="sm" variant="outline" onClick={() => viewProof(r.buyers_club_proof_url!)}>
                          <ExternalLink className="h-3 w-3" /> Proof
                        </Button>
                      )}
                      {r.buyers_club_status === "pending" && (
                        <>
                          <Button size="sm" disabled={busy === r.id} onClick={() => approve(r.id)} className="bg-primary text-primary-foreground">
                            {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} {r.has_buyers_club_access ? "Approve renewal" : "Approve"}
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/40" onClick={() => setReject({ id: r.id, reason: "" })}>
                            <X className="h-3 w-3" /> Reject
                          </Button>
                        </>
                      )}
                      {r.has_buyers_club_access && (
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => extend(r.id)}>
                          {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "+1 month"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No Buyers Club submissions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!proofUrl} onOpenChange={(o) => !o && setProofUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Payment proof</DialogTitle></DialogHeader>
          {proofUrl && (proofUrl.includes(".pdf") ?
            <iframe src={proofUrl} className="w-full h-[70vh] rounded-xl" /> :
            <img src={proofUrl} alt="proof" className="w-full max-h-[70vh] object-contain rounded-xl" />)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
            <DialogDescription>Tell the member why so they can re-submit.</DialogDescription>
          </DialogHeader>
          <Textarea value={reject?.reason ?? ""} onChange={(e) => reject && setReject({ ...reject, reason: e.target.value })} placeholder="Reason (e.g. proof unreadable, amount mismatch)" />
          <Button onClick={submitReject} disabled={!reject?.reason || !!busy} className="bg-destructive text-destructive-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm reject"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
