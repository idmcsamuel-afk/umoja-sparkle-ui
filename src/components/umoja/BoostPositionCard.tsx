import { useEffect, useState } from "react";
import { Rocket, Loader2, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BidRow {
  boost_count: number;
  last_boost_at: string | null;
  priority_score: number | null;
}
interface Wallet {
  earned_balance: number;
  purchased_balance: number;
  promotional_balance: number;
  promo_expires_at: string | null;
}
interface Props {
  bidId: string;
  currentPosition: number | null;
  totalActive: number;
  payoutDate: string | null;
  onBoosted?: () => void;
}

const BOOST_COST = 50;

function fmtHM(ms: number) {
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function BoostPositionCard({ bidId, currentPosition, totalActive, payoutDate, onBoosted }: Props) {
  const [bid, setBid] = useState<BidRow | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [last, setLast] = useState<{ before: number; after: number; payoutDays?: number } | null>(null);

  const load = async () => {
    const [b, w] = await Promise.all([
      supabase.from("circle_bids").select("boost_count,last_boost_at,priority_score").eq("id", bidId).maybeSingle(),
      supabase
        .from("spark_wallets")
        .select("earned_balance,purchased_balance,promotional_balance,promo_expires_at")
        .maybeSingle(),
    ]);
    if (b.data) setBid(b.data as any);
    if (w.data) setWallet(w.data as any);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [bidId]);

  if (!bid) return null;

  const promoActive =
    wallet?.promo_expires_at == null || new Date(wallet.promo_expires_at).getTime() > now;
  const totalSparks =
    (wallet?.earned_balance ?? 0) +
    (wallet?.purchased_balance ?? 0) +
    (promoActive ? wallet?.promotional_balance ?? 0 : 0);

  const used = bid.boost_count ?? 0;
  const remaining = 3 - used;
  const maxedOut = remaining <= 0;
  const nextAvailable = bid.last_boost_at
    ? new Date(bid.last_boost_at).getTime() + 24 * 3_600_000
    : 0;
  const cooldownLeft = Math.max(0, nextAvailable - now);
  const onCooldown = cooldownLeft > 0;
  const isFirst = currentPosition === 1;
  const lowSparks = totalSparks < BOOST_COST;

  const disabled = busy || maxedOut || onCooldown || isFirst || lowSparks;

  const onBoost = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("boost_circle_bid", { _bid_id: bidId });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as any;
    if (!r?.ok) {
      const map: Record<string, string> = {
        insufficient_sparks: "You need 50 sparks to boost",
        max_boosts_used: "You've used all 3 boosts for this circle",
        cooldown: "Boost is on cooldown — try again later",
        already_first: "You're already in first place!",
        bid_not_active: "This bid isn't active anymore",
        no_wallet: "No spark wallet found",
      };
      return toast.error(map[r?.reason] ?? "Could not boost");
    }
    setLast({
      before: r.position_before,
      after: r.position_after,
      payoutDays: undefined,
    });
    toast.success(`✓ Boosted! #${r.position_before} → #${r.position_after} · -${r.sparks_spent} ⚡`);
    onBoosted?.();
    load();
  };

  return (
    <div className="mt-3 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-semibold text-amber-300">Boost your position</p>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {used}/3 used
        </span>
      </div>

      {last && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs text-emerald-300">
          ✓ Boosted! <b>#{last.before} → #{last.after}</b> · 2+ days sooner
        </div>
      )}

      <div className="space-y-1 text-[11px] text-muted-foreground">
        <p>• Move up 5+ positions in the queue</p>
        <p>• Get paid 2+ days earlier</p>
        <p>• Costs 50 ⚡ per boost · max 3 per circle</p>
      </div>

      <Button
        onClick={onBoost}
        disabled={disabled}
        className="w-full h-10 font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:opacity-90"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : maxedOut ? (
          "Max boosts used"
        ) : isFirst ? (
          "Already in 1st place"
        ) : lowSparks ? (
          `Need ${BOOST_COST} ⚡ to boost`
        ) : onCooldown ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Next boost in {fmtHM(cooldownLeft)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Boost Now — 50 ⚡
          </span>
        )}
      </Button>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Balance: {totalSparks} ⚡</span>
        <span>{remaining} boost{remaining === 1 ? "" : "s"} left</span>
      </div>
    </div>
  );
}
