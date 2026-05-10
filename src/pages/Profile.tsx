import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function Profile() {
  const { member, user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sparkTxns, setSparkTxns] = useState<Array<{ id: string; tx_type: string; amount: number; created_at: string | null }>>([]);
  const [bids, setBids] = useState<Array<{ id: string; tier: string; fiat_amount: number; net_amount: number | null; payout_amount: number | null; status: string | null; created_at: string | null; vault_start: string | null; vault_end: string | null }>>([]);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, b, w] = await Promise.all([
        supabase.from("spark_transactions").select("id, tx_type, amount, created_at").or(`from_member.eq.${user.id},to_member.eq.${user.id}`).order("created_at", { ascending: false }).limit(50),
        supabase.from("circle_bids").select("id, tier, fiat_amount, net_amount, payout_amount, status, created_at, vault_start, vault_end").eq("member_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("spark_wallets").select("balance").eq("member_id", user.id).maybeSingle(),
      ]);
      setSparkTxns((s.data ?? []) as typeof sparkTxns);
      setBids((b.data ?? []) as typeof bids);
      setBalance(Number(w.data?.balance ?? 0));
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
        </div>
      </section>

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
            <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
              {bids.slice(0, 10).map((b) => (
                <li key={b.id} className="flex items-center justify-between p-4 text-sm">
                  <div>
                    <p className="font-medium capitalize">{b.tier}</p>
                    <p className="text-xs text-muted-foreground">{b.status} · {b.created_at ? new Date(b.created_at).toLocaleDateString() : ""}</p>
                  </div>
                  <span className="font-display text-gradient-gold">{fmtR(Number(b.fiat_amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
