import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Search, Ban, Pause, Trash2, RotateCcw, UserPlus, Crown, Copy, Check, Sparkles, KeyRound } from "lucide-react";
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
  referral_code: string | null;
  has_buyers_club_access: boolean | null;
  balance?: number;
  referrer_name?: string | null;
}

interface TxRow {
  id: string;
  created_at: string;
  amount: number;
  tx_type: string;
  status: string | null;
  description: string | null;
  from_member: string | null;
  to_member: string | null;
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sparks adjust modal
  const [adjustFor, setAdjustFor] = useState<Row | null>(null);
  const [adjustDir, setAdjustDir] = useState<"add" | "remove">("add");
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [txsLoading, setTxsLoading] = useState(false);

  // Password reset modal
  const [resetFor, setResetFor] = useState<Row | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetTempPwd, setResetTempPwd] = useState<string>("");
  const [resetCopied, setResetCopied] = useState(false);

  const generatePassword = async () => {
    if (!resetFor) return;
    setResetBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-reset-user-password", {
      body: { userId: resetFor.id },
    });
    setResetBusy(false);
    if (error || (data as { error?: string })?.error) {
      return toast.error((data as { error?: string })?.error || error?.message || "Reset failed");
    }
    setResetTempPwd((data as { temp_password: string }).temp_password);
  };

  const copyTempPwd = async () => {
    try {
      await navigator.clipboard.writeText(resetTempPwd);
      setResetCopied(true);
      window.setTimeout(() => setResetCopied(false), 1500);
    } catch { toast.error("Could not copy"); }
  };

  const closeReset = () => {
    setResetFor(null);
    setResetTempPwd("");
    setResetCopied(false);
  };

  const refCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of rows) if (r.referred_by) c.set(r.referred_by, (c.get(r.referred_by) ?? 0) + 1);
    return c;
  }, [rows]);

  const load = async () => {
    setLoading(true);
    const [m, w] = await Promise.all([
      supabase.from("members").select("id, full_name, email, phone, rank, status, is_active, created_at, referred_by, referred_by_code, referral_code, has_buyers_club_access").order("created_at", { ascending: false }).limit(2000),
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
      [r.id, r.full_name, r.email, r.phone, r.rank, r.status, r.referrer_name].some((v) => v?.toLowerCase().includes(term))
    );
  }, [rows, q]);

  const candidates = useMemo(() => {
    if (!assignFor) return [];
    const term = assignSearch.toLowerCase().trim();
    return rows
      .filter((r) => r.id !== assignFor.id)
      .filter((r) => !term || [r.full_name, r.email, r.phone, r.referral_code].some((v) => v?.toLowerCase().includes(term)))
      .slice(0, 10);
  }, [assignFor, assignSearch, rows]);

  const apply = async () => {
    if (!confirm) return;
    setBusy(true);
    if (confirm.action === "deleted") {
      const { data, error } = await supabase.functions.invoke("admin-delete-auth-user", {
        body: { userId: confirm.row.id },
      });
      setBusy(false);
      if (error || (data as any)?.error) {
        return toast.error((data as any)?.error || error?.message || "Delete failed");
      }
      toast.success(`${confirm.row.full_name} permanently deleted`);
      setConfirm(null);
      load();
      return;
    }
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
    toast.success(r?.credited ? "Referral assigned! Sparks credited." : "Referrer assigned (already credited)");
    setAssignFor(null);
    setAssignSearch("");
    load();
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch { toast.error("Could not copy"); }
  };

  const openAdjust = async (r: Row) => {
    setAdjustFor(r);
    setAdjustDir("add");
    setAdjustAmt("");
    setAdjustReason("");
    setTxs([]);
    setTxsLoading(true);
    const { data } = await supabase.rpc("admin_member_transactions", { _member: r.id, _limit: 50 });
    setTxs((data as TxRow[]) ?? []);
    setTxsLoading(false);
  };

  const submitAdjust = async () => {
    if (!adjustFor) return;
    const amt = Number(adjustAmt);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a positive amount");
    if (!adjustReason.trim()) return toast.error("Reason is required");
    const delta = adjustDir === "add" ? amt : -amt;
    setAdjustBusy(true);
    const { data, error } = await supabase.rpc("admin_adjust_sparks", {
      _member: adjustFor.id, _delta: delta, _reason: adjustReason.trim(),
    });
    setAdjustBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Balance: ${Math.round(Number(data ?? 0)).toLocaleString()} ✨`);
    setAdjustAmt("");
    setAdjustReason("");
    // refresh tx log + rows
    const { data: log } = await supabase.rpc("admin_member_transactions", { _member: adjustFor.id, _limit: 50 });
    setTxs((log as TxRow[]) ?? []);
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search id, name, email, referrer…" className="pl-9 h-11 rounded-2xl bg-secondary/60 border-border" />
        </div>
      </div>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 rounded-3xl border border-border bg-gradient-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="text-left p-4">ID</th>
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
                    <td className="p-4">
                      <button
                        onClick={() => copyId(r.id)}
                        title="Click to copy member ID"
                        className="font-mono text-[11px] text-muted-foreground hover:text-accent inline-flex items-center gap-1.5"
                      >
                        {r.id.slice(0, 8)}…
                        {copiedId === r.id ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3 opacity-60" />}
                      </button>
                    </td>
                    <td className="p-4 font-medium">{r.full_name}</td>
                    <td className="p-4 text-xs text-muted-foreground">
                      <div>{r.email}</div>
                      <div>{r.phone}</div>
                    </td>
                    <td className="p-4 text-right font-display text-accent-soft">{Math.round(r.balance ?? 0).toLocaleString()}</td>
                    <td className="p-4 text-xs">
                      {r.referrer_name ? (
                        <div>
                          <div className="text-foreground">Referred by {r.referrer_name}</div>
                          <div className="text-muted-foreground font-mono">{r.referred_by_code}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No referrer</span>
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
                        <Button size="sm" variant="outline" className="h-8 px-2" title="Adjust Sparks" onClick={() => openAdjust(r)}>
                          <Sparkles className="h-3.5 w-3.5 text-accent" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 px-2" title="Assign referrer" onClick={() => setAssignFor(r)}>
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 px-2" title="Reset password" onClick={() => { setResetFor(r); setResetTempPwd(""); }}>
                          <KeyRound className="h-3.5 w-3.5 text-accent" />
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
                <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">No members found.</td></tr>
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
              Manually attach a referrer to <b>{assignFor?.full_name}</b>. The referrer will be credited 100 Sparks if not already credited.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            placeholder="Search by name, email, phone or code…"
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
                  <div className="text-xs text-muted-foreground truncate">
                    <span className="font-mono">{c.referral_code ?? "—"}</span> · {refCounts.get(c.id) ?? 0} refs
                  </div>
                </div>
                {assignBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 text-accent" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Sparks */}
      <Dialog open={!!adjustFor} onOpenChange={(o) => { if (!o) setAdjustFor(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjust Sparks · {adjustFor?.full_name}</DialogTitle>
            <DialogDescription>
              Current balance: <b className="text-accent">{Math.round(adjustFor?.balance ?? 0).toLocaleString()} ✨</b>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <RadioGroup value={adjustDir} onValueChange={(v) => setAdjustDir(v as "add" | "remove")} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="add" id="adj-add" /><Label htmlFor="adj-add">Add</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="remove" id="adj-rem" /><Label htmlFor="adj-rem">Remove</Label></div>
            </RadioGroup>

            <div>
              <Label className="text-xs">Amount</Label>
              <Input type="number" min="1" value={adjustAmt} onChange={(e) => setAdjustAmt(e.target.value)} placeholder="e.g. 200" className="mt-1 h-11 rounded-2xl bg-secondary/60" />
            </div>

            <div>
              <Label className="text-xs">Reason (required)</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Why is this adjustment being made?" className="mt-1 h-11 rounded-2xl bg-secondary/60" />
            </div>

            <Button onClick={submitAdjust} disabled={adjustBusy} className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground">
              {adjustBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Adjustment"}
            </Button>
          </div>

          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Recent transactions</p>
            <div className="max-h-60 overflow-y-auto rounded-2xl border border-border divide-y divide-border">
              {txsLoading ? (
                <div className="p-4 grid place-items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : txs.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">No transactions yet.</p>
              ) : txs.map((t) => {
                const incoming = t.to_member === adjustFor?.id;
                const signed = incoming ? Number(t.amount) : -Number(t.amount);
                return (
                  <div key={t.id} className="p-3 text-xs flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{t.tx_type}{t.description ? ` · ${t.description}` : ""}</div>
                      <div className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                    </div>
                    <div className={`font-mono ${signed >= 0 ? "text-accent" : "text-destructive"}`}>
                      {signed >= 0 ? "+" : ""}{Math.round(signed).toLocaleString()} ✨
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset */}
      <Dialog open={!!resetFor} onOpenChange={(o) => { if (!o) closeReset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {resetFor && (
                <>Generate a temporary password for <b>{resetFor.full_name}</b> ({resetFor.email}). They will be forced to choose a new password on their next login.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {!resetTempPwd ? (
            <div className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>Generates a 12-character temporary password</li>
                <li>Their current password stops working immediately</li>
                <li>They must set a new password on next sign-in</li>
                <li>Action is recorded in the admin audit log</li>
              </ul>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeReset} disabled={resetBusy}>Cancel</Button>
                <Button onClick={generatePassword} disabled={resetBusy} className="bg-gradient-primary text-primary-foreground">
                  {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate temporary password"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Temporary password</div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 font-mono text-lg tracking-wider bg-secondary/60 rounded-xl px-3 py-2 break-all">{resetTempPwd}</code>
                  <Button variant="outline" size="sm" onClick={copyTempPwd}>
                    {resetCopied ? <><Check className="h-3.5 w-3.5 mr-1 text-accent" /> Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Share this securely with {resetFor?.full_name}. They will be required to change it on first sign-in.
                </p>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Manual message</Label>
                <textarea
                  readOnly
                  value={`Hi ${resetFor?.full_name ?? ""},\n\nYour UMOJA password has been reset by an administrator.\n\nTemporary password: ${resetTempPwd}\n\nSign in here: ${window.location.origin}/login\nYou'll be asked to choose a new password immediately.\n\n— UMOJA Team`}
                  className="mt-2 w-full h-40 rounded-2xl bg-secondary/60 border border-border p-3 text-xs font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={closeReset} className="bg-gradient-primary text-primary-foreground">Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
