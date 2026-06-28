import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, CheckCircle2, XCircle, Eye, ShieldCheck, ShieldAlert,
  Copy, Download, Plus, Calculator as CalcIcon,
} from "lucide-react";
import { toast } from "sonner";

type Payout = {
  id: string;
  circle_id: string | null;
  circle_tier: string | null;
  member_id: string;
  payout_amount: number;
  payout_period: string;
  status: string;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  member?: { full_name: string | null; email: string | null; phone: string | null };
  banking?: BankingRow | null;
};

type BankingRow = {
  id: string;
  member_id: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  account_type: string | null;
  branch_code: string | null;
  verified: boolean;
  member?: { full_name: string | null; email: string | null; phone: string | null };
};

const fmtR = (n: number) =>
  "R" + Number(n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const mask = (acc: string) =>
  acc ? "•••• " + acc.slice(-4) : "—";

const statusTone: Record<string, string> = {
  pending: "bg-secondary text-muted-foreground",
  processing: "bg-accent/15 text-accent-soft",
  paid: "bg-primary/15 text-primary",
  failed: "bg-destructive/15 text-destructive",
};

export default function AdminPayouts() {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [banking, setBanking] = useState<BankingRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");

  // dialogs
  const [markPaid, setMarkPaid] = useState<Payout | null>(null);
  const [markFailed, setMarkFailed] = useState<Payout | null>(null);
  const [viewFull, setViewFull] = useState<Payout | null>(null);
  const [viewBanking, setViewBanking] = useState<BankingRow | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, b] = await Promise.all([
      supabase.from("circle_payouts").select("*").order("created_at", { ascending: false }),
      supabase.from("member_banking_details").select("*").order("created_at", { ascending: false }),
    ]);
    const memberIds = Array.from(new Set([
      ...(p.data ?? []).map((x: any) => x.member_id),
      ...(b.data ?? []).map((x: any) => x.member_id),
    ]));
    const { data: members } = memberIds.length
      ? await supabase.from("members").select("id, full_name, email, phone").in("id", memberIds)
      : { data: [] as any[] };
    const mmap = new Map((members ?? []).map((m: any) => [m.id, m]));
    const bmap = new Map((b.data ?? []).map((x: any) => [x.member_id, x]));
    setPayouts((p.data ?? []).map((x: any) => ({
      ...x,
      member: mmap.get(x.member_id),
      banking: bmap.get(x.member_id) ?? null,
    })));
    setBanking((b.data ?? []).map((x: any) => ({ ...x, member: mmap.get(x.member_id) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const periods = useMemo(
    () => Array.from(new Set(payouts.map((p) => p.payout_period))).sort(),
    [payouts],
  );
  const tiers = useMemo(
    () => Array.from(new Set(payouts.map((p) => p.circle_tier).filter(Boolean))) as string[],
    [payouts],
  );

  const pending = payouts.filter((p) => p.status === "pending" || p.status === "processing");
  const history = payouts.filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterPeriod !== "all" && p.payout_period !== filterPeriod) return false;
    if (filterTier !== "all" && p.circle_tier !== filterTier) return false;
    return true;
  });

  const doMarkPaid = async (ref: string, notes: string) => {
    if (!markPaid) return;
    if (!ref.trim()) { toast.error("Payment reference required"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("circle_payouts")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_reference: ref.trim(),
        notes: notes || null,
      })
      .eq("id", markPaid.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid");
    setMarkPaid(null);
    load();
  };

  const doMarkFailed = async (notes: string) => {
    if (!markFailed) return;
    setBusy(true);
    const { error } = await supabase
      .from("circle_payouts")
      .update({ status: "failed", notes: notes || null })
      .eq("id", markFailed.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as failed");
    setMarkFailed(null);
    load();
  };

  const verifyBanking = async (row: BankingRow) => {
    const { error } = await supabase
      .from("member_banking_details")
      .update({ verified: true })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    // best-effort notification
    await supabase.from("notifications").insert({
      member_id: row.member_id,
      title: "Banking details verified ✅",
      body: "Your bank account has been verified. You're ready to receive payouts.",
      kind: "payout",
      link: "/profile/banking",
    }).then(() => {}, () => {});
    toast.success("Verified & notified member");
    load();
  };

  const flagBanking = async (row: BankingRow) => {
    const { error } = await supabase
      .from("member_banking_details")
      .update({ verified: false })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Flagged for review");
    load();
  };

  const exportCsv = () => {
    const rows = [
      ["Period", "Tier", "Member", "Email", "Amount", "Status", "Paid At", "Reference"],
      ...history.map((p) => [
        p.payout_period,
        p.circle_tier ?? "",
        p.member?.full_name ?? "",
        p.member?.email ?? "",
        String(p.payout_amount),
        p.status,
        p.paid_at ?? "",
        p.payment_reference ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payouts-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Admin</p>
          <h1 className="font-display text-3xl">Circle payouts</h1>
        </div>
        <Button onClick={() => setGenOpen(true)} className="rounded-2xl bg-gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Generate payouts
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="banking">Banking ({banking.length})</TabsTrigger>
          </TabsList>

          {/* PENDING */}
          <TabsContent value="pending" className="mt-4">
            <div className="rounded-2xl border border-border overflow-x-auto bg-gradient-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Circle</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No pending payouts.</TableCell></TableRow>
                  ) : pending.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.payout_period}</TableCell>
                      <TableCell className="capitalize">{p.circle_tier ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{p.member?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.member?.email}</div>
                      </TableCell>
                      <TableCell className="font-display text-gradient-gold">{fmtR(p.payout_amount)}</TableCell>
                      <TableCell><Badge className={`${statusTone[p.status]} border-0 capitalize`}>{p.status}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {p.banking ? (
                          <div>
                            <div>{p.banking.bank_name}</div>
                            <div className="text-muted-foreground">{mask(p.banking.account_number)}</div>
                          </div>
                        ) : <span className="text-destructive">Missing</span>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => setViewFull(p)} className="mr-1"><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" onClick={() => setMarkPaid(p)} className="mr-1 bg-primary text-primary-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Paid
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setMarkFailed(p)}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Period" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All periods</SelectItem>
                  {periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTier} onValueChange={setFilterTier}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Circle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All circles</SelectItem>
                  {tiers.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportCsv} className="ml-auto">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>

            <div className="rounded-2xl border border-border overflow-x-auto bg-gradient-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Circle</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payouts match these filters.</TableCell></TableRow>
                  ) : history.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.payout_period}</TableCell>
                      <TableCell className="capitalize">{p.circle_tier ?? "—"}</TableCell>
                      <TableCell>
                        <div>{p.member?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.member?.email}</div>
                      </TableCell>
                      <TableCell>{fmtR(p.payout_amount)}</TableCell>
                      <TableCell><Badge className={`${statusTone[p.status]} border-0 capitalize`}>{p.status}</Badge></TableCell>
                      <TableCell className="text-xs">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{p.payment_reference ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* BANKING */}
          <TabsContent value="banking" className="mt-4">
            <div className="rounded-2xl border border-border overflow-x-auto bg-gradient-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banking.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No banking details on file.</TableCell></TableRow>
                  ) : banking.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div>{b.member?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{b.member?.email}</div>
                      </TableCell>
                      <TableCell>{b.bank_name}</TableCell>
                      <TableCell className="font-mono text-xs">{mask(b.account_number)}</TableCell>
                      <TableCell className="capitalize">{b.account_type ?? "—"}</TableCell>
                      <TableCell>
                        {b.verified ? (
                          <Badge className="bg-primary/15 text-primary border-0"><ShieldCheck className="h-3 w-3 mr-1" />Verified</Badge>
                        ) : (
                          <Badge className="bg-accent/15 text-accent-soft border-0"><ShieldAlert className="h-3 w-3 mr-1" />Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => setViewBanking(b)} className="mr-1"><Eye className="h-3.5 w-3.5" /></Button>
                        {!b.verified ? (
                          <Button size="sm" onClick={() => verifyBanking(b)} className="bg-primary text-primary-foreground">Verify</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => flagBanking(b)}>Flag</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* MARK PAID */}
      <MarkPaidDialog
        payout={markPaid}
        onClose={() => setMarkPaid(null)}
        onConfirm={doMarkPaid}
        busy={busy}
      />

      {/* MARK FAILED */}
      <MarkFailedDialog
        payout={markFailed}
        onClose={() => setMarkFailed(null)}
        onConfirm={doMarkFailed}
        busy={busy}
      />

      {/* VIEW FULL */}
      <ViewFullDialog payout={viewFull} onClose={() => setViewFull(null)} />
      <ViewBankingDialog row={viewBanking} onClose={() => setViewBanking(null)} />

      {/* GENERATE */}
      <GenerateDialog open={genOpen} onClose={() => { setGenOpen(false); load(); }} />
    </div>
  );
}

// ---------- Dialogs ----------

function MarkPaidDialog({ payout, onClose, onConfirm, busy }: { payout: Payout | null; onClose: () => void; onConfirm: (ref: string, notes: string) => void; busy: boolean }) {
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (payout) { setRef(""); setNotes(""); } }, [payout]);
  return (
    <Dialog open={!!payout} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as paid</DialogTitle>
          <DialogDescription>
            {payout && <>Confirm payment of <b>{fmtR(payout.payout_amount)}</b> to {payout.member?.full_name} for {payout.payout_period}.</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Payment reference *</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="EFT reference / bank confirmation" />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => onConfirm(ref, notes)} className="bg-primary text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkFailedDialog({ payout, onClose, onConfirm, busy }: { payout: Payout | null; onClose: () => void; onConfirm: (notes: string) => void; busy: boolean }) {
  const [notes, setNotes] = useState("");
  useEffect(() => { if (payout) setNotes(""); }, [payout]);
  return (
    <Dialog open={!!payout} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as failed</DialogTitle>
          <DialogDescription>Record why this payout couldn't be sent.</DialogDescription>
        </DialogHeader>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason (e.g. invalid account)" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} variant="destructive" onClick={() => onConfirm(notes)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm failed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewFullDialog({ payout, onClose }: { payout: Payout | null; onClose: () => void }) {
  const [history, setHistory] = useState<Payout[]>([]);
  useEffect(() => {
    if (!payout) return;
    supabase.from("circle_payouts").select("*").eq("member_id", payout.member_id)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setHistory((data ?? []) as Payout[]));
  }, [payout]);
  if (!payout) return null;
  const b = payout.banking;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{payout.member?.full_name ?? "Member"} · {payout.payout_period}</DialogTitle>
          <DialogDescription>Full payout details</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
            <p className="font-display text-2xl text-gradient-gold">{fmtR(payout.payout_amount)}</p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
            <Badge className={`${statusTone[payout.status]} border-0 capitalize mt-1`}>{payout.status}</Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-border p-4 space-y-1 text-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Contact</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{payout.member?.email ?? "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{payout.member?.phone ?? "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Circle</span><span className="capitalize">{payout.circle_tier ?? "—"}</span></div>
        </div>

        <div className="rounded-2xl border border-border p-4 space-y-1 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Banking</p>
            {b?.verified && <Badge className="bg-primary/15 text-primary border-0 text-[10px]">Verified</Badge>}
          </div>
          {!b ? <p className="text-destructive text-xs">No banking details on file.</p> : (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span>{b.bank_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Holder</span><span>{b.account_holder_name}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Account</span>
                <span className="font-mono flex items-center gap-2">
                  {b.account_number}
                  <button onClick={() => { navigator.clipboard.writeText(b.account_number); toast.success("Copied"); }} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" />
                  </button>
                </span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span className="font-mono">{b.branch_code ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{b.account_type ?? "—"}</span></div>
            </>
          )}
        </div>

        {history.length > 1 && (
          <div className="rounded-2xl border border-border p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Previous payouts</p>
            <ul className="divide-y divide-border max-h-48 overflow-auto">
              {history.filter((h) => h.id !== payout.id).map((h) => (
                <li key={h.id} className="flex justify-between py-2 text-sm">
                  <span>{h.payout_period}</span>
                  <span className="text-muted-foreground capitalize">{h.status}</span>
                  <span>{fmtR(h.payout_amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ViewBankingDialog({ row, onClose }: { row: BankingRow | null; onClose: () => void }) {
  if (!row) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.member?.full_name ?? "Member"}</DialogTitle>
          <DialogDescription>{row.member?.email}</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-border p-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span>{row.bank_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Holder</span><span>{row.account_holder_name}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Account</span>
            <span className="font-mono flex items-center gap-2">
              {row.account_number}
              <button onClick={() => { navigator.clipboard.writeText(row.account_number); toast.success("Copied"); }} className="text-muted-foreground hover:text-foreground">
                <Copy className="h-3 w-3" />
              </button>
            </span>
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span className="font-mono">{row.branch_code ?? "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{row.account_type ?? "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Verified</span><span>{row.verified ? "Yes" : "No"}</span></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GenerateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return d.toLocaleString("en-ZA", { month: "long", year: "numeric" });
  });
  const [tier, setTier] = useState<string>("all");
  const [preview, setPreview] = useState<{ member_id: string; full_name: string; tier: string; bid_id: string; amount: number }[] | null>(null);
  const [busy, setBusy] = useState(false);

  const calculate = async () => {
    setBusy(true);
    let q = supabase
      .from("circle_bids")
      .select("id, member_id, tier, payout_amount")
      .eq("status", "matched")
      .eq("is_valid_contribution", true)
      .not("payout_amount", "is", null);
    if (tier !== "all") q = q.eq("tier", tier);
    const { data, error } = await q;
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const memberIds = Array.from(new Set((data ?? []).map((d: any) => d.member_id)));
    const { data: members } = memberIds.length
      ? await supabase.from("members").select("id, full_name").in("id", memberIds)
      : { data: [] as any[] };
    const mmap = new Map((members ?? []).map((m: any) => [m.id, m.full_name]));
    setPreview((data ?? []).map((d: any) => ({
      member_id: d.member_id,
      full_name: mmap.get(d.member_id) ?? "Member",
      tier: d.tier,
      bid_id: d.id,
      amount: Number(d.payout_amount),
    })));
  };

  const confirm = async () => {
    if (!preview?.length) return;
    setBusy(true);
    const rows = preview.map((p) => ({
      member_id: p.member_id,
      circle_id: p.bid_id,
      circle_tier: p.tier,
      payout_amount: p.amount,
      payout_period: period,
      status: "pending",
    }));
    const { error } = await supabase.from("circle_payouts").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Created ${rows.length} payouts`);
    setPreview(null);
    onClose();
  };

  useEffect(() => { if (!open) setPreview(null); }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate payouts</DialogTitle>
          <DialogDescription>Creates pending payout records for matched circle bids.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Period</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. January 2026" />
          </div>
          <div className="space-y-2">
            <Label>Circle tier</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All active circles</SelectItem>
                <SelectItem value="seed">Seed</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
                <SelectItem value="harvest">Harvest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!preview ? (
          <Button onClick={calculate} disabled={busy} className="rounded-2xl bg-gradient-primary text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CalcIcon className="h-4 w-4 mr-2" /> Calculate payouts</>}
          </Button>
        ) : (
          <>
            <div className="rounded-2xl border border-border max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Member</TableHead><TableHead>Circle</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {preview.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No matched bids ready for payout.</TableCell></TableRow>
                  ) : preview.map((p) => (
                    <TableRow key={p.bid_id}>
                      <TableCell>{p.full_name}</TableCell>
                      <TableCell className="capitalize">{p.tier}</TableCell>
                      <TableCell className="text-right">{fmtR(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>Back</Button>
              <Button onClick={confirm} disabled={busy || preview.length === 0} className="bg-primary text-primary-foreground">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create ${preview.length} payouts`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
