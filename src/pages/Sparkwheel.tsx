// ============================================================================
// Sparkwheel — Wheel of Fortune game page
// Route: /spark-pit/sparkwheel
// ----------------------------------------------------------------------------
// Server-authoritative: the outcome is decided entirely by the
// `spin_sparkwheel` Postgres RPC. The client only animates the wheel to land
// on the multiplier the server returned. Slice sizes honestly reflect the odds.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Info, History } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { playWin, playLose, playChime } from "@/lib/sounds";
import { BottomNav } from "@/components/umoja/BottomNav";
import { MuteButton } from "@/components/umoja/MuteButton";
import { SparksDisclaimer } from "@/components/umoja/SparksDisclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type {
  SparkBucket,
  BucketBalances,
  BucketMeta,
  WheelSegment,
  SparkwheelGame,
  SpinSparkwheelResult,
} from "@/types/sparkwheel";

// ----------------------------------------------------------------------------
// Static config — weights MUST match the RPC so slices reflect true odds.
// ----------------------------------------------------------------------------
const DAILY_LIMIT = 10;

const SEGMENTS: WheelSegment[] = [
  { multiplier: 0,   label: "Lose", weightNormal: 550, weightPromo: 700, color: "from-zinc-700 to-zinc-800" },
  { multiplier: 1.2, label: "1.2×", weightNormal: 220, weightPromo: 150, color: "from-amber-500 to-amber-600" },
  { multiplier: 1.5, label: "1.5×", weightNormal: 120, weightPromo: 70,  color: "from-yellow-400 to-amber-500" },
  { multiplier: 2,   label: "2×",   weightNormal: 70,  weightPromo: 50,  color: "from-amber-400 to-yellow-300" },
  { multiplier: 5,   label: "5×",   weightNormal: 30,  weightPromo: 20,  color: "from-yellow-300 to-amber-300" },
  { multiplier: 10,  label: "10×",  weightNormal: 10,  weightPromo: 10,  color: "from-yellow-200 to-amber-200" },
];

const BUCKETS: BucketMeta[] = [
  { key: "earned",      label: "Earned",      emoji: "🟢", withdrawable: "Withdrawable" },
  { key: "purchased",   label: "Purchased",   emoji: "🔵", withdrawable: "Withdrawable" },
  { key: "referral",    label: "Referral",    emoji: "🟣", withdrawable: "Unlocks via Circle" },
  { key: "promotional", label: "Promotional", emoji: "🟡", withdrawable: "Not withdrawable · worse odds" },
];

const HOUSE_EDGE = { normal: 0.166, promo: 0.415 };

