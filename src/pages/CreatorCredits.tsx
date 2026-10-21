import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clapperboard, Coins, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePaystack } from "@/hooks/usePaystack";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Pack = { id: string; name: string; credits: number; price_zar: number };

export function useCreatorCredits() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("creator_credit_wallets").select("balance").eq("member_id", user.id).maybeSingle();
    setBalance(data?.balance ?? 0);
  };
  useEffect(() => { load(); }, [user?.id]);
  return { balance, reload: load };
}

export function CreatorCreditChip() {
  const { balance } = useCreatorCredits();
  if (balance === null) return null;
  return (
    <Link to="/creator-studio/credits" className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent/20">
      <Coins className="h-3.5 w-3.5 text-accent" aria-hidden />
      <span className="tabular-nums">{balance.toLocaleString()}</span>
      <span className="text-muted-foreground">Creator Credits</span>
    </Link>
  );
}

export default function CreatorCredits() {
  const { user } = useAuth();
  const { pay } = usePaystack();
  const { balance, reload } = useCreatorCredits();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [f, p] = await Promise.all([
        (supabase as any).from("creator_feature_flags").select("enabled").eq("key", "creator_studio_enabled").maybeSingle(),
        (supabase as any).from("creator_credit_packs").select("id,name,credits,price_zar").eq("active", true).order("sort_order"),
      ]);
      setEnabled(!!f.data?.enabled);
      setPacks(p.data ?? []);
    })();
  }, []);

  const buy = async (pk: Pack) => {
    if (!user?.email) return;
    setBusy(pk.id);
    const ref = `CCREDIT-${pk.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const r = await pay({ email: user.email, amountZar: Number(pk.price_zar), reference: ref, metadata: { payment_type: "creator_credits", pack_id: pk.id } });
    setBusy(null);
    if (r.ok) setTimeout(reload, 4000);
  };

  if (enabled === false) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Creator Studio isn't available right now.</div>;
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-2xl space-y-5 p-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl">Creator Studio</h1>
          <CreatorCreditChip />
        </header>

        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
            <Clapperboard className="h-8 w-8 text-accent" />
            <p className="font-medium">AI reel generation is coming soon</p>
            <p className="text-sm text-muted-foreground">Buy Creator Credits now — you'll spend them on videos, voices and images when generation opens. Credits are separate from Sparks.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Buy Credits</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {packs.map((pk) => (
              <div key={pk.id} className="rounded-lg border p-4 space-y-2">
                <p className="font-medium">{pk.name}</p>
                <p className="text-2xl font-display tabular-nums">{pk.credits.toLocaleString()} <span className="text-sm text-muted-foreground">credits</span></p>
                <Button className="w-full" onClick={() => buy(pk)} disabled={!!busy}>
                  {busy === pk.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Buy for R${Number(pk.price_zar).toFixed(0)}`}
                </Button>
              </div>
            ))}
            {packs.length === 0 && <p className="text-sm text-muted-foreground">No packs available.</p>}
          </CardContent>
        </Card>
        {balance !== null && <p className="text-center text-xs text-muted-foreground">Balance updates a few seconds after payment.</p>}
      </div>
      <BottomNav />
    </div>
  );
}
