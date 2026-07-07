import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Search, ShieldCheck, AlertTriangle, Check, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";

const fmtR = (n: number | null | undefined) =>
  "R" + Math.round(Number(n ?? 0)).toLocaleString("en-ZA");
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString() : "—";

interface Member {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  country: string | null; kyc_status: string | null; kyc_level: number | null;
  kyc_verified_at: string | null; created_at: string;
  buyers_club_tier: string | null; buyers_club_status: string | null;
  spark_trade_subscription_tier: string | null; spark_trade_subscription_payment_status: string | null;
  is_active: boolean | null; last_seen_at: string | null;
}

interface Bid {
  id: string; tier: string; fiat_amount: number; status: string | null;
  payment_method: string | null; payment_reference: string | null;
  payment_proof_url: string | null; payment_submitted_at: string | null;
  payment_confirmed_at: string | null; payment_deadline: string | null;
  created_at: string | null;
}

interface Wallet {
  balance: number; earned_balance: number; promotional_balance: number;
  purchased_balance: number; referral_balance: number;
}

interface Withdrawal {
  id: string; reference_number: string; amount_r_net: number; status: string; created_at: string;
}

interface Storefront {
  member_id: string; display_name: string | null; is_active: boolean | null; view_count: number | null;
}

interface StOrder {
  id: string; units: number; order_total: number; status: string | null; created_at: string;
}

interface AiSub {
  tier: string | null; is_active: boolean | null; renews_at: string | null;
}

