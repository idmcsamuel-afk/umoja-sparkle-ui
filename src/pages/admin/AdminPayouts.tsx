import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, ShieldAlert, ShieldCheck, Download, Search, Copy, Inbox } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const PLATFORM_FEE = 0.02;
const UBUNTU_FUND = 0.03;

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
  allocated_at: string | null;
  priority_score: number | null;
  payment_ref: string | null;
  member?: { full_name: string; email: string | null; phone: string; kyc_level: number; bank_name: string | null; bank_account: string | null; branch_code?: string | null; account_holder?: string | null };
}

const daysBetween = (iso?: string | null) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0;

export default function AdminPayouts() {
  const [pending, setPending] = useState<Bid[]>([]);
  const [paid, setPaid] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<Bid | null>(null);
  const [busy, setBusy] = useState(false);

  // Mark-paid form
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"EFT" | "Cash" | "Paystack">("EFT");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [confirmCheck, setConfirmCheck] = useState(false);

  // Filters
  const [tierFilter, setTierFilter] = useState<"all" | "seed" | "growth" | "harvest">("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<"7" | "30" | "90" | "all">("30");

  const load = async () => {
    setLoading(true);
    const [{ data: matched }, { data: paidRows }] = await Promise.all([
      supabase.from("circle_bids")
        .select("id, member_id, tier, fiat_amount, net_amount, payout_amount, payout_date, status, vault_end, allocated_at, priority_score, payment_ref")
        .eq("status", "matched")
        .order("priority_score", { ascending: false, nullsFirst: false })
        .limit(300),
      supabase.from("circle_bids")
        .select("id, member_id, tier, fiat_amount, net_amount, payout_amount, payout_date, status, vault_end, allocated_at, priority_score, payment_ref")
        .eq("status", "paid")
        .order("payout_date", { ascending: false })
        .limit(200),
    ]);
    const all = [...(matched ?? []), ...(paidRows ?? [])];
    const ids = Array.from(new Set(all.map((b: any) => b.member_id)));
    let mm = new Map<string, any>();
    if (ids.length) {
      const { data: members } = await supabase.from("members")
        .select("id, full_name, email, phone, kyc_level, bank_name, bank_account, bank_branch").in("id", ids);
      mm = new Map((members ?? []).map((m: any) => [m.id, m]));
    }
    const join = (rows: any[]) => rows.map((b) => ({ ...b, member: mm.get(b.member_id) })) as Bid[];
    setPending(join(matched ?? []));
    setPaid(join(paidRows ?? []));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pending.filter(b =>
      (tierFilter === "all" || b.tier === tierFilter) &&
      (q === "" || (b.member?.full_name?.toLowerCase().includes(q) ?? false))
    );
  }, [pending, tierFilter, search]);

  const paidFiltered = useMemo(() => {
    if (dateRange === "all") return paid;
    const days = Number(dateRange);
    const cutoff = Date.now() - days * 86400000;
    return paid.filter(b => b.payout_date && new Date(b.payout_date).getTime() >= cutoff);
  }, [paid, dateRange]);

  const kpis = useMemo(() => {
    const gross = pending.reduce((s, b) => s + Number(b.fiat_amount ?? 0), 0);
    const net = pending.reduce((s, b) => s + Number(b.payout_amount ?? b.net_amount ?? 0), 0);
    const platform = +(gross * PLATFORM_FEE).toFixed(2);
    const ubuntu = +(gross * UBUNTU_FUND).toFixed(2);
    const oldest = pending.reduce((m, b) => Math.max(m, daysBetween(b.allocated_at)), 0);
    return { net, platform, ubuntu, oldest, count: pending.length };
  }, [pending]);

  const openConfirm = (b: Bid) => {
    if ((b.member?.kyc_level ?? 0) < 3) {
      toast.error("Member not KYC verified — cannot process payout.");
      return;
    }
    const gross = Number(b.fiat_amount ?? 0);
    const net = +(gross * (1 - PLATFORM_FEE - UBUNTU_FUND)).toFixed(2);
    setPayAmount(String(b.payout_amount ?? net));
    setPayMethod("EFT");
    setPayRef("");
    setPayDate(new Date().toISOString().slice(0, 10));
    setConfirmCheck(false);
    setConfirm(b);
  };

  const markPaid = async () => {
    if (!confirm) return;
    if (!confirmCheck) return toast.error("Please confirm the payment was made");
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    if (!payRef.trim()) return toast.error("Enter a payment reference");
    setBusy(true);
    const { error } = await supabase.rpc("record_circle_payout", {
      _bid_id: confirm.id,
      _net_amount: amt,
      _method: payMethod,
      _reference: payRef.trim(),
      _paid_on: new Date(payDate).toISOString(),
    });
    if (!error && confirm.member?.email) {
      supabase.functions.invoke("send-email", {
        body: {
          template: "allocation_winner",
          to: confirm.member.email,
          member_id: confirm.member_id,
          bypass_prefs: true,
          data: {
            name: confirm.member.full_name,
            circle_name: `${confirm.tier} Circle`,
            amount: Math.round(amt).toLocaleString("en-ZA"),
            payout_date: new Date(payDate).toLocaleDateString("en-ZA"),
          },
        },
      }).catch(() => {});
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Payment recorded for ${confirm.member?.full_name ?? "member"}`);
    setConfirm(null);
    load();
  };

  const exportCsv = () => {
    const rows = [["Date", "Member", "Tier", "Amount", "Method/Ref"]];
    paid.forEach((b) => {
      rows.push([
        b.payout_date ? new Date(b.payout_date).toLocaleDateString() : "",
        b.member?.full_name ?? b.member_id,
        b.tier,
        String(b.payout_amount ?? b.net_amount ?? ""),
        b.payment_ref ?? "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `umoja-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Manual payouts</h1>
      <p className="text-sm text-muted-foreground mt-1">Track, calculate fees, and record member payouts.</p>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Total pending (net)", value: fmtR(kpis.net) },
          { label: "Members waiting", value: String(kpis.count) },
          { label: "Oldest pending", value: `${kpis.oldest}d` },
          { label: "Platform fees due", value: fmtR(kpis.platform) },
          { label: "Ubuntu fund due", value: fmtR(kpis.ubuntu) },
        ].map((k) => (
          <div key={k.label} className="rounded-3xl border border-border bg-gradient-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-2 font-display text-2xl text-gradient-gold">{k.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="pending" className="mt-6">
        <TabsList className="rounded-2xl bg-secondary/60 p-1 h-12">
          <TabsTrigger value="pending" className="rounded-xl px-5">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="paid" className="rounded-xl px-5">Paid history ({paid.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search member name…" className="pl-9 h-10 rounded-xl" />
            </div>
            <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as any)} className="h-10 rounded-xl border border-border bg-secondary/60 px-3 text-sm">
              <option value="all">All tiers</option>
              <option value="seed">Seed</option>
              <option value="growth">Growth</option>
              <option value="harvest">Harvest</option>
            </select>
          </div>

          {loading ? (
            <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-3xl border border-border bg-gradient-card overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                    <th className="text-left p-3">Member</th>
                    <th className="text-left p-3">Tier</th>
                    <th className="text-right p-3">Gross</th>
                    <th className="text-right p-3">Fees</th>
                    <th className="text-right p-3">Net payout</th>
                    <th className="text-left p-3">Matched</th>
                    <th className="text-right p-3">Score</th>
                    <th className="text-left p-3">Bank</th>
                    <th className="text-right p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const gross = Number(r.fiat_amount ?? 0);
                    const platform = +(gross * PLATFORM_FEE).toFixed(2);
                    const ubuntu = +(gross * UBUNTU_FUND).toFixed(2);
                    const net = Number(r.payout_amount ?? r.net_amount ?? +(gross * 0.95).toFixed(2));
                    const verified = (r.member?.kyc_level ?? 0) >= 3;
                    return (
                      <tr key={r.id} className="border-b border-border/50 last:border-0">
                        <td className="p-3">
                          <div className="font-medium">{r.member?.full_name ?? r.member_id.slice(0, 8) + "…"}</div>
                          <div className="text-[11px] text-muted-foreground">{r.member?.email ?? r.member?.phone}</div>
                        </td>
                        <td className="p-3 capitalize">{r.tier}</td>
                        <td className="p-3 text-right">{fmtR(gross)}</td>
                        <td className="p-3 text-right text-[11px] text-muted-foreground">
                          <div>−{fmtR(platform)} platform</div>
                          <div>−{fmtR(ubuntu)} ubuntu</div>
                        </td>
                        <td className="p-3 text-right text-accent-soft font-medium">{fmtR(net)}</td>
                        <td className="p-3 text-xs">
                          {r.allocated_at ? new Date(r.allocated_at).toLocaleDateString() : "—"}
                          <div className="text-muted-foreground">{daysBetween(r.allocated_at)}d ago</div>
                        </td>
                        <td className="p-3 text-right">{r.priority_score != null ? Number(r.priority_score).toFixed(1) : "—"}</td>
                        <td className="p-3 text-[11px]">
                          <div>{r.member?.bank_name ?? "—"}</div>
                          <div className="text-muted-foreground">{r.member?.bank_account ? "•••• " + r.member.bank_account.slice(-4) : ""}</div>
                        </td>
                        <td className="p-3 text-right">
                          {verified ? (
                            <Button size="sm" className="bg-gradient-gold text-amber-950 hover:opacity-95" onClick={() => openConfirm(r)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark paid
                            </Button>
                          ) : (
                            <span className="text-[11px] text-destructive inline-flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" /> Not verified
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">No pending payouts.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="paid" className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="h-10 rounded-xl border border-border bg-secondary/60 px-3 text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <Button variant="outline" onClick={exportCsv} className="rounded-xl">
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          </div>
          <div className="rounded-3xl border border-border bg-gradient-card overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                  <th className="text-left p-3">Paid date</th>
                  <th className="text-left p-3">Member</th>
                  <th className="text-left p-3">Tier</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-left p-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {paidFiltered.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3 text-xs">{r.payout_date ? new Date(r.payout_date).toLocaleString() : "—"}</td>
                    <td className="p-3">{r.member?.full_name ?? r.member_id.slice(0, 8) + "…"}</td>
                    <td className="p-3 capitalize">{r.tier}</td>
                    <td className="p-3 text-right text-accent-soft">{fmtR(Number(r.payout_amount ?? r.net_amount ?? 0))}</td>
                    <td className="p-3 text-xs text-muted-foreground">{r.payment_ref ?? "—"}</td>
                  </tr>
                ))}
                {paidFiltered.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-sm text-muted-foreground">
                    <Inbox className="h-6 w-6 mx-auto mb-2 opacity-60" />
                    No payments found in this period.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Fast-track modal */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fast-track payout {confirm ? `for ${confirm.member?.full_name ?? "member"}` : ""}</DialogTitle>
            <DialogDescription>
              {confirm && (
                <>Confirm the <b className="capitalize">{confirm.tier}</b> circle payout below.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {confirm && (() => {
            const gross = Number(confirm.fiat_amount ?? 0);
            const platform = +(gross * PLATFORM_FEE).toFixed(2);
            const ubuntu = +(gross * UBUNTU_FUND).toFixed(2);
            const net = +(gross - platform - ubuntu).toFixed(2);
            return (
              <div className="rounded-2xl border border-border bg-secondary/30 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Gross amount</span><span>{fmtR(gross)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Platform fee (2%)</span><span>−{fmtR(platform)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Ubuntu fund (3%)</span><span>−{fmtR(ubuntu)}</span></div>
                <div className="border-t border-border my-2" />
                <div className="flex justify-between font-semibold text-accent-soft text-base"><span>Net payout</span><span>{fmtR(net)}</span></div>
              </div>
            );
          })()}
          {confirm && payMethod === "EFT" && (confirm.member?.bank_name || confirm.member?.bank_account) && (
            <div className="rounded-2xl border border-border bg-background/40 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span>{confirm.member?.bank_name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Account</span><span>{confirm.member?.bank_account ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span>{(confirm.member as any)?.bank_branch ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Holder</span><span>{confirm.member?.full_name ?? "—"}</span></div>
              <Button
                type="button" size="sm" variant="ghost"
                className="mt-1 h-7 px-2 text-[11px]"
                onClick={() => {
                  const m: any = confirm.member ?? {};
                  const txt = `Bank: ${m.bank_name ?? ""}\nAccount: ${m.bank_account ?? ""}\nBranch: ${m.bank_branch ?? ""}\nHolder: ${m.full_name ?? ""}`;
                  navigator.clipboard.writeText(txt).then(() => toast.success("Bank details copied"));
                }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy bank details
              </Button>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Net amount (R)</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="mt-1 h-11 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">Payment method</Label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)} className="mt-1 w-full h-11 rounded-xl border border-border bg-secondary/60 px-3 text-sm">
                <option value="EFT">EFT Transfer</option>
                <option value="Cash">Cash Payment</option>
                <option value="Paystack">Paystack Transfer</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Payment reference</Label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="EFT reference, receipt no…" className="mt-1 h-11 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">Payment date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="mt-1 h-11 rounded-xl" />
            </div>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox checked={confirmCheck} onCheckedChange={(v) => setConfirmCheck(!!v)} className="mt-0.5" />
              <span>I confirm payment of <b>R{Math.round(Number(payAmount) || 0).toLocaleString("en-ZA")}</b> has been made to this member.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button>
            <Button disabled={busy || !confirmCheck} onClick={markPaid} className="bg-gradient-gold text-amber-950">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Process payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
