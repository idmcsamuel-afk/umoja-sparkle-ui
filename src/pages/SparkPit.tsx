import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Trophy, Coins, Dice5, Eye } from "lucide-react";
import { BottomNav } from "@/components/umoja/BottomNav";
import { SparksDisclaimer } from "@/components/umoja/SparksDisclaimer";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function SparkPit() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [todayWon, setTodayWon] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: br } = await supabase.rpc("spark_balance_breakdown", { _member: user.id });
      setBalance(Number((br as any)?.total_playable ?? (br as any)?.total ?? 0));
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const { data: flips } = await supabase
        .from("spark_flip_games").select("payout").eq("member_id", user.id).gte("created_at", since.toISOString());
      const fSum = (flips ?? []).reduce((s, r: any) => s + Number(r.payout || 0), 0);
      setTodayWon(fSum);
    })();
  }, [user]);

  return (
    <div className="min-h-screen pb-32 bg-[radial-gradient(ellipse_at_top,hsl(44_60%_22%/0.5),hsl(150_18%_5%)_55%)]">
      <header className="px-5 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
            🎮 Spark Pit
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Las Vegas meets Ubuntu</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Your Sparks</div>
          <div className="text-2xl font-bold text-amber-300 flex items-center gap-1 justify-end">
            <Sparkles className="h-5 w-5" /> {balance.toLocaleString()}
          </div>
        </div>
      </header>

      <div className="px-5 mb-5">
        <Card className="p-3 flex items-center justify-between border-amber-500/25 bg-gradient-to-r from-amber-950/30 to-yellow-950/20">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300" />
            <span className="text-xs text-amber-100/80">Won today</span>
          </div>
          <div className="text-amber-200 font-bold">+{todayWon.toLocaleString()} ⚡</div>
        </Card>
      </div>

      <main className="px-5 space-y-4">
        <GameCard
          to="/spark-pit/dream-draw"
          accent="from-amber-500 to-yellow-300"
          title="Dream Draw"
          tag="🎰 Lottery"
          cost="50 Sparks"
          reward="Cash prize pool"
          desc="Weekly cash draw. Pool grows with every entry."
          visual={<LotteryBalls />}
        />
        <GameCard
          to="/spark-pit/spark-flip"
          accent="from-yellow-400 to-amber-500"
          title="Spark Flip"
          tag="🪙 Coin"
          cost="20 Sparks"
          reward="2x payout"
          desc="Heads or tails. Double or nothing. 10 flips/day."
          visual={<SpinningCoin />}
        />
        <GameCard
          to="/predictor"
          accent="from-emerald-400 to-teal-500"
          title="Umoja Predictor"
          tag="🔮 Predict"
          cost="10 Sparks"
          reward="Up to 25 Sparks"
          desc="Predict markets, sport & community trends."
          visual={<CrystalBall />}
        />
      </main>

      <section className="px-5 pt-6"><div className="mx-auto max-w-md"><SparksDisclaimer /></div></section>
      <BottomNav />
    </div>
  );
}

function GameCard({ to, title, tag, cost, reward, desc, visual, accent }: any) {
  return (
    <Link to={to} className="block group [perspective:1000px]">
      <Card className="relative overflow-hidden border-amber-500/20 bg-gradient-to-br from-card via-card to-amber-950/10 p-4 transition-transform duration-500 group-hover:[transform:rotateX(4deg)_rotateY(-4deg)_translateZ(10px)] shadow-[0_20px_60px_-25px_hsl(44_60%_50%/0.4)]">
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 grid place-items-center rounded-2xl bg-black/40">
            {visual}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-amber-300/80 uppercase tracking-widest">{tag}</div>
            <div className={`text-xl font-bold bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>{title}</div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</p>
            <div className="mt-2 flex items-center gap-3 text-[11px]">
              <span className="text-amber-200/90"><Coins className="inline h-3 w-3" /> {cost}</span>
              <span className="text-emerald-300/90"><Trophy className="inline h-3 w-3" /> {reward}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 text-center text-xs font-semibold text-black bg-gradient-to-r from-amber-300 to-yellow-200 rounded-xl py-2">
          Enter Game →
        </div>
      </Card>
    </Link>
  );
}

function LotteryBalls() {
  return (
    <div className="relative h-16 w-16">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute h-6 w-6 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.3),0_4px_10px_rgba(255,180,0,0.4)] grid place-items-center text-[9px] font-bold text-amber-900"
          style={{
            top: `${20 + Math.sin(i) * 10}px`,
            left: `${10 + i * 15}px`,
            animation: `bounce 1.${i + 4}s ease-in-out infinite`,
          }}
        >
          {[7, 21, 9][i]}
        </div>
      ))}
    </div>
  );
}

function SpinningCoin() {
  return (
    <div className="[perspective:200px]">
      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 shadow-[inset_0_-3px_8px_rgba(120,60,0,0.5),0_8px_20px_rgba(255,180,0,0.4)] grid place-items-center text-amber-900 font-black text-xl"
        style={{ animation: "spin 3s linear infinite", transformStyle: "preserve-3d" }}>
        U
      </div>
    </div>
  );
}

function CrystalBall() {
  return (
    <div className="relative h-16 w-16 grid place-items-center">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-300/40 via-teal-400/30 to-cyan-500/20 blur-md animate-pulse" />
      <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-emerald-200/80 via-teal-300/60 to-emerald-600/80 shadow-[inset_-4px_-4px_10px_rgba(0,40,30,0.5),inset_4px_4px_10px_rgba(255,255,255,0.3)] grid place-items-center">
        <Eye className="h-5 w-5 text-emerald-900" />
      </div>
    </div>
  );
}