// ----------------------------------------------------------------------------
// Geometry helpers — build SVG pie slices sized by probability weight.
// ----------------------------------------------------------------------------
const R = 140; // wheel radius (viewBox units)
const CX = 150;
const CY = 150;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180; // 0deg = 12 o'clock
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(startAngle: number, endAngle: number) {
  const start = polar(CX, CY, R, endAngle);
  const end = polar(CX, CY, R, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

/** Compute start/mid/end angles for each segment given the active weighting. */
function computeSlices(promo: boolean) {
  const total = 1000;
  let acc = 0;
  return SEGMENTS.map((seg) => {
    const w = promo ? seg.weightPromo : seg.weightNormal;
    const start = (acc / total) * 360;
    acc += w;
    const end = (acc / total) * 360;
    return { seg, start, end, mid: (start + end) / 2 };
  });
}

// ----------------------------------------------------------------------------
export default function Sparkwheel() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [balances, setBalances] = useState<BucketBalances>({
    promotional: 0, earned: 0, purchased: 0, referral: 0,
  });
  const [bucket, setBucket] = useState<SparkBucket>("earned");
  const [stake, setStake] = useState<string>("50");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState<SparkwheelGame[]>([]);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [lastResult, setLastResult] = useState<SpinSparkwheelResult | null>(null);

  const wheelRef = useRef<HTMLDivElement>(null);

  const isPromo = bucket === "promotional";
  const slices = useMemo(() => computeSlices(isPromo), [isPromo]);
  const stakeNum = Number(stake) || 0;
  const bucketBalance = balances[bucket] ?? 0;
  const canSpin =
    !spinning &&
    stakeNum > 0 &&
    stakeNum <= bucketBalance &&
    dailyUsed < DAILY_LIMIT &&
    !!memberId;

  // --- Load member, balances, history -------------------------------------
  async function loadState(uid: string) {
    // Balances via shared breakdown RPC.
    const { data: bal } = await supabase.rpc("spark_balance_breakdown", { _member: uid });
    if (bal) {
      setBalances({
        promotional: Number(bal.promotional ?? 0),
        earned: Number(bal.earned ?? 0),
        purchased: Number(bal.purchased ?? 0),
        referral: Number(bal.referral ?? 0),
      });
    }
    // Recent history (RLS restricts to own rows).
    const { data: rows } = await supabase
      .from("sparkwheel_games")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(20);
    if (rows) setHistory(rows as SparkwheelGame[]);

    // Today's spin count.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("sparkwheel_games")
      .select("*", { count: "exact", head: true })
      .gte("timestamp", startOfDay.toISOString());
    setDailyUsed(count ?? 0);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setMemberId(uid);
      if (uid) await loadState(uid);
    })();
  }, []);

  // --- Spin ----------------------------------------------------------------
  async function handleSpin() {
    if (!canSpin || !memberId) return;
    setSpinning(true);
    setLastResult(null);
    playChime();

    try {
      const { data, error } = await supabase.rpc("spin_sparkwheel", {
        p_member_id: memberId,
        p_bucket: bucket,
        p_stake_amount: stakeNum,
      });

      if (error) throw error;
      const result = data as SpinSparkwheelResult;

      // Find the slice for the returned multiplier and animate the wheel so the
      // top pointer lands within that slice (+ several full turns for suspense).
      const target = slices.find((s) => Number(s.seg.multiplier) === Number(result.outcome_multiplier));
      const mid = target ? target.mid : 0;
      const fullTurns = 6 * 360; // suspense build-up
      // Pointer is fixed at top (0deg). To bring slice `mid` to the top we rotate
      // the wheel by (360 - mid). Add jitter within the slice for realism.
      const jitter = target ? (Math.random() - 0.5) * (target.end - target.start) * 0.6 : 0;
      const finalRotation =
        Math.ceil(rotation / 360) * 360 + fullTurns + (360 - mid) + jitter;
      setRotation(finalRotation);

      // Reveal after the CSS transition (~4s).
      window.setTimeout(() => {
        setLastResult(result);
        setBalances(result.balances);
        setDailyUsed(result.daily_game_count);

        if (result.won) {
          playWin();
          toast.success(
            `🎉 ${result.outcome_multiplier}× — you won ${result.payout_amount} ⚡!`,
            { description: "Winnings added to your Earned bucket." }
          );
          // Milestone hook for global celebration overlays.
          if (result.outcome_multiplier >= 5) {
            window.dispatchEvent(
              new CustomEvent("umoja:big-win", {
                detail: { game: "sparkwheel", multiplier: result.outcome_multiplier, payout: result.payout_amount },
              })
            );
          }
        } else {
          playLose();
          toast("😔 No win this time — spin again!", { description: "Fortune favours the persistent." });
        }

        // Refresh history.
        loadState(memberId);
        setSpinning(false);
      }, 4200);
    } catch (err: any) {
      setSpinning(false);
      const msg = err?.message ?? "Something went wrong. Try again.";
      toast.error(msg);
    }
  }

  // --- Render --------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(120,80,10,0.35),_rgba(0,0,0,0.95)_70%)] text-amber-50 pb-24">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/spark-pit"
            className="inline-flex items-center gap-1 text-amber-300/80 hover:text-amber-200 transition"
            aria-label="Back to Spark Pit"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Spark Pit</span>
          </Link>
          <MuteButton />
        </header>

        {/* Title */}
        <div className="mt-3 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
            Sparkwheel
          </h1>
          <p className="mt-1 text-sm text-amber-200/70">
            Spin the wheel. Read the odds. Try your luck 🌟
          </p>
        </div>

        {/* Daily plays counter */}
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-200/80">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{dailyUsed}/{DAILY_LIMIT} spins used today</span>
        </div>

        {/* Wheel */}
        <div className="relative mt-5 flex flex-col items-center">
          {/* Pointer */}
          <div className="absolute -top-1 z-20 h-0 w-0 border-x-[12px] border-x-transparent border-t-[20px] border-t-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
          <div
            ref={wheelRef}
            className="rounded-full p-2 bg-black/40 border border-amber-500/25 shadow-[0_0_40px_rgba(245,158,11,0.15)]"
          >
            <svg
              viewBox="0 0 300 300"
              className="h-72 w-72"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
                  : "none",
              }}
            >
              {slices.map(({ seg, start, end, mid }, i) => {
                const isLose = seg.multiplier === 0;
                const labelPos = polar(CX, CY, R * 0.66, mid);
                return (
                  <g key={i}>
                    <path
                      d={arcPath(start, end)}
                      fill={isLose ? "#3f3f46" : sliceFill(seg.multiplier)}
                      stroke="rgba(0,0,0,0.35)"
                      strokeWidth={1.5}
                    />
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                      className="fill-black/85 font-bold"
                      fontSize={seg.multiplier >= 5 ? 15 : 13}
                    >
                      {seg.label}
                    </text>
                  </g>
                );
              })}
              {/* Hub */}
              <circle cx={CX} cy={CY} r={22} fill="#0a0a0a" stroke="#f59e0b" strokeWidth={3} />
              <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize={20}>
                ⚡
              </text>
            </svg>
          </div>

          {/* Result banner */}
          {lastResult && (
            <div
              className={`mt-4 rounded-xl px-4 py-2 text-center border ${
                lastResult.won
                  ? "border-amber-400/50 bg-amber-500/10 text-amber-200"
                  : "border-zinc-600/50 bg-zinc-800/40 text-zinc-300"
              }`}
            >
              {lastResult.won ? (
                <span className="font-bold">
                  {lastResult.outcome_multiplier}× · +{lastResult.payout_amount} ⚡ → Earned
                </span>
              ) : (
                <span className="font-semibold">No win — spin again!</span>
              )}
            </div>
          )}
        </div>

        {/* Bucket selector */}
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-300/70">
            Play with
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {BUCKETS.map((b) => {
              const active = bucket === b.key;
              const bal = balances[b.key] ?? 0;
              const disabled = bal <= 0;
              return (
                <button
                  key={b.key}
                  disabled={disabled}
                  onClick={() => setBucket(b.key)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-amber-400 bg-amber-500/15 shadow-[0_0_18px_rgba(245,158,11,0.2)]"
                      : "border-amber-500/20 bg-black/40 hover:border-amber-400/50"
                  } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {b.emoji} {b.label}
                    </span>
                    <span className="text-sm tabular-nums">{bal.toLocaleString()} ⚡</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-amber-200/60">{b.withdrawable}</p>
                </button>
              );
            })}
          </div>

          {/* Mode indicator */}
          <div
            className={`mt-2 rounded-lg px-3 py-1.5 text-center text-xs font-medium ${
              isPromo
                ? "bg-red-500/15 text-red-300 border border-red-500/30"
                : "bg-amber-500/10 text-amber-200 border border-amber-500/20"
            }`}
          >
            {isPromo
              ? `Hard Mode · ${(HOUSE_EDGE.promo * 100).toFixed(1)}% house edge (promotional)`
              : `Normal Mode · ${(HOUSE_EDGE.normal * 100).toFixed(1)}% house edge`}
          </div>
        </section>

        {/* Stake input */}
        <section className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-300/70">
            Stake (⚡)
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="bg-black/40 border-amber-500/25 text-amber-50"
              placeholder="Enter stake"
            />
            <div className="flex gap-1">
              {[20, 50, 100, 200].map((q) => (
                <button
                  key={q}
                  onClick={() => setStake(String(q))}
                  className="rounded-md border border-amber-500/25 bg-black/40 px-2 py-1 text-xs hover:border-amber-400/60"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          {stakeNum > bucketBalance && (
            <p className="mt-1 text-xs text-red-300">
              Not enough {bucket} sparks (have {bucketBalance.toLocaleString()} ⚡).
            </p>
          )}
        </section>

        {/* Spin button */}
        <Button
          onClick={handleSpin}
          disabled={!canSpin}
          className="mt-5 h-14 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-300 text-lg font-extrabold text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] hover:from-amber-300 hover:to-yellow-200 disabled:opacity-40"
        >
          {spinning
            ? "Spinning…"
            : dailyUsed >= DAILY_LIMIT
            ? "Daily limit reached"
            : `Spin — ${stakeNum || 0} ⚡`}
        </Button>

        {/* House edge documentation */}
        <section className="mt-6 rounded-xl border border-amber-500/20 bg-black/40 p-4">
          <div className="flex items-center gap-2 text-amber-300">
            <Info className="h-4 w-4" />
            <h3 className="text-sm font-semibold">How the odds work</h3>
          </div>
          <p className="mt-2 text-xs text-amber-200/70">
            Every spin is decided securely on our servers. Slice sizes on the
            wheel reflect the real chance of each outcome. Winnings always land in
            your <span className="text-amber-200 font-medium">Earned</span> bucket.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-amber-500/15">
            <table className="w-full text-xs">
              <thead className="bg-amber-500/10 text-amber-200">
                <tr>
                  <th className="px-2 py-1.5 text-left">Outcome</th>
                  <th className="px-2 py-1.5 text-right">Normal</th>
                  <th className="px-2 py-1.5 text-right">Promo</th>
                </tr>
              </thead>
              <tbody className="text-amber-100/80">
                {SEGMENTS.map((s) => (
                  <tr key={s.multiplier} className="border-t border-amber-500/10">
                    <td className="px-2 py-1.5">{s.label}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {(s.weightNormal / 10).toFixed(1)}%
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {(s.weightPromo / 10).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-amber-500/20 font-semibold text-amber-200">
                  <td className="px-2 py-1.5">House edge</td>
                  <td className="px-2 py-1.5 text-right">{(HOUSE_EDGE.normal * 100).toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right">{(HOUSE_EDGE.promo * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent history */}
        <section className="mt-6">
          <div className="flex items-center gap-2 text-amber-300/80">
            <History className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Recent spins</h3>
          </div>
          <div className="mt-2 space-y-1.5">
            {history.length === 0 && (
              <p className="text-xs text-amber-200/50">No spins yet — take the first one!</p>
            )}
            {history.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-lg border border-amber-500/15 bg-black/40 px-3 py-2 text-xs"
              >
                <span className="text-amber-200/70">
                  {new Date(g.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {g.bucket_used}
                </span>
                <span className="tabular-nums text-amber-200/70">
                  {g.stake_amount} ⚡ → {g.outcome_multiplier}×
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    g.payout_amount > 0 ? "text-amber-300" : "text-zinc-400"
                  }`}
                >
                  {g.payout_amount > 0 ? `+${g.payout_amount}` : `-${g.stake_amount}`} ⚡
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <div className="mt-6">
          <SparksDisclaimer />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

// Resolve a solid fill colour for a slice (SVG can't use Tailwind gradients
// directly on <path fill>, so map multiplier → hex for the pie).
function sliceFill(multiplier: number): string {
  switch (multiplier) {
    case 1.2: return "#d97706"; // amber-600
    case 1.5: return "#f59e0b"; // amber-500
    case 2:   return "#fbbf24"; // amber-400
    case 5:   return "#fcd34d"; // amber-300
    case 10:  return "#fde68a"; // amber-200
    default:  return "#3f3f46"; // zinc-700 (lose)
  }
}
