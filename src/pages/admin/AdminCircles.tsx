import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X, ExternalLink, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BidStatusHistory } from "@/components/umoja/BidStatusHistory";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

interface TierRow {
  tier: string; min_entry: number; max_entry: number; growth_rate: number;
  vault_days: number; is_active: boolean | null; pool: number; members: number;
}

interface PendingBid {
  id: string;
  member_id: string;
  tier: string;
  fiat_amount: number;
  payment_reference: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_deadline: string | null;
  payment_method: string | null;
  created_at: string | null;
  member_name?: string;
  member_email?: string;
}

export default function AdminCircles() {
  const [tab, setTab] = useState<"tiers" | "pending" | "awaiting">("tiers");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TierRow[]>([]);
  const [pending, setPending] = useState<PendingBid[]>([]);
  const [awaiting, setAwaiting] = useState<PendingBid[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    setLoading(true);
    const [t, b, p, a] = await Promise.all([
      supabase.from("circle_tiers").select("*").order("min_entry"),
      supabase.from("circle_bids").select("tier, net_amount, member_id, status").in("status", ["pending", "payment_pending", "active", "matched"]),
      supabase
        .from("circle_bids")
        .select("id, member_id, tier, fiat_amount, payment_reference, payment_proof_url, payment_submitted_at, payment_deadline, payment_method, created_at")
        .eq("status", "payment_pending")
        .order("payment_submitted_at", { ascending: true }),
      supabase
        .from("circle_bids")
        .select("id, member_id, tier, fiat_amount, payment_reference, payment_proof_url, payment_submitted_at, payment_deadline, payment_method, created_at")
        .eq("status", "pending")
        .is("payment_proof_url", null)
        .not("payment_deadline", "is", null)
        .order("payment_deadline", { ascending: true }),
    ]);

    const bids = (b.data ?? []) as { tier: string; net_amount: number; member_id: string }[];
    const tiers = (t.data ?? []) as Array<Omit<TierRow, "pool" | "members">>;
    setRows(tiers.map((x) => {
      const tBids = bids.filter((q) => q.tier === x.tier);
      return {
        ...x,
        pool: tBids.reduce((s, q) => s + Number(q.net_amount ?? 0), 0),
        members: new Set(tBids.map((q) => q.member_id)).size,
      };
    }));

    const pendingBids = (p.data ?? []) as PendingBid[];
    if (pendingBids.length) {
      const ids = Array.from(new Set(pendingBids.map((x) => x.member_id)));
      const { data: members } = await supabase
        .from("members")
        .select("id, full_name, email")
        .in("id", ids);
      const map = new Map((members ?? []).map((m: { id: string; full_name: string | null; email: string | null }) => [m.id, m]));
      pendingBids.forEach((x) => {
        const m = map.get(x.member_id);
        x.member_name = m?.full_name ?? "Member";
        x.member_email = m?.email ?? "";
      });
    }
    setPending(pendingBids);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60);
    if (error || !data) { toast.error(error?.message ?? "Could not open proof"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const confirm = async (bid: PendingBid) => {
    setBusy(bid.id);
    const { error } = await supabase
      .from("circle_bids")
      .update({
        status: "active",
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq("id", bid.id);
    if (error) { toast.error(error.message); setBusy(null); return; }
    await supabase.from("notifications").insert({
      member_id: bid.member_id,
      title: "✅ Payment confirmed",
      body: `Your ${bid.tier} bid of ${fmtR(Number(bid.fiat_amount))} is now active in the queue.`,
      kind: "payment",
      link: "/circle",
    });
    if (bid.member_email) {
      // Compute current rank in tier (active bids ordered by priority_score desc)
      const { data: tierBids } = await supabase
        .from("circle_bids")
        .select("id, priority_score")
        .eq("tier", bid.tier)
        .eq("status", "active")
        .order("priority_score", { ascending: false });
      const list = (tierBids ?? []) as Array<{ id: string; priority_score: number | null }>;
      const idx = list.findIndex((x) => x.id === bid.id);
      const rank = idx >= 0 ? idx + 1 : "—";
      const score = idx >= 0 ? Math.round(Number(list[idx].priority_score ?? 0)) : "—";
      supabase.functions.invoke("send-email", {
        body: {
          template: "payment_verified",
          to: bid.member_email,
          member_id: bid.member_id,
          bypass_prefs: true,
          data: {
            name: bid.member_name,
            amount: Math.round(Number(bid.fiat_amount)).toLocaleString("en-ZA"),
            circle_name: `${bid.tier} Circle`,
            score, rank, total: list.length,
          },
        },
      }).catch(() => {});
    }
    toast.success("Payment confirmed");
    setBusy(null);
    load();
  };

  const reject = async (bid: PendingBid) => {
    setBusy(bid.id);
    const { error } = await supabase
      .from("circle_bids")
      .update({ status: "rejected" })
      .eq("id", bid.id);
    if (error) { toast.error(error.message); setBusy(null); return; }
    await supabase.from("notifications").insert({
      member_id: bid.member_id,
      title: "⚠️ Payment not verified",
      body: `Your ${bid.tier} bid of ${fmtR(Number(bid.fiat_amount))} could not be verified. Please contact support.`,
      kind: "payment",
      link: "/circle",
    });
    toast("Bid rejected");
    setBusy(null);
    load();
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Circles</h1>
      <p className="text-sm text-muted-foreground mt-1">All saving tiers, live pool stats, and pending EFT verifications.</p>

      <div className="mt-6 inline-flex rounded-2xl border border-border bg-secondary/30 p-1">
        {[
          { id: "tiers" as const, label: "Tiers" },
          { id: "pending" as const, label: `Pending payments${pending.length ? ` (${pending.length})` : ""}` },
        ].map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`px-4 py-2 rounded-xl text-sm transition-smooth ${tab === x.id ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tab === "tiers" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.tier} className="rounded-3xl border border-border bg-gradient-card p-5">
              <div className="flex items-center justify-between">
                <p className="font-display text-xl capitalize">{r.tier}</p>
                <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-1 ${r.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {r.is_active ? "Active" : "Locked"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{fmtR(r.min_entry)} – {fmtR(r.max_entry)} · {r.vault_days}d · +{Math.round(Number(r.growth_rate) * 100)}%</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Pool</p>
                  <p className="font-display text-lg text-gradient-gold">{fmtR(r.pool)}</p>
                </div>
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Members</p>
                  <p className="font-display text-lg">{r.members}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6">
          {pending.length === 0 ? (
            <div className="rounded-3xl border border-border bg-gradient-card p-10 text-center text-sm text-muted-foreground">
              No payments awaiting verification.
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.map((bid) => (
                <li key={bid.id} className="rounded-3xl border border-border bg-gradient-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg">{bid.member_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{bid.member_email}</p>
                      <p className="mt-2 text-xs">
                        <span className="capitalize text-accent">{bid.tier}</span> ·
                        <span className="ml-1 font-mono">{bid.payment_reference ?? "—"}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Submitted {bid.payment_submitted_at ? new Date(bid.payment_submitted_at).toLocaleString() : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
                      <p className="font-display text-xl text-gradient-gold">{fmtR(Number(bid.fiat_amount))}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {bid.payment_proof_url && (
                      <Button
                        variant="outline"
                        onClick={() => openProof(bid.payment_proof_url!)}
                        className="rounded-2xl"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> View proof
                      </Button>
                    )}
                    <Button
                      onClick={() => confirm(bid)}
                      disabled={busy === bid.id}
                      className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
                    >
                      {busy === bid.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Confirm</>}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => reject(bid)}
                      disabled={busy === bid.id}
                      className="rounded-2xl text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setOpenHistory((cur) => (cur === bid.id ? null : bid.id))}
                      className="rounded-2xl"
                    >
                      <History className="h-4 w-4 mr-1" />
                      {openHistory === bid.id ? "Hide history" : "History"}
                    </Button>
                  </div>
                  {openHistory === bid.id && (
                    <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-3">
                      <BidStatusHistory bidId={bid.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
