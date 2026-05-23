import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, RefreshCw, Download, Bell, CheckCircle2, AlertTriangle, AlertCircle, Info,
} from "lucide-react";
import { toast } from "sonner";

const TIER_DAYS: Record<string, number> = { seed: 5, growth: 7, harvest: 14 };

type Row = {
  id: string;
  member_id: string;
  tier: string;
  fiat_amount: number;
  net_amount: number;
  payout_amount: number | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  payment_confirmed_at: string | null;
  payment_completed_at: string | null;
  vault_start: string | null;
  vault_end: string | null;
  created_at: string;
  priority_score: number | null;
  member?: { full_name: string | null; email: string | null; phone: string | null };
};

const fmtR = (n: number) =>
  "R" + Number(n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function timeParts(ms: number) {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  return { d, h, m, neg: ms < 0 };
}

function urgencyTone(msRemaining: number): { label: string; tone: string; pulse: boolean } {
  if (msRemaining < 0) return { label: "Overdue", tone: "bg-red-600 text-white", pulse: true };
  if (msRemaining < 86400000) return { label: "<24h", tone: "bg-red-500 text-white", pulse: false };
  if (msRemaining < 2 * 86400000) return { label: "1-2d", tone: "bg-yellow-500 text-black", pulse: false };
  return { label: "On track", tone: "bg-green-600 text-white", pulse: false };
}

function vaultBounds(r: Row) {
  const start = r.vault_start
    ? new Date(r.vault_start).getTime()
    : (r.payment_confirmed_at ? new Date(r.payment_confirmed_at).getTime() : new Date(r.created_at).getTime());
  const days = TIER_DAYS[r.tier] ?? 7;
  const end = r.vault_end ? new Date(r.vault_end).getTime() : start + days * 86400000;
  return { start, end, days };
}

export default function AdminCircleTracker() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [windowFilter, setWindowFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("remaining");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("circle_bids")
      .select(`
        id, member_id, tier, fiat_amount, net_amount, payout_amount, status,
        payment_status, payment_method, payment_confirmed_at, payment_completed_at,
        vault_start, vault_end, created_at, priority_score,
        member:members!circle_bids_member_id_fkey ( full_name, email, phone )
      `)
      .in("status", ["active", "matched", "payment_pending"])
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Rank by priority within tier
  const rankedRows = useMemo(() => {
    const enriched = rows.map((r) => {
      const { start, end, days } = vaultBounds(r);
      const remainingMs = end - now;
      const elapsedMs = now - start;
      const progress = Math.max(0, Math.min(100, (elapsedMs / (days * 86400000)) * 100));
      return { ...r, _start: start, _end: end, _days: days, _remainingMs: remainingMs, _progress: progress };
    });
    // rank per tier by priority_score desc
    const byTier: Record<string, typeof enriched> = {};
    for (const r of enriched) (byTier[r.tier] ||= []).push(r);
    for (const t in byTier) {
      byTier[t].sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));
      byTier[t].forEach((r, i) => ((r as any)._rank = i + 1));
      byTier[t].forEach((r) => ((r as any)._rankTotal = byTier[t].length));
    }
    return enriched;
  }, [rows, now]);

  const filtered = useMemo(() => {
    let list = rankedRows;
    if (tierFilter !== "all") list = list.filter((r) => r.tier === tierFilter);
    if (statusFilter !== "all") list = list.filter((r) => (r.payment_status || r.status) === statusFilter);
    if (methodFilter !== "all") list = list.filter((r) => (r.payment_method || "manual") === methodFilter);
    if (windowFilter !== "all") {
      list = list.filter((r) => {
        const days = r._remainingMs / 86400000;
        if (windowFilter === "lt1") return days < 1;
        if (windowFilter === "1_3") return days >= 1 && days < 3;
        if (windowFilter === "3_7") return days >= 3 && days < 7;
        if (windowFilter === "7_14") return days >= 7 && days < 14;
        return true;
      });
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((r) =>
        (r.member?.full_name || "").toLowerCase().includes(s) ||
        (r.member?.email || "").toLowerCase().includes(s),
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "priority": return (b.priority_score ?? 0) - (a.priority_score ?? 0);
        case "amount": return Number(b.fiat_amount) - Number(a.fiat_amount);
        case "paid_date": return a._start - b._start;
        case "tier": return a.tier.localeCompare(b.tier);
        case "name": return (a.member?.full_name || "").localeCompare(b.member?.full_name || "");
        default: return a._remainingMs - b._remainingMs;
      }
    });
    return sorted;
  }, [rankedRows, tierFilter, statusFilter, methodFilter, windowFilter, search, sortBy]);

  const alerts = useMemo(() => {
    const overdue = rankedRows.filter((r) => r._remainingMs < 0).length;
    const soon = rankedRows.filter((r) => r._remainingMs >= 0 && r._remainingMs < 6 * 3600000).length;
    const active = rankedRows.length;
    return { overdue, soon, active };
  }, [rankedRows]);

  const queue24h = useMemo(
    () => rankedRows
      .filter((r) => r._remainingMs <= 24 * 3600000)
      .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0)),
    [rankedRows],
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => (s.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id))));

  const exportCsv = () => {
    const headers = ["Member", "Email", "Tier", "Amount", "Net", "PaidAt", "PayoutDue", "RemainingHours", "Priority", "Status", "Method"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push([
        `"${(r.member?.full_name || "").replace(/"/g, "")}"`,
        r.member?.email || "",
        r.tier,
        r.fiat_amount,
        r.net_amount,
        new Date(r._start).toISOString(),
        new Date(r._end).toISOString(),
        Math.round(r._remainingMs / 3600000),
        r.priority_score ?? 0,
        r.payment_status || r.status,
        r.payment_method || "manual",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `circle-tracker-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const markPaid = async (ids: string[]) => {
    if (!ids.length) return;
    const ref = `MANUAL-${Date.now()}`;
    let ok = 0;
    for (const id of ids) {
      const row = rows.find((r) => r.id === id);
      if (!row) continue;
      const amt = Number(row.payout_amount ?? row.net_amount ?? row.fiat_amount);
      const { error } = await supabase.rpc("record_circle_payout", {
        _bid_id: id, _net_amount: amt, _method: "manual", _reference: ref, _paid_on: new Date().toISOString(),
      });
      if (!error) ok++;
    }
    toast.success(`Marked ${ok}/${ids.length} as paid`);
    setSelected(new Set());
    load();
  };

  const sendReminders = async (ids: string[]) => {
    if (!ids.length) return;
    const targets = rows.filter((r) => ids.includes(r.id));
    const inserts = targets.map((r) => ({
      member_id: r.member_id,
      title: "Payout reminder ⏰",
      body: `Your ${r.tier} circle payout is being processed soon.`,
      kind: "circle",
      link: "/circle",
    }));
    const { error } = await supabase.from("notifications").insert(inserts);
    if (error) toast.error(error.message);
    else toast.success(`Sent ${inserts.length} reminders`);
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Circle Payment Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Live countdown, priority scores, and payout queue across all active circles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Alerts */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`flex items-center gap-3 rounded-2xl border p-4 ${alerts.overdue > 0 ? "border-red-500/40 bg-red-500/10" : "border-border bg-card"}`}>
          <AlertCircle className={`h-5 w-5 ${alerts.overdue > 0 ? "text-red-500 animate-pulse" : "text-muted-foreground"}`} />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Urgent</p>
            <p className="text-lg font-semibold">{alerts.overdue} overdue</p>
          </div>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border p-4 ${alerts.soon > 0 ? "border-yellow-500/40 bg-yellow-500/10" : "border-border bg-card"}`}>
          <AlertTriangle className={`h-5 w-5 ${alerts.soon > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Warning</p>
            <p className="text-lg font-semibold">{alerts.soon} due in 6h</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <Info className="h-5 w-5 text-green-500" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
            <p className="text-lg font-semibold">{alerts.active} tracked</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search member…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            <SelectItem value="seed">Seed</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="harvest">Harvest</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="payment_pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            <SelectItem value="paystack">Card</SelectItem>
            <SelectItem value="manual">EFT/Manual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={windowFilter} onValueChange={setWindowFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Time window" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any time</SelectItem>
            <SelectItem value="lt1">&lt; 1 day</SelectItem>
            <SelectItem value="1_3">1–3 days</SelectItem>
            <SelectItem value="3_7">3–7 days</SelectItem>
            <SelectItem value="7_14">7–14 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="remaining">Days remaining</SelectItem>
            <SelectItem value="priority">Priority score</SelectItem>
            <SelectItem value="amount">Amount</SelectItem>
            <SelectItem value="paid_date">Paid date</SelectItem>
            <SelectItem value="tier">Tier</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-accent/40 bg-accent/5 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" onClick={() => markPaid([...selected])}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as Paid
          </Button>
          <Button size="sm" variant="outline" onClick={() => sendReminders([...selected])}>
            <Bell className="h-4 w-4 mr-1" /> Send Reminder
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Main table */}
      <div className="rounded-2xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={selected.size > 0 && selected.size === filtered.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead className="min-w-[220px]">Countdown</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                {loading ? "Loading…" : "No active contributions."}
              </TableCell></TableRow>
            )}
            {filtered.map((r) => {
              const u = urgencyTone(r._remainingMs);
              const tp = timeParts(r._remainingMs);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                  </TableCell>
                  <TableCell>
                    <Link to={`/admin/members?q=${encodeURIComponent(r.member?.email || "")}`}
                          className="text-sm font-medium hover:text-accent">
                      {r.member?.full_name || "—"}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.member?.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.tier}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{fmtR(Number(r.fiat_amount))}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r._start).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-xs font-medium ${u.tone} ${u.pulse ? "animate-pulse" : ""}`}>
                      {tp.neg ? "OVERDUE " : ""}{tp.d}d {tp.h}h {tp.m}m
                    </div>
                    <Progress value={r._progress} className="h-1.5 mt-2 w-44" />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold">{Math.round(r.priority_score ?? 0)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Rank #{(r as any)._rank}/{(r as any)._rankTotal}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {(r.payment_status || r.status || "—").replace("_", " ")}
                    </Badge>
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {r.payment_method || "manual"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => markPaid([r.id])}>Pay</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Payout queue */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ready for Payout · Next 24 hours</h2>
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue24h.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Nothing due in the next 24 hours.
                </TableCell></TableRow>
              )}
              {queue24h.map((r) => {
                const tp = timeParts(r._remainingMs);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{r.member?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.member?.phone || r.member?.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{fmtR(Number(r.payout_amount ?? r.net_amount ?? r.fiat_amount))}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.tier}</Badge></TableCell>
                    <TableCell className={tp.neg ? "text-red-500 font-semibold" : ""}>
                      {tp.neg ? "OVERDUE " : ""}{tp.d}d {tp.h}h {tp.m}m
                    </TableCell>
                    <TableCell>{Math.round(r.priority_score ?? 0)}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => markPaid([r.id])}>Process</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {queue24h.length > 0 && (
            <div className="p-3 border-t border-border flex justify-end">
              <Button onClick={() => markPaid(queue24h.map((r) => r.id))}>
                Process All ({queue24h.length})
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
