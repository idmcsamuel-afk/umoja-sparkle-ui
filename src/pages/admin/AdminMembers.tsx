import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Ban, Pause, Trash2, RotateCcw, UserPlus, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface Row {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  rank: string | null;
  status: string | null;
  is_active: boolean | null;
  created_at: string | null;
  referred_by: string | null;
  referred_by_code: string | null;
  has_buyers_club_access: boolean | null;
  balance?: number;
  referrer_name?: string | null;
}

type Action = "banned" | "suspended" | "deleted" | "active";
const LABELS: Record<Action, string> = {
  banned: "Ban member",
  suspended: "Suspend member",
  deleted: "Delete member",
  active: "Reactivate member",
};

export default function AdminMembers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{ row: Row; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignFor, setAssignFor] = useState<Row | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [m, w] = await Promise.all([
      supabase.from("members").select("id, full_name, email, phone, rank, status, is_active, created_at, referred_by, referred_by_code, has_buyers_club_access").order("created_at", { ascending: false }).limit(2000),
      supabase.from("spark_wallets").select("member_id, balance"),
    ]);
    const wmap = new Map<string, number>();
    for (const x of (w.data ?? []) as { member_id: string; balance: number }[]) wmap.set(x.member_id, Number(x.balance ?? 0));
    const list = (m.data ?? []) as Row[];
    const byId = new Map(list.map((r) => [r.id, r.full_name]));
    setRows(
      list.map((r) => ({
        ...r,
        balance: wmap.get(r.id) ?? 0,
        referrer_name: r.referred_by ? byId.get(r.referred_by) ?? null : null,
      })),
    );
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.full_name, r.email, r.phone, r.rank, r.status, r.referrer_name].some((v) => v?.toLowerCase().includes(term))
    );
  }, [rows, q]);

  const candidates = useMemo(() => {
    if (!assignFor) return [];
    const term = assignSearch.toLowerCase().trim();
    return rows
      .filter((r) => r.id !== assignFor.id)
      .filter((r) => !term || [r.full_name, r.email, r.phone].some((v) => v?.toLowerCase().includes(term)))
      .slice(0, 10);
  }, [assignFor, assignSearch, rows]);

  const apply = async () => {
    if (!confirm) return;
    setBusy(true);
    const { error } = await supabase
      .from("members")
      .update({ status: confirm.action, is_active: confirm.action === "active" })
      .eq("id", confirm.row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${confirm.row.full_name} → ${confirm.action}`);
    setConfirm(null);
    load();
  };

  const toggleClub = async (r: Row) => {
    const next = !r.has_buyers_club_access;
    const { error } = await supabase.from("members").update({ has_buyers_club_access: next }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(`${r.full_name}: Buyers Club ${next ? "granted" : "revoked"}`);
    load();
  };

  const assignReferrer = async (referrerId: string) => {
    if (!assignFor) return;
    setAssignBusy(true);
    const { data, error } = await supabase.rpc("assign_referrer", { _member: assignFor.id, _referrer: referrerId });
    setAssignBusy(false);
    if (error) return toast.error(error.message);
    const r = data as { ok?: boolean; credited?: boolean } | null;
    toast.success(r?.credited ? "Referrer assigned · 200 Sparks credited" : "Referrer assigned (already credited)");
    setAssignFor(null);
    setAssignSearch("");
    load();
  };

  const statusPill = (s: string | null, isActive: boolean | null) => {
    const v = s ?? (isActive ? "active" : "inactive");
    const cls =
      v === "banned" ? "bg-destructive/15 text-destructive" :
      v === "suspended" ? "bg-orange-500/15 text-orange-400" :
      v === "deleted" ? "bg-destructive/20 text-destructive line-through" :
      v === "active" ? "bg-primary/15 text-primary" :
      "bg-muted text-muted-foreground";
    return <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-1 ${cls}`}>{v}</span>;
  };

  const rowTone = (s: string | null) =>
    s === "banned" || s === "deleted" ? "bg-destructive/[0.04]" :
    s === "suspended" ? "bg-orange-500/[0.04]" : "";

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">Total: <span className="text-foreground font-medium">{rows.length.toLocaleString()}</span> members</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, referrer…" className="pl-9 h-11 rounded-2xl bg-secondary/60 border-border" />
        </div>
      </div>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 rounded-3xl border border-border bg-gradient-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Contact</th>
                <th className="text-right p-4">Sparks</th>
                <th className="text-left p-4">Referred by</th>
                <th className="text-left p-4">Club</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Joined</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const s = r.status ?? "active";
                return (
                  <tr key={r.id} className={`border-b border-border/50 last:border-0 hover:bg-secondary/30 ${rowTone(s)}`}>
                    <td className="p-4 font-medium">{r.full_name}</td>
                    <td className="p-4 text-xs text-muted-foreground">
                      <div>{r.email}</div>
                      <div>{r.phone}</div>
                    </td>
                    <td className="p-4 text-right font-display text-accent-soft">{Math.round(r.balance ?? 0).toLocaleString()}</td>
                    <td className="p-4 text-xs">
                      {r.referrer_name ? (
                        <div>
                          <div className="text-foreground">{r.referrer_name}</div>
                          <div className="text-muted-foreground font-mono">{r.referred_by_code}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleClub(r)}
                        className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-1 inline-flex items-center gap-1 ${
                          r.has_buyers_club_access ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                        }`}
                        title="Toggle Buyers Club access"
                      >
                        <Crown className="h-3 w-3" />
                        {r.has_buyers_club_access ? "Member" : "Off"}
                      </button>
                    </td>
                    <td className="p-4">{statusPill(r.status, r.is_active)}</td>
                    <td className="p-4 text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button size="sm" variant="outline" className="h-8 px-2" title="Assign referrer" onClick={() => setAssignFor(r)}>
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                        {s !== "active" && (
                          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setConfirm({ row: r, action: "active" })}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {s !== "suspended" && (
                          <Button size="sm" variant="outline" className="h-8 px-2 text-orange-400 border-orange-500/40" onClick={() => setConfirm({ row: r, action: "suspended" })}>
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {s !== "banned" && (
                          <Button size="sm" variant="outline" className="h-8 px-2 text-destructive border-destructive/40" onClick={() => setConfirm({ row: r, action: "banned" })}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {s !== "deleted" && (
                          <Button size="sm" variant="outline" className="h-8 px-2 text-destructive border-destructive/40" onClick={() => setConfirm({ row: r, action: "deleted" })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">No members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? LABELS[confirm.action] : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && (
                <>Are you sure you want to set <b>{confirm.row.full_name}</b> to <b>{confirm.action}</b>? This action takes effect immediately.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={apply} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!assignFor} onOpenChange={(o) => { if (!o) { setAssignFor(null); setAssignSearch(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign referrer</DialogTitle>
            <DialogDescription>
              Manually attach a referrer to <b>{assignFor?.full_name}</b>. The referrer will be credited 200 Sparks if not already credited.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="h-11 rounded-2xl bg-secondary/60 border-border"
          />
          <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-border rounded-2xl border border-border">
            {candidates.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No matches.</p>
            ) : candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => assignReferrer(c.id)}
                disabled={assignBusy}
                className="w-full text-left p-3 hover:bg-secondary/40 transition-smooth flex items-center justify-between gap-3 disabled:opacity-50"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.email ?? c.phone}</div>
                </div>
                {assignBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 text-accent" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
