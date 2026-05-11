import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles, Users, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Bid = {
  id: string;
  tier: string;
  fiat_amount: number;
  net_amount: number | null;
  payout_amount: number | null;
  status: string | null;
  created_at: string | null;
  vault_start: string | null;
  vault_end: string | null;
};

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function Profile() {
  const { member, user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sparkTxns, setSparkTxns] = useState<Array<{ id: string; tx_type: string; amount: number; created_at: string | null }>>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [balance, setBalance] = useState(0);
  const [openBid, setOpenBid] = useState<Bid | null>(null);
  const [prefs, setPrefs] = useState({ circle: true, spark_trade: true, marketing: true, weekly_digest: true });
  const [savingPref, setSavingPref] = useState<string | null>(null);

  const togglePref = async (key: keyof typeof prefs) => {
    if (!user) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); setSavingPref(key);
    const { error } = await supabase.from("members").update({ email_preferences: next }).eq("id", user.id);
    setSavingPref(null);
    if (error) { setPrefs(prefs); toast.error("Could not save"); }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, b, w, m] = await Promise.all([
        supabase.from("spark_transactions").select("id, tx_type, amount, created_at").or(`from_member.eq.${user.id},to_member.eq.${user.id}`).order("created_at", { ascending: false }).limit(50),
        supabase.from("circle_bids").select("id, tier, fiat_amount, net_amount, payout_amount, status, created_at, vault_start, vault_end").eq("member_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("spark_wallets").select("balance").eq("member_id", user.id).maybeSingle(),
        supabase.from("members").select("email_preferences").eq("id", user.id).maybeSingle(),
      ]);
      setSparkTxns((s.data ?? []) as typeof sparkTxns);
      setBids((b.data ?? []) as typeof bids);
      setBalance(Number(w.data?.balance ?? 0));
      const p = (m.data?.email_preferences ?? {}) as Partial<typeof prefs>;
      setPrefs({ circle: p.circle ?? true, spark_trade: p.spark_trade ?? true, marketing: p.marketing ?? true, weekly_digest: p.weekly_digest ?? true });
      setLoading(false);
    })();
  }, [user]);

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Profile</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            {member?.full_name ?? "Member"}
          </h1>
          <div className="mt-4 rounded-3xl glass p-5 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{member?.email ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{member?.phone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rank</span><span className="capitalize">{member?.rank ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Member since</span><span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sparks balance</span><span className="text-accent-soft font-display">{Math.round(balance)} SP</span></div>
          </div>
          <Button variant="outline" className="mt-4 w-full rounded-2xl" onClick={signOut}>Sign out</Button>

          <div className="mt-6 rounded-3xl glass p-5">
            <h3 className="font-display text-lg flex items-center gap-2"><Mail className="h-4 w-4 text-accent" /> Email preferences</h3>
            <p className="text-xs text-muted-foreground mt-1">Critical notifications (payments, KYC, payouts) are always sent.</p>
            <ul className="mt-4 space-y-3 text-sm">
              {([
                ["circle", "Circle notifications"],
                ["spark_trade", "Spark Trade updates"],
                ["marketing", "Marketing emails"],
                ["weekly_digest", "Weekly digest"],
              ] as const).map(([key, label]) => (
                <li key={key} className="flex items-center justify-between">
                  <span>{label}</span>
                  <Switch checked={prefs[key]} disabled={savingPref === key} onCheckedChange={() => togglePref(key)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md"></div></section>
      <div style={{ display: "none" }}>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-xl flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Sparks history</h2>
          {loading ? <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" /> : sparkTxns.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No spark transactions yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
              {sparkTxns.slice(0, 10).map((t) => (
                <li key={t.id} className="flex items-center justify-between p-4 text-sm">
                  <div>
                    <p className="font-medium capitalize">{t.tx_type}</p>
                    <p className="text-xs text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}</p>
                  </div>
                  <span className="font-display text-accent-soft">{Math.round(Number(t.amount))} SP</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-xl flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Circle history</h2>
          {loading ? null : bids.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No circle bids yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {bids.map((b) => {
                const status = (b.status ?? "pending").toLowerCase();
                const tone =
                  status === "paid" || status === "matched"
                    ? "bg-primary/15 text-primary"
                    : status === "active"
                    ? "bg-accent/15 text-accent-soft"
                    : status === "cancelled" || status === "failed"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-secondary text-muted-foreground";
                const fmtDate = (d: string | null) =>
                  d ? new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setOpenBid(b)}
                      className="w-full text-left rounded-3xl border border-border bg-gradient-card p-4 animate-fade-in transition-smooth hover:border-primary/40 hover:-translate-y-0.5"
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-base capitalize">{b.tier} Circle</p>
                        <span className={`mt-1 inline-block text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 ${tone}`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                        Gross {fmtR(Number(b.fiat_amount))}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-secondary/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contributed</p>
                        <p className="mt-0.5 font-display text-lg">{fmtR(Number(b.net_amount ?? b.fiat_amount))}</p>
                        <p className="text-[10px] text-muted-foreground">net of fees</p>
                      </div>
                      <div className="rounded-2xl bg-primary/10 p-3 border border-primary/20">
                        <p className="text-[10px] uppercase tracking-wider text-accent">Payout</p>
                        <p className="mt-0.5 font-display text-lg text-gradient-gold">
                          {b.payout_amount != null ? fmtR(Number(b.payout_amount)) : "Pending"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {b.payout_amount != null ? "scheduled" : "after vault"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider text-[9px]">Started</p>
                        <p>{fmtDate(b.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider text-[9px]">Vault opens</p>
                        <p>{fmtDate(b.vault_start)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider text-[9px]">Vault ends</p>
                        <p>{fmtDate(b.vault_end)}</p>
                      </div>
                    </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <Dialog open={!!openBid} onOpenChange={(v) => !v && setOpenBid(null)}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card max-w-md">
          {openBid && (() => {
            const b = openBid;
            const status = (b.status ?? "pending").toLowerCase();
            const fmtDateTime = (d: string | null) =>
              d ? new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
            return (
              <>
                <DialogHeader>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-accent">Bid details</p>
                  <DialogTitle className="font-display text-2xl capitalize">{b.tier} Circle</DialogTitle>
                  <DialogDescription>
                    <span className="inline-block text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-0.5">
                      {status}
                    </span>
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-secondary/40 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stake (gross)</p>
                    <p className="mt-0.5 font-display text-lg">{fmtR(Number(b.fiat_amount))}</p>
                  </div>
                  <div className="rounded-2xl bg-secondary/40 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contributed (net)</p>
                    <p className="mt-0.5 font-display text-lg">{fmtR(Number(b.net_amount ?? b.fiat_amount))}</p>
                  </div>
                  <div className="col-span-2 rounded-2xl bg-primary/10 p-3 border border-primary/20">
                    <p className="text-[10px] uppercase tracking-wider text-accent">Payout</p>
                    <p className="mt-0.5 font-display text-2xl text-gradient-gold">
                      {b.payout_amount != null ? fmtR(Number(b.payout_amount)) : "Pending"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {b.payout_amount != null ? "Scheduled at vault end" : "Calculated after vault closes"}
                    </p>
                  </div>
                </div>

                <ul className="mt-2 divide-y divide-border rounded-2xl border border-border overflow-hidden">
                  {[
                    { label: "Bid placed", value: fmtDateTime(b.created_at) },
                    { label: "Vault opens", value: fmtDateTime(b.vault_start) },
                    { label: "Vault ends", value: fmtDateTime(b.vault_end) },
                  ].map((row) => (
                    <li key={row.label} className="flex items-center justify-between p-3 text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">{row.value}</span>
                    </li>
                  ))}
                </ul>

                <p className="text-[10px] text-muted-foreground">Reference: {b.id.slice(0, 8)}…</p>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </main>
  );
}
