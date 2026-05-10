import { useEffect, useState } from "react";
import { getSessionState } from "./CircleSessionTimer";

const TIERS = ["seed", "growth", "harvest"] as const;
const LABELS: Record<string, string> = { seed: "Seed", growth: "Growth", harvest: "Harvest" };

function fmt(ms: number, withHours: boolean) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return withHours ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function CircleStatusBanner() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const states = TIERS.map((t) => ({ tier: t, ...getSessionState(t, now) }));
  const open = states.find((s) => s.status === "open");

  if (open) {
    const remaining = open.target - now;
    return (
      <div className="rounded-3xl border border-primary/50 bg-primary/15 p-4 text-center animate-pulse">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary">🟢 {LABELS[open.tier]} session open now</p>
        <p className="mt-1 font-mono font-display text-2xl text-primary">closes in {fmt(remaining, false)}</p>
      </div>
    );
  }

  // closed: pick soonest upcoming
  const soonest = states.reduce((a, b) => (a.target < b.target ? a : b));
  return (
    <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-4 text-center">
      <p className="text-[10px] uppercase tracking-[0.22em] text-destructive">🔴 Session closed</p>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        Next ({LABELS[soonest.tier]}) opens in
      </p>
      <p className="mt-1 font-mono font-display text-2xl text-foreground">{fmt(soonest.target - now, true)}</p>
    </div>
  );
}

export default CircleStatusBanner;
