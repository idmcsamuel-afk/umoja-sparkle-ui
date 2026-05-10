import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
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

interface FlipRow { id: string; choice: string; result: string; payout: number; bet_sparks: number; created_at: string }

export default function SparkFlip() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<FlipRow[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [pick, setPick] = useState<"heads" | "tails">("heads");
  const [stake, setStake] = useState<number>(20);
  const [spinning, setSpinning] = useState(false);
  const [face, setFace] = useState<"heads" | "tails">("heads");

  const refresh = async () => {
    if (!user) return;
    const since = new Date(); since.setHours(0,0,0,0);
    const [{ data: w }, { data: hist }] = await Promise.all([
      supabase.from("spark_wallets").select("balance").eq("member_id", user.id).maybeSingle(),
      supabase.from("spark_flip_games").select("*").eq("member_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setBalance(Number(w?.balance ?? 0));
    setHistory((hist ?? []) as any);
    setTodayCount((hist ?? []).filter((r: any) => new Date(r.created_at) >= since).length);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const insufficient = balance < stake;
  const limitHit = todayCount >= DAILY_LIMIT;
  const canFlip = !!user && !spinning && !insufficient && !limitHit;

  const flip = async () => {
    if (!canFlip) return;
    setSpinning(true);
    const result: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
    let i = 0;
    const iv = setInterval(() => { setFace((f) => (f === "heads" ? "tails" : "heads")); i++; if (i > 14) clearInterval(iv); }, 130);
    await new Promise((r) => setTimeout(r, 2100));
    setFace(result);
    const won = result === pick;
    const payout = won ? stake * 2 : 0;
    const { error } = await supabase.from("spark_flip_games").insert({
      member_id: user!.id, choice: pick, result, payout, bet_sparks: stake,
    });
    setSpinning(false);
    if (error) { toast({ title: "Flip failed", description: error.message, variant: "destructive" }); return; }
    if (won) playWin(); else playLose();
    toast({
      title: won ? `🎉 ${result.toUpperCase()} — you win!` : `💔 ${result.toUpperCase()} — try again`,
      description: won ? `+${payout} ⚡` : `-${stake} ⚡`,
    });
    refresh();
  };

  return (
    <div className="min-h-screen pb-32 bg-[radial-gradient(ellipse_at_top,hsl(44_70%_22%/0.6),hsl(150_18%_5%)_55%)]">
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <Link to="/spark-pit" className="grid h-9 w-9 place-items-center rounded-full bg-card border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">🪙 Spark Flip</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-amber-200">{balance} ⚡</div>
          <MuteButton />
        </div>
      </header>

      <main className="px-5 space-y-4">
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
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 shadow-[inset_0_-6px_14px_rgba(120,60,0,0.6),0_15px_40px_rgba(255,180,0,0.45)] grid place-items-center font-black text-4xl text-amber-900" style={{ backfaceVisibility: "hidden" }}>
                U
              </div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 shadow-[inset_0_-6px_14px_rgba(120,60,0,0.6),0_15px_40px_rgba(255,180,0,0.45)] grid place-items-center font-black text-2xl text-amber-900" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                ⚡
              </div>
            </div>
          </div>
          <style>{`@keyframes coinFlip { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }`}</style>

          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wider text-amber-300/80 mb-2">Stake</div>
            <div className="grid grid-cols-5 gap-2">
              {STAKES.map((v) => (
                <button key={v} onClick={() => setStake(v)} disabled={spinning}
                  className={`rounded-xl py-2 text-xs font-bold transition ${
                    stake === v ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 shadow-[0_8px_24px_-8px_hsl(44_80%_55%/0.6)]" : "bg-black/40 border border-amber-500/30 text-amber-200"
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["heads","tails"] as const).map((p) => (
              <button key={p} onClick={() => setPick(p)} disabled={spinning}
                className={`rounded-xl py-3 text-sm font-bold capitalize transition ${
                  pick === p ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 shadow-[0_8px_24px_-8px_hsl(44_80%_55%/0.6)]" : "bg-black/40 border border-amber-500/30 text-amber-200"
                }`}>
                {p === "heads" ? "U Heads" : "⚡ Tails"}
              </button>
            ))}
          </div>

          <Button onClick={flip} disabled={!canFlip}
            className="w-full mt-4 h-12 font-bold bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 border-0">
            {spinning ? <Loader2 className="h-5 w-5 animate-spin" /> : `Flip — ${stake} ⚡ · win ${stake * 2}`}
          </Button>
          <div className="text-center text-[11px] mt-2">
            {insufficient ? <span className="text-destructive">Insufficient Sparks</span>
              : limitHit ? <span className="text-destructive">Daily limit reached</span>
              : <span className="text-muted-foreground">{DAILY_LIMIT - todayCount} flips left today</span>}
          </div>
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
                    <span className="text-muted-foreground">Picked <b className="capitalize text-foreground">{h.choice}</b> · landed <b className="capitalize text-foreground">{h.result}</b></span>
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
