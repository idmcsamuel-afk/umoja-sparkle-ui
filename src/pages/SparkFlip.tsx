import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Info } from "lucide-react";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { playWin, playLose } from "@/lib/sounds";
import { MuteButton } from "@/components/umoja/MuteButton";

const STAKES = [20, 50, 100, 200, 500] as const;
const DAILY_LIMIT = 10;

type SparkType = "promotional" | "earned" | "purchased" | "referral";

interface Breakdown {
  promotional: number;
  earned: number;
  purchased: number;
  referral: number;
  total: number;
  total_playable: number;
  withdrawable: number;
  promo_expires_at: string | null;
  zar_value: number;
}

interface FlipRow {
  id: string;
  choice: string;
  result: string;
  payout: number;
  bet_sparks: number;
  created_at: string;
}

export default function SparkFlip() {
  const { user } = useAuth();
  const [bal, setBal] = useState<Breakdown | null>(null);
  const [history, setHistory] = useState<FlipRow[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [pick, setPick] = useState<"heads" | "tails">("heads");
  const [stake, setStake] = useState<number>(20);
  const [spinning, setSpinning] = useState(false);
  const [face, setFace] = useState<"heads" | "tails">("heads");
  const [sparkType, setSparkType] = useState<SparkType>("earned");

  const refresh = async () => {
    if (!user) return;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const [{ data: br }, { data: hist }] = await Promise.all([
      supabase.rpc("spark_balance_breakdown", { _member: user.id }),
      supabase
        .from("spark_flip_games")
        .select("*")
        .eq("member_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (br) setBal(br as unknown as Breakdown);
    setHistory((hist ?? []) as any);
    setTodayCount((hist ?? []).filter((r: any) => new Date(r.created_at) >= since).length);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line
  }, [user]);

  // Auto-select best available pool when balances change
  useEffect(() => {
    if (!bal) return;
    if (bal.earned >= stake) setSparkType("earned");
    else if (bal.purchased >= stake) setSparkType("purchased");
    else if (bal.referral >= stake) setSparkType("referral");
    else if (bal.promotional >= stake) setSparkType("promotional");
  }, [bal, stake]);

  const availableForType = useMemo(() => {
    if (!bal) return 0;
    return bal[sparkType];
  }, [bal, sparkType]);

  const insufficient = availableForType < stake;
  const limitHit = todayCount >= DAILY_LIMIT;
  const canFlip = !!user && !spinning && !insufficient && !limitHit;
  const winProb = sparkType === "promotional" ? 30 : 45;
  const isHard = sparkType === "promotional";

  const flip = async () => {
    if (!canFlip) return;
    setSpinning(true);

    // Visual spin
    let i = 0;
    const iv = setInterval(() => {
      setFace((f) => (f === "heads" ? "tails" : "heads"));
      i++;
      if (i > 14) clearInterval(iv);
    }, 130);
    await new Promise((r) => setTimeout(r, 2100));

    const { data, error } = await supabase.rpc("apply_spark_flip_outcome", {
      _spark_type: sparkType,
      _bet: stake,
      _choice: pick,
    });

    setSpinning(false);

    if (error) {
      toast({ title: "Flip failed", description: error.message, variant: "destructive" });
      return;
    }

    const result = (data as any)?.result as "heads" | "tails";
    const won = !!(data as any)?.won;
    const payout = Number((data as any)?.payout ?? 0);

    setFace(result);
    if (won) {
      playWin();
      const wins = Number(localStorage.getItem("umoja_flip_win_streak") || "0") + 1;
      localStorage.setItem("umoja_flip_win_streak", String(wins));
      if (wins > 0 && wins % 5 === 0) {
        window.dispatchEvent(new CustomEvent("umoja:win-streak", { detail: { wins } }));
      }
    } else {
      playLose();
      localStorage.setItem("umoja_flip_win_streak", "0");
    }
    toast({
      title: won ? `🎉 ${result.toUpperCase()} — you win!` : `💔 ${result.toUpperCase()} — try again`,
      description: won ? `+${payout} ⚡ to earned wallet` : `-${stake} ⚡ from ${sparkType}`,
    });
    refresh();
  };

  return (
    <div className="min-h-screen pb-32 bg-[radial-gradient(ellipse_at_top,hsl(44_70%_22%/0.6),hsl(150_18%_5%)_55%)]">
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <Link to="/spark-pit" className="grid h-9 w-9 place-items-center rounded-full bg-card border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
          🪙 Spark Flip
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-amber-200">{bal?.total ?? 0} ⚡</div>
          <MuteButton />
        </div>
      </header>

      <main className="px-5 space-y-4">
        {/* Spark source selector */}
        <Card className="p-4 border-amber-500/25 bg-black/40">
          <div className="text-[11px] uppercase tracking-wider text-amber-300/80 mb-2">
            Playing with
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["promotional", "earned", "purchased"] as const).map((t) => {
              const avail = bal?.[t] ?? 0;
              const active = sparkType === t;
              const labels = { promotional: "Promo", earned: "Earned", purchased: "Purchased" };
              const colors = {
                promotional: active ? "bg-orange-500/90 text-white" : "bg-orange-500/10 text-orange-300 border border-orange-500/30",
                earned: active ? "bg-emerald-500/90 text-white" : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
                purchased: active ? "bg-blue-500/90 text-white" : "bg-blue-500/10 text-blue-300 border border-blue-500/30",
              };
              return (
                <button
                  key={t}
                  disabled={spinning || avail < stake}
                  onClick={() => setSparkType(t)}
                  className={`rounded-xl px-2 py-2 text-xs font-bold transition disabled:opacity-40 ${colors[t]}`}
                >
                  <div>{labels[t]}</div>
                  <div className="text-[10px] opacity-90">{avail} ⚡</div>
                </button>
              );
            })}
          </div>
          <div className={`mt-3 flex items-center gap-1.5 text-[11px] ${isHard ? "text-orange-300" : "text-emerald-300"}`}>
            <Info className="h-3 w-3" />
            <span>
              {isHard ? "Hard Mode" : "Normal Mode"} · {winProb}% win chance
              {isHard ? " (promotional sparks)" : ""}
            </span>
          </div>
        </Card>

        <Card className="p-6 border-amber-500/25 bg-gradient-to-b from-amber-950/30 to-black/60 [perspective:600px]">
          <div className="mx-auto h-40 w-40 grid place-items-center" style={{ perspective: "600px" }}>
            <div
              className="relative h-32 w-32 rounded-full"
              style={{
                transformStyle: "preserve-3d",
                transform: face === "heads" ? "rotateY(0deg)" : "rotateY(180deg)",
                transition: spinning ? "none" : "transform 0.4s ease-out",
                animation: spinning ? "coinFlip 0.4s linear infinite" : undefined,
              }}
            >
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 shadow-[inset_0_-6px_14px_rgba(120,60,0,0.6),0_15px_40px_rgba(255,180,0,0.45)] grid place-items-center font-black text-4xl text-amber-900"
                style={{ backfaceVisibility: "hidden" }}
              >
                U
              </div>
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 shadow-[inset_0_-6px_14px_rgba(120,60,0,0.6),0_15px_40px_rgba(255,180,0,0.45)] grid place-items-center font-black text-2xl text-amber-900"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                ⚡
              </div>
            </div>
          </div>
          <style>{`@keyframes coinFlip { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }`}</style>

          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wider text-amber-300/80 mb-2">Stake</div>
            <div className="grid grid-cols-5 gap-2">
              {STAKES.map((v) => (
                <button
                  key={v}
                  onClick={() => setStake(v)}
                  disabled={spinning}
                  className={`rounded-xl py-2 text-xs font-bold transition ${
                    stake === v
                      ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 shadow-[0_8px_24px_-8px_hsl(44_80%_55%/0.6)]"
                      : "bg-black/40 border border-amber-500/30 text-amber-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["heads", "tails"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPick(p)}
                disabled={spinning}
                className={`rounded-xl py-3 text-sm font-bold capitalize transition ${
                  pick === p
                    ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 shadow-[0_8px_24px_-8px_hsl(44_80%_55%/0.6)]"
                    : "bg-black/40 border border-amber-500/30 text-amber-200"
                }`}
              >
                {p === "heads" ? "U Heads" : "⚡ Tails"}
              </button>
            ))}
          </div>

          <Button
            onClick={flip}
            disabled={!canFlip}
            className="w-full mt-4 h-12 font-bold bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 border-0"
          >
            {spinning ? <Loader2 className="h-5 w-5 animate-spin" /> : `Flip — ${stake} ⚡ · win ${stake * 2}`}
          </Button>
          <div className="text-center text-[11px] mt-2">
            {insufficient ? (
              <span className="text-destructive">Insufficient {sparkType} Sparks</span>
            ) : limitHit ? (
              <span className="text-destructive">Daily limit reached</span>
            ) : (
              <span className="text-muted-foreground">{DAILY_LIMIT - todayCount} flips left today</span>
            )}
          </div>
          {!bal || (bal.total < stake && !insufficient) ? null : (
            <div className="mt-2 text-center">
              <Link to="/buy-sparks" className="text-[11px] text-amber-300 underline">Need more Sparks? Buy here →</Link>
            </div>
          )}
        </Card>

        <Card className="p-4 border-amber-500/20">
          <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">Recent flips</div>
          {history.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">No flips yet — try your luck.</div>
          ) : (
            <ul className="space-y-1.5">
              {history.map((h) => {
                const won = (h.payout ?? 0) > 0;
                return (
                  <li key={h.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Picked <b className="capitalize text-foreground">{h.choice}</b> · landed{" "}
                      <b className="capitalize text-foreground">{h.result}</b>
                    </span>
                    <span className={won ? "text-emerald-400 font-bold" : "text-destructive font-bold"}>
                      {won ? `+${h.payout}` : `-${h.bet_sparks}`} ⚡
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