export default function AdminMemberInspector() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Member[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);
  const [bids, setBids] = useState<Bid[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [stOrders, setStOrders] = useState<StOrder[]>([]);
  const [aiSub, setAiSub] = useState<AiSub | null>(null);
  const [referralCount, setReferralCount] = useState(0);

  const [approveBid, setApproveBid] = useState<Bid | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [approving, setApproving] = useState(false);

  const search = async () => {
    const term = q.trim();
    if (!term) return;
    setSearching(true);
    const { data } = await supabase
      .from("members")
      .select("id, full_name, email, phone, country, kyc_status, kyc_level, kyc_verified_at, created_at, buyers_club_tier, buyers_club_status, spark_trade_subscription_tier, spark_trade_subscription_payment_status, is_active, last_seen_at")
      .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(25);
    setResults((data ?? []) as Member[]);
    setSearching(false);
  };

  const inspect = async (m: Member) => {
    setMember(m);
    setLoading(true);
    // Log admin inspection access (accountability)
    await supabase.from("admin_audit_log").insert({
      actor_id: user?.id ?? null,
      action: "member.inspect",
      target_member: m.id,
      details: { email: m.email, at: new Date().toISOString() },
    });
    const [b, w, wr, sf, so, sub, refs] = await Promise.all([
      supabase.from("circle_bids")
        .select("id, tier, fiat_amount, status, payment_method, payment_reference, payment_proof_url, payment_submitted_at, payment_confirmed_at, payment_deadline, created_at")
        .eq("member_id", m.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("spark_wallets").select("balance, earned_balance, promotional_balance, purchased_balance, referral_balance").eq("member_id", m.id).maybeSingle(),
      supabase.from("withdrawal_requests").select("id, reference_number, amount_r_net, status, created_at").eq("member_id", m.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("storefronts").select("member_id, display_name, is_active, view_count").eq("member_id", m.id).maybeSingle(),
      supabase.from("st_orders").select("id, units, order_total, status, created_at").eq("member_id", m.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("ai_subscriptions").select("tier, is_active, renews_at").eq("member_id", m.id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("referred_by", m.id),
    ]);
    setBids((b.data ?? []) as Bid[]);
    setWallet((w.data as Wallet) ?? null);
    setWithdrawals((wr.data ?? []) as Withdrawal[]);
    setStorefront((sf.data as Storefront) ?? null);
    setStOrders((so.data ?? []) as StOrder[]);
    setAiSub((sub.data as AiSub) ?? null);
    setReferralCount(refs.count ?? 0);
    setLoading(false);
  };

  const issues = useMemo(() => {
    if (!member) return [];
    const list: string[] = [];
    if (member.kyc_status !== "verified") list.push(`KYC not verified (status: ${member.kyc_status ?? "none"})`);
    if (!aiSub?.is_active) list.push("No active AI/Spark Trade subscription");
    const unverified = bids.filter((b) => !b.payment_confirmed_at && ["pending", "payment_pending"].includes(b.status ?? ""));
    if (unverified.length) list.push(`${unverified.length} unverified contribution${unverified.length > 1 ? "s" : ""}`);
    if (member.is_active === false) list.push("Account inactive");
    return list;
  }, [member, aiSub, bids]);

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60);
    if (error || !data) { toast.error(error?.message ?? "Could not open proof"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const submitApprove = async () => {
    if (!approveBid || !member) return;
    const note = approveNote.trim();
    if (note.length < 5) { toast.error("Please enter a confirmation note (min 5 chars)"); return; }
    setApproving(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("circle_bids").update({
      status: "active",
      payment_confirmed_at: nowIso,
      payment_confirmed_by: user?.id ?? null,
      payment_completed_at: nowIso,
      payment_status: "confirmed",
    }).eq("id", approveBid.id);
    if (error) { toast.error(error.message); setApproving(false); return; }

    await supabase.from("admin_audit_log").insert({
      actor_id: user?.id ?? null,
      action: "circle_bid.admin_confirm",
      target_member: member.id,
      details: {
        bid_id: approveBid.id,
        tier: approveBid.tier,
        amount: Number(approveBid.fiat_amount),
        payment_method: approveBid.payment_method,
        payment_reference: approveBid.payment_reference,
        note,
        confirmed_at: nowIso,
      },
    });

    await supabase.from("notifications").insert({
      member_id: member.id,
      title: "✅ Payment confirmed by admin",
      body: `Your ${approveBid.tier} contribution of ${fmtR(approveBid.fiat_amount)} has been confirmed and is now active.`,
      kind: "payment",
      link: "/circle",
    });

    if (member.email) {
      supabase.functions.invoke("send-email", {
        body: {
          template: "payment_verified",
          to: member.email,
          member_id: member.id,
          bypass_prefs: true,
          data: {
            name: member.full_name,
            amount: Math.round(Number(approveBid.fiat_amount)).toLocaleString("en-ZA"),
            circle_name: `${approveBid.tier} Circle`,
          },
        },
      }).catch(() => {});
    }

    toast.success("Payment approved and audit trail recorded");
    setApproveBid(null);
    setApproveNote("");
    setApproving(false);
    inspect(member);
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Member Inspector</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Read-only diagnostics. Approve confirmed EFT contributions with an audit trail. No impersonation.
      </p>

      <div className="mt-6 flex gap-2 max-w-xl">
        <Input
          placeholder="Search by email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button onClick={search} disabled={searching} className="rounded-2xl bg-gradient-primary text-primary-foreground">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results.length > 0 && !member && (
        <ul className="mt-4 space-y-2 max-w-2xl">
          {results.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => inspect(m)}
                className="w-full text-left rounded-2xl border border-border bg-gradient-card p-4 hover:bg-secondary/40 transition-smooth"
              >
                <p className="font-display">{m.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{m.email} · joined {fmtDate(m.created_at)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {member && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-accent">Inspecting</p>
              <h2 className="font-display text-2xl">{member.full_name ?? "—"}</h2>
              <p className="text-xs text-muted-foreground">{member.email} · {member.phone ?? "no phone"} · {member.country ?? "—"}</p>
            </div>
            <Button variant="outline" onClick={() => { setMember(null); setResults([]); }} className="rounded-2xl">
              ← Back to search
            </Button>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              {issues.length > 0 && (
                <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-amber-200">
                    <AlertTriangle className="h-4 w-4" /> Likely issues
                  </p>
                  <ul className="mt-2 ml-6 list-disc text-xs text-amber-100/80 space-y-1">
                    {issues.map((i) => <li key={i}>{i}</li>)}
                  </ul>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <Card title="KYC">
                  <Row label="Status" value={member.kyc_status ?? "—"} />
                  <Row label="Level" value={String(member.kyc_level ?? 0)} />
                  <Row label="Verified" value={fmtDate(member.kyc_verified_at)} />
                </Card>
                <Card title="Subscription">
                  <Row label="AI tier" value={aiSub?.tier ?? "—"} />
                  <Row label="Active" value={aiSub?.is_active ? "Yes" : "No"} />
                  <Row label="Renews" value={fmtDate(aiSub?.renews_at)} />
                  <Row label="Spark Trade" value={`${member.spark_trade_subscription_tier ?? "—"} (${member.spark_trade_subscription_payment_status ?? "—"})`} />
                </Card>
                <Card title="Spark wallet">
                  <Row label="Total" value={String(Math.round(Number(wallet?.balance ?? 0)))} />
                  <Row label="Earned" value={String(Math.round(Number(wallet?.earned_balance ?? 0)))} />
                  <Row label="Promo" value={String(Math.round(Number(wallet?.promotional_balance ?? 0)))} />
                  <Row label="Purchased" value={String(Math.round(Number(wallet?.purchased_balance ?? 0)))} />
                  <Row label="Referral" value={String(Math.round(Number(wallet?.referral_balance ?? 0)))} />
                </Card>
                <Card title="Storefront">
                  <Row label="Name" value={storefront?.display_name ?? "—"} />
                  <Row label="Active" value={storefront?.is_active ? "Yes" : "No"} />
                  <Row label="Views" value={String(storefront?.view_count ?? 0)} />
                </Card>
                <Card title="Buyers Club">
                  <Row label="Tier" value={member.buyers_club_tier ?? "—"} />
                  <Row label="Status" value={member.buyers_club_status ?? "—"} />
                </Card>
                <Card title="Community">
                  <Row label="Referrals" value={String(referralCount)} />
                  <Row label="Last seen" value={fmtDate(member.last_seen_at)} />
                </Card>
              </div>

              <section>
                <h3 className="font-display text-lg">Contributions</h3>
                {bids.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No contributions.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {bids.map((b) => {
                      const isUnverified = !b.payment_confirmed_at && ["pending", "payment_pending"].includes(b.status ?? "");
                      return (
                        <li key={b.id} className="rounded-2xl border border-border bg-gradient-card p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-display capitalize">
                                {b.tier} · {fmtR(b.fiat_amount)}
                                <span className="ml-2 text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-secondary text-muted-foreground">
                                  {b.status ?? "—"}
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {b.payment_method ?? "—"} · ref {b.payment_reference ?? "—"} · created {fmtDate(b.created_at)}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                submitted {fmtDate(b.payment_submitted_at)} · confirmed {fmtDate(b.payment_confirmed_at)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {b.payment_proof_url && (
                                <Button variant="outline" onClick={() => openProof(b.payment_proof_url!)} className="rounded-2xl">
                                  <ExternalLink className="h-4 w-4 mr-1" /> Proof
                                </Button>
                              )}
                              {isUnverified && (
                                <Button
                                  onClick={() => { setApproveBid(b); setApproveNote(""); }}
                                  className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
                                >
                                  <ShieldCheck className="h-4 w-4 mr-1" /> Approve (admin)
                                </Button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                <section>
                  <h3 className="font-display text-lg">Withdrawals</h3>
                  {withdrawals.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None.</p> : (
                    <ul className="mt-3 space-y-2">
                      {withdrawals.map((w) => (
                        <li key={w.id} className="rounded-2xl border border-border bg-gradient-card p-3 text-sm flex justify-between">
                          <span>{w.reference_number} · {fmtR(w.amount_r_net)}</span>
                          <span className="text-muted-foreground">{w.status} · {fmtDate(w.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h3 className="font-display text-lg">Spark Trade orders</h3>
                  {stOrders.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None.</p> : (
                    <ul className="mt-3 space-y-2">
                      {stOrders.map((o) => (
                        <li key={o.id} className="rounded-2xl border border-border bg-gradient-card p-3 text-sm flex justify-between">
                          <span>{o.units} units · {fmtR(o.order_total)}</span>
                          <span className="text-muted-foreground">{o.status ?? "—"} · {fmtDate(o.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" /> This inspection has been logged to the admin audit trail.
              </p>
            </>
          )}
        </div>
      )}

      <Dialog open={!!approveBid} onOpenChange={(o) => !o && setApproveBid(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve payment (admin-confirmed)</DialogTitle>
            <DialogDescription>
              Confirming {approveBid && fmtR(approveBid.fiat_amount)} for the{" "}
              <span className="capitalize">{approveBid?.tier}</span> circle.
              This credits the member and cannot be undone from here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Confirmation note (required)</label>
            <Textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="e.g. Confirmed via FNB bank statement 6 July, ref UMOJA-1234"
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">
              Recorded to the audit log with your admin id and timestamp.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveBid(null)} disabled={approving} className="rounded-2xl">Cancel</Button>
            <Button
              onClick={submitApprove}
              disabled={approving || approveNote.trim().length < 5}
              className="rounded-2xl bg-gradient-primary text-primary-foreground"
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Approve</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-gradient-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground truncate ml-2 max-w-[60%] text-right">{value}</span>
    </div>
  );
}
