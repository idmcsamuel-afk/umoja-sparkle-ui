import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Download, Eye, CheckCircle2, XCircle, ArrowDownToLine, Search,
} from "lucide-react";

type Status = "pending" | "processing" | "processed" | "failed" | "cancelled";

interface Row {
  id: string;
  reference_number: string;
  member_id: string;
  amount_sparks: number;
  amount_r_gross: number;
  amount_r_net: number;
  fee_charged: number;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  branch_code: string | null;
  status: Status;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
  member?: { full_name: string | null; email: string | null; phone: string | null };
  paystack_reference?: string | null;
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  processing: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  processed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

const maskAccount = (n?: string | null) =>
  !n ? "—" : n.length <= 4 ? n : `••••${n.slice(-4)}`;

const maskPhone = (p?: string | null) =>
  !p ? "—" : p.length <= 4 ? p : `••••${p.slice(-4)}`;

const fmtZAR = (n: number) =>
  "R" + Number(n ?? 0).toLocaleString("en-ZA", { maximumFractionDigits: 2 });

export default function AdminWithdrawals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [detail, setDetail] = useState<Row | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: w, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Failed to load withdrawals", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((w ?? []).map((r: any) => r.member_id))).filter(Boolean);
    let memberMap: Record<string, any> = {};
    if (ids.length) {
      const { data: mems } = await supabase
        .from("members")
        .select("id, full_name, email, phone")
        .in("id", ids as string[]);
      (mems ?? []).forEach((m: any) => { memberMap[m.id] = m; });
    }
    setRows((w ?? []).map((r: any) => ({
      ...r,
      member: memberMap[r.member_id],
      paystack_reference: r.reference_number,
    })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-withdrawals-" + Math.random().toString(36).slice(2, 9))
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) =>
        (r.member?.full_name || "").toLowerCase().includes(q) ||
        (r.member?.email || "").toLowerCase().includes(q) ||
        (r.reference_number || "").toLowerCase().includes(q),
      );
    }
    if (from) {
      const f = new Date(from).getTime();
      list = list.filter((r) => new Date(r.created_at).getTime() >= f);
    }
    if (to) {
      const t = new Date(to).getTime() + 86400000;
      list = list.filter((r) => new Date(r.created_at).getTime() < t);
    }
    return list;
  }, [rows, statusFilter, search, from, to]);

  const totals = useMemo(() => {
    const processed = rows.filter((r) => r.status === "processed");
    return {
      processedSparks: processed.reduce((s, r) => s + Number(r.amount_sparks || 0), 0),
      processedZar: processed.reduce((s, r) => s + Number(r.amount_r_net || 0), 0),
      pending: rows.filter((r) => r.status === "pending").length,
      failed: rows.filter((r) => r.status === "failed").length,
      total: rows.length,
    };
  }, [rows]);

  const markProcessed = async (r: Row) => {
    setMarking(r.id);
    const { error } = await supabase
      .from("withdrawal_requests")
      .update({ status: "processed", completed_at: new Date().toISOString() })
      .eq("id", r.id);
    setMarking(null);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Marked as processed" }); load(); }
  };

  const markFailed = async (r: Row) => {
    const reason = prompt("Reason for failure?") || "Manual fail";
    setMarking(r.id);
    const { error } = await supabase
      .from("withdrawal_requests")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", r.id);
    setMarking(null);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Marked as failed" }); load(); }
  };

  const exportCsv = () => {
    const headers = [
      "Timestamp", "Reference", "Member Name", "Email", "Phone",
      "Amount Sparks", "Gross ZAR", "Fee ZAR", "Net ZAR",
      "Status", "Bank", "Account Holder", "Account Number", "Branch Code",
      "Completed At", "Failure Reason",
    ];
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      const cells = [
        r.created_at,
        r.reference_number,
        r.member?.full_name ?? "",
        r.member?.email ?? "",
        r.member?.phone ?? "",
        r.amount_sparks,
        r.amount_r_gross,
        r.fee_charged,
        r.amount_r_net,
        r.status,
        r.bank_name ?? "",
        r.account_holder ?? "",
        r.account_number ?? "",
        r.branch_code ?? "",
        r.completed_at ?? "",
        (r.failure_reason ?? "").replace(/[\r\n,]+/g, " "),
      ];
      lines.push(cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `withdrawals_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowDownToLine className="h-6 w-6 text-primary" /> Withdrawals
          </h1>
          <p className="text-sm text-muted-foreground">
            All spark-to-cash withdrawal requests with full banking details for reconciliation.
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total requests", value: totals.total },
          { label: "Pending", value: totals.pending },
          { label: "Failed", value: totals.failed },
          { label: "Processed net (ZAR)", value: fmtZAR(totals.processedZar) },
        ].map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
            <p className="text-xl font-bold mt-1">{t.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-3 md:p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px] h-9" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px] h-9" />
          {(from || to || search || statusFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setSearch(""); setStatusFilter("all"); }}>
              Clear
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Sparks</TableHead>
                <TableHead className="text-right">Net ZAR</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No withdrawals match these filters.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{r.member?.full_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.member?.email || "—"}</TableCell>
                  <TableCell className="text-right">{Number(r.amount_sparks).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">{fmtZAR(r.amount_r_net)}</TableCell>
                  <TableCell className="text-xs">{r.bank_name || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{maskAccount(r.account_number)}</TableCell>
                  <TableCell className="text-xs font-mono">{r.reference_number}</TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase ${STATUS_TONE[r.status] || ""}`}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(r)} className="h-8 px-2">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {r.status === "pending" && (
                        <>
                          <Button variant="outline" size="sm" disabled={marking === r.id}
                                  onClick={() => markProcessed(r)} className="h-8 px-2 gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Processed
                          </Button>
                          <Button variant="outline" size="sm" disabled={marking === r.id}
                                  onClick={() => markFailed(r)} className="h-8 px-2 gap-1">
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Withdrawal {detail?.reference_number}</DialogTitle>
            <DialogDescription>
              Submitted {detail && new Date(detail.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info label="Member" value={detail.member?.full_name || "—"} />
                <Info label="Email" value={detail.member?.email || "—"} />
                <Info label="Phone" value={detail.member?.phone || "—"} mono />
                <Info label="Status" value={detail.status} />
                <Info label="Sparks" value={Number(detail.amount_sparks).toLocaleString()} />
                <Info label="Gross ZAR" value={fmtZAR(detail.amount_r_gross)} />
                <Info label="Fee" value={fmtZAR(detail.fee_charged)} />
                <Info label="Net ZAR" value={fmtZAR(detail.amount_r_net)} />
              </div>
              <div className="rounded-lg border p-3 space-y-1.5 bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Banking details</p>
                <Info label="Bank" value={detail.bank_name || "—"} />
                <Info label="Account holder" value={detail.account_holder || "—"} />
                <Info label="Account number" value={detail.account_number || "—"} mono />
                <Info label="Branch code" value={detail.branch_code || "—"} mono />
              </div>
              {detail.failure_reason && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs">
                  <span className="font-semibold">Failure reason:</span> {detail.failure_reason}
                </div>
              )}
              {detail.completed_at && (
                <p className="text-xs text-muted-foreground">
                  Completed {new Date(detail.completed_at).toLocaleString()}
                </p>
              )}
              {detail.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => { markProcessed(detail); setDetail(null); }} className="flex-1">
                    Mark as processed
                  </Button>
                  <Button variant="outline" onClick={() => { markFailed(detail); setDetail(null); }}>
                    Mark failed
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
