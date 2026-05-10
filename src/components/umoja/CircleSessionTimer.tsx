import { useEffect, useState } from "react";
import { useTimezone, formatTime, tzAbbrev } from "@/hooks/useTimezone";

const SAST_TZ = "Africa/Johannesburg";
function timeStamp(ts: number, tz: string) {
  const showBoth = tz !== SAST_TZ;
  const local = `${formatTime(ts, tz)} ${tzAbbrev(ts, tz)}`;
  return showBoth ? `${local} · ${formatTime(ts, SAST_TZ)} SAST` : `${local}`;
}

// SAST = UTC+2 (no DST)
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const SESSION_LEN_MS = 60 * 60 * 1000; // 1 hour

type TierKey = "seed" | "growth" | "harvest";

// Each rule produces session start times (in SAST wall clock) for a given SAST date.
// Returns absolute UTC ms timestamps for session starts.
function sastDayStartUTC(now: number) {
  // Get SAST date components from now
  const sastNow = new Date(now + SAST_OFFSET_MS);
  // We want UTC midnight that corresponds to SAST midnight of that day
  const y = sastNow.getUTCFullYear();
  const m = sastNow.getUTCMonth();
  const d = sastNow.getUTCDate();
  // SAST midnight = UTC midnight - 2h
  return Date.UTC(y, m, d) - SAST_OFFSET_MS;
}

function sastDayOfWeek(ts: number) {
  // 0 = Sunday ... 1 = Mon ... 6 = Sat (SAST)
  return new Date(ts + SAST_OFFSET_MS).getUTCDay();
}

function buildSessionsForDay(tier: TierKey, sastMidnightUTC: number): number[] {
  const dow = sastDayOfWeek(sastMidnightUTC + 60_000);
  if (tier === "seed") {
    return [sastMidnightUTC + 8 * 3600_000, sastMidnightUTC + 18 * 3600_000];
  }
  if (tier === "growth") {
    return [sastMidnightUTC + 10 * 3600_000];
  }
  // harvest: Mon (1), Wed (3), Fri (5) at 09:00 SAST
  if (dow === 1 || dow === 3 || dow === 5) {
    return [sastMidnightUTC + 9 * 3600_000];
  }
  return [];
}

export interface SessionState {
  status: "open" | "closed";
  // For "open": session end timestamp
  // For "closed": next session start timestamp
  target: number;
  // For closed: optional secondary upcoming session
  secondaryNext?: number;
  // human label of next session day, e.g. "Monday"
  nextDayLabel?: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function nextSessions(tier: TierKey, now: number, count = 3): number[] {
  const out: number[] = [];
  let cursor = sastDayStartUTC(now);
  for (let i = 0; i < 14 && out.length < count; i++) {
    const sessions = buildSessionsForDay(tier, cursor);
    for (const s of sessions) {
      if (s + SESSION_LEN_MS > now) out.push(s);
      if (out.length >= count) break;
    }
    cursor += 24 * 3600_000;
  }
  return out;
}

export function getSessionState(tier: TierKey, now: number): SessionState & { upcoming: number[] } {
  const upcoming = nextSessions(tier, now, 3);
  if (upcoming.length === 0) {
    return { status: "closed", target: now + 24 * 3600_000, upcoming: [] };
  }
  const first = upcoming[0];
  if (now >= first && now < first + SESSION_LEN_MS) {
    return {
      status: "open",
      target: first + SESSION_LEN_MS,
      secondaryNext: upcoming[1],
      upcoming,
    };
  }
  const dow = sastDayOfWeek(first + 60_000);
  return {
    status: "closed",
    target: first,
    secondaryNext: upcoming[1],
    nextDayLabel: DAY_NAMES[dow],
    upcoming,
  };
}

function fmt(ms: number, withHours = true) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return withHours ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function CircleSessionTimer({ tier }: { tier: string }) {
  const key = (tier?.toLowerCase() as TierKey) || "seed";
  const isKnown = key === "seed" || key === "growth" || key === "harvest";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!isKnown) return null;

  const state = getSessionState(key, now);

  if (state.status === "open") {
    const remaining = state.target - now;
    return (
      <div className="rounded-3xl border border-primary/50 bg-primary/15 p-5 text-center animate-pulse">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary">🟢 Session open now</p>
        <p className="mt-2 font-mono font-display text-3xl text-primary">closes in {fmt(remaining, false)}</p>
      </div>
    );
  }

  // closed
  if (key === "seed") {
    // two upcoming
    const [a, b] = state.upcoming;
    const dowA = sastDayOfWeek((a ?? now) + 60_000);
    const isMorningA = a ? new Date(a + SAST_OFFSET_MS).getUTCHours() === 8 : true;
    const labelA = isMorningA ? "Morning" : "Evening";
    const labelB = labelA === "Morning" ? "Evening" : "Morning";
    return (
      <div className="rounded-3xl border border-accent/30 bg-gradient-card p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-accent">🔴 Session closed</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{labelA} session opens in</p>
            <p className="mt-1 font-mono font-display text-2xl text-gradient-gold">{fmt(a - now)}</p>
          </div>
          {b && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{labelB} session opens in</p>
              <p className="mt-1 font-mono font-display text-2xl text-gradient-gold">{fmt(b - now)}</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">Daily 08:00 & 18:00 SAST · 1h window</p>
      </div>
    );
  }

  if (key === "growth") {
    return (
      <div className="rounded-3xl border border-accent/30 bg-gradient-card p-5 text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] text-accent">🔴 Session closed</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">Next session opens in</p>
        <p className="mt-1 font-mono font-display text-4xl text-gradient-gold">{fmt(state.target - now)}</p>
        <p className="mt-2 text-[10px] text-muted-foreground">Daily 10:00 SAST · 1h window</p>
      </div>
    );
  }

  // harvest
  return (
    <div className="rounded-3xl border border-accent/30 bg-gradient-card p-5 text-center">
      <p className="text-[10px] uppercase tracking-[0.22em] text-accent">🔴 Session closed</p>
      <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        Next session: <span className="text-foreground font-medium">{state.nextDayLabel}</span> opens in
      </p>
      <p className="mt-1 font-mono font-display text-4xl text-gradient-gold">{fmt(state.target - now)}</p>
      <p className="mt-2 text-[10px] text-muted-foreground">Mon · Wed · Fri 09:00 SAST · 1h window</p>
    </div>
  );
}

export default CircleSessionTimer;
