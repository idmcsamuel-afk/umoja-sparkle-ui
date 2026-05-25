import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle, Clock, Copy, CreditCard, Eye, EyeOff, Landmark,
  MessageCircle, Search, Send, TrendingUp, Wallet, Download, CheckCircle2,
} from "lucide-react";

type Tier = "seed" | "growth" | "harvest";
const TIER_HOURS: Record<Tier, number> = { seed: 5 * 24, growth: 7 * 24, harvest: 14 * 24 };
const TIER_COLORS: Record<Tier, string> = {
  seed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  growth: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  harvest: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:           { label: "🟢 Active",            cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  vault:            { label: "🟢 Active",            cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  overdue:          { label: "🔴 Overdue",           cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  payment_pending:  { label: "🟡 Pending",           cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  pending:          { label: "🟡 Pending",           cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  paid:             { label: "🟣 Paid",              cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  matched:          { label: "Matched",              cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  rejected:         { label: "⚪ Rejected",          cls: "bg-muted text-muted-foreground" },
  expired:          { label: "Expired",              cls: "bg-muted text-muted-foreground" },
};

const zar = (n: number | null | undefined) =>
  `R${Number(n ?? 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;

type Row = {
  bid_id: string;
  member_id: string;
  tier: Tier;
  fiat_amount: number;
  payout_amount: number | null;
  net_amount: number | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  paystack_reference: string | null;
  payment_ref: string | null;
  // USDT
  payment_crypto_txhash: string | null;
  payment_crypto_network: string | null;
  payment_crypto_address: string | null;
  amount_usdt: number | null;
  amount_usdt_received: number | null;
  vault_start: string | null;
  vault_end: string | null;
  days_waiting: number | null;
  bid_created: string;
  payment_confirmed_at: string | null;
  payout_date: string | null;
  // member
  full_name: string;
  email: string | null;
  phone: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_branch: string | null;
  // scores
  priority_score: number;
  consistency_score: number;
  time_waiting_score: number;
  contribution_volume_score: number;
  community_score: number;
  bid_boost_score: number;
  // banking details (verified)
  bd_bank_name: string | null;
  bd_account_holder: string | null;
  bd_account_number: string | null;
  bd_branch: string | null;
  // derived
  hours_remaining: number | null;
  days_remaining: number | null;
  priority_rank: number;
  total_in_tier: number;
};

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(
    () => toast({ title: label, description: text }),
    () => toast({ title: "Copy failed", variant: "destructive" }),
  );
}

function mask(acct: string | null | undefined) {
  if (!acct) return "—";
  const s = String(acct);
  return s.length <= 4 ? `****${s}` : `****${s.slice(-4)}`;
}

function CountdownCell({ hours, tier }: { hours: number | null; tier: Tier }) {
  if (hours === null) return <span className="text-muted-foreground text-xs">—</span>;
  const total = TIER_HOURS[tier];
  const elapsed = total - hours;
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));

  let color = "text-emerald-600";
  let bar = "bg-emerald-500";
  let label: React.ReactNode;

  if (hours < 0) {
    color = "text-destructive animate-pulse";
    bar = "bg-destructive";
    label = <>⚠️ OVERDUE {Math.abs(Math.floor(hours))}h</>;
  } else if (hours < 24) {
    color = "text-orange-600";
    bar = "bg-orange-500";
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    label = `${h}h ${m}m`;
  } else if (hours < 48) {
    color = "text-yellow-600";
    bar = "bg-yellow-500";
    const d = Math.floor(hours / 24);
    const h = Math.floor(hours - d * 24);
    label = `${d}d ${h}h`;
  } else {
    const d = Math.floor(hours / 24);
    const h = Math.floor(hours - d * 24);
    label = `${d}d ${h}h`;
  }

  return (
    <div className="min-w-[120px]">
      <div className={`text-xs font-medium ${color}`}>{label}</div>
      <div className="h-1.5 w-full rounded-full bg-muted mt-1 overflow-hidden">
        <div className={`h-full ${bar} transition-all`} style={{ width: `${hours < 0 ? 100 : pct}%` }} />
      </div>
    </div>
  );
}

function BankingCell({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const bank = row.bd_bank_name || row.bank_name || "—";
  const acct = row.bd_account_number || row.bank_account || "";
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1 text-xs">
        <span className="font-medium">{bank}</span>
        <span className="text-muted-foreground">|</span>
        <span className="font-mono">{mask(acct)}</span>
        <CollapsibleTrigger asChild>
          <Button size="icon" variant="ghost" className="h-6 w-6">
            {open ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-2 rounded-md border bg-muted/30 p-2 text-xs space-y-1">
        <div><span className="text-muted-foreground">Bank:</span> {bank}</div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Account:</span>
          <span className="font-mono">{acct || "—"}</span>
          {acct && (
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copy(acct, "Account copied")}>
              <Copy className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div><span className="text-muted-foreground">Holder:</span> {row.bd_account_holder || row.full_name}</div>
        <div><span className="text-muted-foreground">Branch:</span> {row.bd_branch || row.bank_branch || "—"}</div>
        <div><span className="text-muted-foreground">Method:</span> {row.payment_method || "—"}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function AdminCircleTracker() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("due");
  const [quickTab, setQuickTab] = useState<string>("overdue");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [breakdownRow, setBreakdownRow] = useState<Row | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: bids, error } = await supabase
      .from("circle_bids")
      .select(`
        id, member_id, tier, fiat_amount, payout_amount, net_amount, status,
        payment_status, payment_method, payment_reference, paystack_reference, payment_ref,
        payment_crypto_txhash, payment_crypto_network, payment_crypto_address,
        amount_usdt, amount_usdt_received,
        vault_start, vault_end, days_waiting, created_at, payment_confirmed_at, payout_date,
        members:member_id (
          id, full_name, email, phone, bank_name, bank_account, bank_branch,
          priority_score, consistency_score, time_waiting_score,
          contribution_volume_score, community_score, bid_boost_score
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const memberIds = Array.from(new Set((bids ?? []).map((b: any) => b.member_id).filter(Boolean)));
    let banking: Record<string, any> = {};
    if (memberIds.length) {
      const { data: bds } = await supabase
        .from("member_banking_details")
        .select("member_id, bank_name, account_holder_name, account_number, branch_code")
        .in("member_id", memberIds);
      (bds ?? []).forEach((b: any) => { banking[b.member_id] = b; });
    }

    const mapped: Row[] = (bids ?? []).map((b: any) => {
      const m = b.members || {};
      const bd = banking[b.member_id] || {};
      const hours_remaining = b.vault_end
        ? (new Date(b.vault_end).getTime() - Date.now()) / 3_600_000
        : null;

      // Calculated score (same formula as get_my_circle_queue_status)
      const fiat = Number(b.fiat_amount ?? 0);
      const volumeFallback =
        fiat >= 10000 ? 10 : fiat >= 5000 ? 7 : fiat >= 2000 ? 5 : fiat >= 500 ? 3 : 1;
      const consistency_score = Number(m.consistency_score) || 40;
      const time_waiting_score = Number(m.time_waiting_score) || 0;
      const contribution_volume_score = Number(m.contribution_volume_score) || volumeFallback;
      const community_score = Number(m.community_score) || 10;
      const bid_boost_score = Number(m.bid_boost_score) || 0;
      const calc_score =
        consistency_score + time_waiting_score + contribution_volume_score +
        community_score + bid_boost_score;

      return {
        bid_id: b.id,
        member_id: b.member_id,
        tier: (b.tier || "seed") as Tier,
        fiat_amount: fiat,
        payout_amount: b.payout_amount,
        net_amount: b.net_amount,
        status: b.status,
        payment_status: b.payment_status,
        payment_method: b.payment_method,
        payment_reference: b.payment_reference,
        paystack_reference: b.paystack_reference,
        payment_ref: b.payment_ref,
        payment_crypto_txhash: b.payment_crypto_txhash ?? null,
        payment_crypto_network: b.payment_crypto_network ?? null,
        payment_crypto_address: b.payment_crypto_address ?? null,
        amount_usdt: b.amount_usdt ?? null,
        amount_usdt_received: b.amount_usdt_received ?? null,
        vault_start: b.vault_start,
        vault_end: b.vault_end,
        days_waiting: b.days_waiting,
        bid_created: b.created_at,
        payment_confirmed_at: b.payment_confirmed_at,
        payout_date: b.payout_date ?? null,
        full_name: m.full_name || "Member",
        email: m.email,
        phone: m.phone,
        bank_name: m.bank_name,
        bank_account: m.bank_account,
        bank_branch: m.bank_branch,
        priority_score: calc_score,
        consistency_score,
        time_waiting_score,
        contribution_volume_score,
        community_score,
        bid_boost_score,
        bd_bank_name: bd.bank_name ?? null,
        bd_account_holder: bd.account_holder_name ?? null,
        bd_account_number: bd.account_number ?? null,
        bd_branch: bd.branch_code ?? null,
        hours_remaining,
        days_remaining: hours_remaining !== null ? Math.floor(hours_remaining / 24) : null,
        priority_rank: 0,
        total_in_tier: 0,
      };
    });

    // ranking within tier (vault only — matches user-facing queue)
    (["seed", "growth", "harvest"] as Tier[]).forEach((t) => {
      const inTier = mapped.filter((r) => r.tier === t && r.status === "vault" && r.vault_start);
      inTier.sort((a, b) =>
        b.priority_score - a.priority_score ||
        new Date(a.bid_created).getTime() - new Date(b.bid_created).getTime()
      );
      inTier.forEach((r, i) => { r.priority_rank = i + 1; r.total_in_tier = inTier.length; });
    });

    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase
      .channel("admin-circle-tracker")
      .on("postgres_changes", { event: "*", schema: "public", table: "circle_bids" }, () => fetchData())
      .subscribe();
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute hours_remaining on tick
  const ticked = useMemo(() => rows.map((r) => ({
    ...r,
    hours_remaining: r.vault_end ? (new Date(r.vault_end).getTime() - now) / 3_600_000 : null,
  })), [rows, now]);

  const filtered = useMemo(() => {
    let list = ticked.slice();
    if (tierFilter !== "all") list = list.filter((r) => r.tier === tierFilter);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (methodFilter !== "all") list = list.filter((r) => (r.payment_method || "").toLowerCase() === methodFilter);

    if (quickTab === "active")
      list = list.filter((r) => r.status === "vault" && r.hours_remaining !== null && r.hours_remaining >= 0);
    else if (quickTab === "overdue")
      list = list.filter((r) => r.status === "vault" && r.hours_remaining !== null && r.hours_remaining < 0);
    else if (quickTab === "paid")
      list = list.filter((r) => r.status === "paid");
    else if (quickTab === "pending")
      list = list.filter((r) => r.status === "pending" || r.status === "payment_pending");
    else if (quickTab === "rejected")
      list = list.filter((r) => r.status === "rejected");
    else if (quickTab === "expired")
      list = list.filter((r) => r.status === "expired");

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        [r.full_name, r.email, r.phone, r.payment_reference, r.paystack_reference, r.payment_ref]
          .filter(Boolean).some((x) => String(x).toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === "due") {
        const ah = a.hours_remaining ?? Infinity;
        const bh = b.hours_remaining ?? Infinity;
        return ah - bh;
      }
      if (sortBy === "score") return b.priority_score - a.priority_score;
      if (sortBy === "amount") return b.fiat_amount - a.fiat_amount;
      return 0;
    });

    return list;
  }, [ticked, tierFilter, statusFilter, methodFilter, sortBy, quickTab, search]);

  const counts = useMemo(() => ({
    all: ticked.length,
    active: ticked.filter((r) => r.status === "vault" && r.hours_remaining !== null && r.hours_remaining >= 0).length,
    overdue: ticked.filter((r) => r.status === "vault" && r.hours_remaining !== null && r.hours_remaining < 0).length,
    paid: ticked.filter((r) => r.status === "paid").length,
    pending: ticked.filter((r) => r.status === "pending" || r.status === "payment_pending").length,
    rejected: ticked.filter((r) => r.status === "rejected").length,
    expired: ticked.filter((r) => r.status === "expired").length,
    due_today: ticked.filter((r) => r.hours_remaining !== null && r.hours_remaining >= 0 && r.hours_remaining <= 24).length,
  }), [ticked]);

  const stats = useMemo(() => {
    const activeVault = ticked.filter((r) => ["active", "vault"].includes(r.status));
    const totalPooled = activeVault.reduce((s, r) => s + r.fiat_amount, 0);
    const avgScore = activeVault.length
      ? activeVault.reduce((s, r) => s + r.priority_score, 0) / activeVault.length
      : 0;
    return {
      activeVault: activeVault.length,
      dueToday: counts.due_today,
      totalPooled,
      avgScore: avgScore.toFixed(1),
    };
  }, [ticked, counts]);

  const queue = useMemo(() =>
    ticked
      .filter((r) => ["active", "vault"].includes(r.status) && r.hours_remaining !== null && r.hours_remaining < 24)
      .sort((a, b) => (a.hours_remaining ?? 0) - (b.hours_remaining ?? 0))
      .slice(0, 10),
    [ticked]
  );

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((r) => r.bid_id)));
    else setSelected(new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    const s = new Set(selected);
    if (checked) s.add(id); else s.delete(id);
    setSelected(s);
  };

  const exportCsv = () => {
    const list = filtered.filter((r) => selected.size === 0 || selected.has(r.bid_id));
    const headers = ["Name", "Bank", "Account", "Branch", "Amount", "Reference", "Phone"];
    const lines = [headers.join(",")];
    list.forEach((r) => {
      lines.push([
        r.full_name,
        r.bd_bank_name || r.bank_name || "",
        r.bd_account_number || r.bank_account || "",
        r.bd_branch || r.bank_branch || "",
        r.payout_amount ?? r.net_amount ?? r.fiat_amount,
        r.payment_reference || r.paystack_reference || r.payment_ref || "",
        r.phone || "",
      ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `circle-payouts-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const markBidPaid = async (
    row: Row,
    amount: number,
    ref: string,
  ): Promise<string | null> => {
    const { error: rpcError } = await supabase.rpc("record_circle_payout", {
      _bid_id: row.bid_id,
      _net_amount: amount,
      _method: row.payment_method || "manual",
      _reference: ref,
    } as any);
    if (!rpcError) return null;
    console.error("record_circle_payout failed", rpcError);
    // Fallback: direct update (requires admin RLS UPDATE policy)
    const { error: updError } = await supabase
      .from("circle_bids")
      .update({
        status: "paid",
        payout_amount: amount,
        payout_date: new Date().toISOString(),
        payment_ref: ref,
      } as any)
      .eq("id", row.bid_id);
    if (updError) {
      console.error("circle_bids update failed", updError);
      return rpcError.message || updError.message;
    }
    return null;
  };

  const processSelectedPayouts = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Mark ${ids.length} bid(s) as paid?`)) return;
    let ok = 0;
    let firstError: string | null = null;
    for (const id of ids) {
      const row = ticked.find((r) => r.bid_id === id);
      if (!row) continue;
      const amount = row.payout_amount ?? row.net_amount ?? row.fiat_amount;
      const ref = row.payment_reference || row.paystack_reference || row.payment_ref || `MANUAL-${id.slice(0, 8)}`;
      const err = await markBidPaid(row, amount, ref);
      if (err) { if (!firstError) firstError = err; } else { ok++; }
    }
    if (ok > 0) toast({ title: "✅ Payment marked as complete", description: `${ok} bid(s) updated` });
    if (firstError) toast({ title: "Some payouts failed", description: firstError, variant: "destructive" });
    setSelected(new Set());
    fetchData();
  };

  const sendReminders = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const inserts = ids.map((id) => {
      const r = ticked.find((x) => x.bid_id === id)!;
      return {
        member_id: r.member_id,
        title: "Payout reminder",
        body: `Your ${r.tier} contribution payout is being prepared.`,
        kind: "payout",
        link: "/circle",
      };
    });
    const { error } = await supabase.from("notifications").insert(inserts as any);
    if (error) toast({ title: "Reminder failed", description: error.message, variant: "destructive" });
    else toast({ title: "Reminders sent", description: `${ids.length} member(s)` });
  };

  const refFor = (r: Row) =>
    r.payment_reference || r.paystack_reference || r.payment_ref || "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Clock className="h-7 w-7" /> Circle Payment Tracker
        </h1>
        <p className="text-muted-foreground">Real-time visibility into all active contributions, payouts & priority scores.</p>
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        {counts.overdue > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> URGENT: {counts.overdue} payout(s) overdue
          </div>
        )}
        {counts.due_today > 0 && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
            <Clock className="h-4 w-4" /> WARNING: {counts.due_today} payout(s) due in next 24 hours
          </div>
        )}
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> INFO: {stats.activeVault} active contributions being tracked
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active Vault</div><div className="text-2xl font-bold">{stats.activeVault}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Due Today</div><div className="text-2xl font-bold">{stats.dueToday}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Pooled</div><div className="text-2xl font-bold">{zar(stats.totalPooled)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Avg Score</div><div className="text-2xl font-bold">{stats.avgScore}</div></CardContent></Card>
      </div>

      {/* Payout queue */}
      {queue.length > 0 && (
        <Card className="border-orange-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              🔥 Ready for Payout (Next 24 Hours) — {queue.length} member{queue.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {queue.map((r, i) => {
              const amount = r.payout_amount ?? r.net_amount ?? r.fiat_amount;
              const rawBank = r.bd_bank_name || r.bank_name || "";
              const bankMissing = !rawBank || rawBank.trim().toLowerCase() === "other";
              const bank = bankMissing ? "⚠️ Bank missing" : rawBank;
              const acct = r.bd_account_number || r.bank_account || "";
              const ref = refFor(r);
              return (
                <div key={r.bid_id} className={`rounded-md border bg-card p-3 ${bankMissing ? "border-destructive/40" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`text-sm font-medium ${bankMissing ? "text-destructive" : ""}`}>
                      #{i + 1}. {r.full_name} — {zar(amount)} — {bank} {mask(acct)} — Score {r.priority_score.toFixed(0)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => copy(`${r.full_name}\n${bank}\n${acct}\n${r.bd_branch || r.bank_branch || ""}\n${zar(amount)}\nRef: ${ref}`, "Bank details copied")}>
                        <Copy className="h-3 w-3" /> Copy Bank Details
                      </Button>
                      <Button size="sm" onClick={async () => {
                        const err = await markBidPaid(r, amount, ref);
                        if (err) toast({ title: "Payout failed", description: err, variant: "destructive" });
                        else toast({ title: "✅ Payment marked as complete" });
                        fetchData();
                      }}>
                        <Wallet className="h-3 w-3" /> Process Payout
                      </Button>
                      {r.phone && (
                        <Button size="sm" variant="outline" onClick={() => window.open(`https://wa.me/${r.phone!.replace(/\D/g, "")}`)}>
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Due: {r.hours_remaining !== null ? `${Math.max(0, Math.floor(r.hours_remaining))}h ${Math.max(0, Math.floor(((r.hours_remaining) - Math.floor(r.hours_remaining)) * 60))}m` : "—"} · Ref: {ref}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Filters & search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, reference..." className="pl-8" />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="seed">Seed</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="harvest">Harvest</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="vault">Vault</SelectItem>
            <SelectItem value="payment_pending">Payment Pending</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="paystack">💳 Card</SelectItem>
            <SelectItem value="card">💳 Card (legacy)</SelectItem>
            <SelectItem value="eft">🏦 EFT</SelectItem>
            <SelectItem value="usdt">💰 USDT</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="due">Sort: Payout Due</SelectItem>
            <SelectItem value="score">Sort: Priority Score</SelectItem>
            <SelectItem value="amount">Sort: Amount</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick tabs */}
      <Tabs value={quickTab} onValueChange={setQuickTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="active" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-700">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="overdue" className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-700">Overdue ({counts.overdue})</TabsTrigger>
          <TabsTrigger value="paid" className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-700">Paid ({counts.paid})</TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-500/15 data-[state=active]:text-yellow-700">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          <TabsTrigger value="expired" className="data-[state=active]:bg-muted data-[state=active]:text-muted-foreground">⏰ Expired ({counts.expired})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3 w-3" /> Export Selected</Button>
          <Button size="sm" onClick={processSelectedPayouts}><Wallet className="h-3 w-3" /> Process Payouts</Button>
          <Button size="sm" variant="outline" onClick={sendReminders}><Send className="h-3 w-3" /> Send Reminders</Button>
        </div>
      )}

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.bid_id))}
                    onCheckedChange={(c) => toggleAll(!!c)}
                  />
                </TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Contributed</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Time Remaining</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Banking</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No contributions match these filters.</TableCell></TableRow>
              )}
              {filtered.map((r) => {
                const payout = r.payout_amount ?? r.net_amount ?? r.fiat_amount;
                const diff = payout - r.fiat_amount;
                 const isOverdue = r.status === "vault" && r.hours_remaining !== null && r.hours_remaining < 0;
                 const status = isOverdue
                   ? STATUS_BADGE.overdue
                   : STATUS_BADGE[r.status] || { label: r.status, cls: "bg-muted text-muted-foreground" };
                const ref = refFor(r);
                return (
                  <TableRow key={r.bid_id}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.bid_id)} onCheckedChange={(c) => toggleOne(r.bid_id, !!c)} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={TIER_COLORS[r.tier]} variant="outline">{r.tier}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {zar(r.fiat_amount)}
                      {r.payment_method === "usdt" && r.amount_usdt && (
                        <div className="text-xs text-muted-foreground">
                          ${Number(r.amount_usdt).toFixed(2)} USDT
                          {r.amount_usdt_received != null && Number(r.amount_usdt_received) > 0 && (
                            <> · got ${Number(r.amount_usdt_received).toFixed(2)}
                              {Number(r.amount_usdt_received) < Number(r.amount_usdt) && (
                                <span className="text-orange-600"> (−${(Number(r.amount_usdt) - Number(r.amount_usdt_received)).toFixed(2)} fee)</span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{zar(payout)}</div>
                      {diff > 0 && <div className="text-xs text-emerald-600">+{zar(diff)}</div>}
                    </TableCell>
                    <TableCell><Badge className={status.cls} variant="outline">{status.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        {r.payment_method === "usdt"
                          ? <>💰 <span>USDT</span></>
                          : r.payment_method === "eft"
                          ? <><Landmark className="h-3 w-3" /> EFT</>
                          : r.payment_method === "paystack" || r.payment_method === "card"
                          ? <><CreditCard className="h-3 w-3" /> Card</>
                          : <>{r.payment_method || "—"}</>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.payment_method === "usdt" && r.payment_crypto_txhash ? (
                        <a
                          href={`https://tronscan.org/#/transaction/${r.payment_crypto_txhash}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs font-mono hover:underline text-primary"
                          title={r.payment_crypto_txhash}
                        >
                          {r.payment_crypto_txhash.slice(0, 8)}…{r.payment_crypto_txhash.slice(-4)} ↗
                        </a>
                      ) : ref !== "—" ? (
                        <button onClick={() => copy(ref, "Reference copied")} className="text-xs font-mono hover:underline flex items-center gap-1">
                          {ref.length > 14 ? `${ref.slice(0, 12)}…` : ref}
                          <Copy className="h-3 w-3" />
                        </button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {r.status === "paid" ? (
                        <div className="text-xs">
                          <div className="font-medium text-purple-600 dark:text-purple-400">Paid</div>
                          <div className="text-muted-foreground">
                            {r.payout_date ? new Date(r.payout_date).toLocaleDateString() : "—"}
                          </div>
                        </div>
                      ) : (
                        <CountdownCell hours={r.hours_remaining} tier={r.tier} />
                      )}
                    </TableCell>
                    <TableCell>
                      <button className="text-left text-xs hover:underline" onClick={() => setBreakdownRow(r)}>
                        <div className="font-medium flex items-center gap-1"><TrendingUp className="h-3 w-3" />{r.priority_score.toFixed(0)}/100</div>
                        <div className="text-muted-foreground">#{r.priority_rank || "—"} of {r.total_in_tier || "—"}</div>
                      </button>
                    </TableCell>
                    <TableCell><BankingCell row={r} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.payment_method === "usdt" && (r.status === "pending" || r.status === "payment_pending") && (
                          <Button size="sm" variant="outline" onClick={async () => {
                            const hash = window.prompt("Paste TRC20 transaction hash to verify:");
                            if (!hash) return;
                            const { data, error } = await supabase.functions.invoke("usdt-verify-tx", {
                              body: { bidId: r.bid_id, txHash: hash.trim().replace(/^0x/, "") },
                            });
                            if (error || !(data as any)?.ok) {
                              const code = (data as any)?.error ?? error?.message ?? "verify_failed";
                              toast({ title: "USDT verification failed", description: String(code), variant: "destructive" });
                            } else {
                              toast({ title: "✅ USDT payment confirmed", description: `${(data as any).usdt_amount} USDT` });
                              fetchData();
                            }
                          }}>Verify USDT</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={async () => {
                          const amt = payout;
                          const refUsed = ref === "—" ? `MANUAL-${r.bid_id.slice(0, 8)}` : ref;
                          const err = await markBidPaid(r, amt, refUsed);
                          if (err) toast({ title: "Payout failed", description: err, variant: "destructive" });
                          else toast({ title: "✅ Payment marked as complete" });
                          fetchData();
                        }}>Pay</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((r) => {
          const payout = r.payout_amount ?? r.net_amount ?? r.fiat_amount;
          const diff = payout - r.fiat_amount;
          const status = STATUS_BADGE[r.status] || { label: r.status, cls: "" };
          return (
            <Card key={r.bid_id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.full_name}</div>
                  <Badge className={TIER_COLORS[r.tier]} variant="outline">{r.tier}</Badge>
                </div>
                <div className="text-sm">{zar(r.fiat_amount)} → {zar(payout)} {diff > 0 && <span className="text-emerald-600">(+{zar(diff)})</span>}</div>
                <CountdownCell hours={r.hours_remaining} tier={r.tier} />
                <div className="flex items-center justify-between text-xs">
                  <button onClick={() => setBreakdownRow(r)} className="hover:underline">
                    Score: {r.priority_score.toFixed(0)} (#{r.priority_rank || "—"} of {r.total_in_tier || "—"})
                  </button>
                  <Badge className={status.cls} variant="outline">{status.label}</Badge>
                </div>
                <BankingCell row={r} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Score breakdown modal */}
      <Dialog open={!!breakdownRow} onOpenChange={(o) => !o && setBreakdownRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Priority Score Breakdown</DialogTitle></DialogHeader>
          {breakdownRow && (
            <div className="space-y-2 text-sm">
              <div className="text-muted-foreground">{breakdownRow.full_name} · {breakdownRow.tier}</div>
              <div className="space-y-1 border-t pt-2">
                <div className="flex justify-between"><span>Consistency</span><span className="font-mono">{breakdownRow.consistency_score.toFixed(1)} pts</span></div>
                <div className="flex justify-between"><span>Time waiting</span><span className="font-mono">{breakdownRow.time_waiting_score.toFixed(1)} pts</span></div>
                <div className="flex justify-between"><span>Contribution volume</span><span className="font-mono">{breakdownRow.contribution_volume_score.toFixed(1)} pts</span></div>
                <div className="flex justify-between"><span>Community</span><span className="font-mono">{breakdownRow.community_score.toFixed(1)} pts</span></div>
                <div className="flex justify-between"><span>Bid boost</span><span className="font-mono">{breakdownRow.bid_boost_score.toFixed(1)} pts</span></div>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>TOTAL</span><span className="font-mono">{breakdownRow.priority_score.toFixed(1)} pts</span>
              </div>
              <div className="text-muted-foreground text-xs">Current rank: #{breakdownRow.priority_rank} of {breakdownRow.total_in_tier}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
