import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { getSessionState } from "./CircleSessionTimer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTimezone, formatTime, tzAbbrev } from "@/hooks/useTimezone";

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

function HelpDot() {
  const content = (
    <div className="space-y-2 text-left">
      <p className="font-display text-sm">What is a session?</p>
      <p className="text-xs text-muted-foreground">
        A <span className="text-foreground">session</span> is a time window when you can place
        bids in a Circle. Outside the window the Circle is closed and the countdown shows when
        it next opens.
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>
          <span className="text-foreground">🌱 Seed</span> — twice daily (08:00 & 18:00 SAST)
        </li>
        <li>
          <span className="text-foreground">🌿 Growth</span> — once daily (10:00 SAST)
        </li>
        <li>
          <span className="text-foreground">🌾 Harvest</span> — Mon / Wed / Fri (09:00 SAST)
        </li>
      </ul>
      <p className="text-[11px] text-muted-foreground">
        The banner shows the soonest tier — open countdowns are green, closed are red.
      </p>
    </div>
  );

  return (
    <>
      {/* Desktop: hover tooltip */}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="What does session open mean?"
              className="hidden md:inline-grid place-items-center h-5 w-5 rounded-full bg-background/40 text-muted-foreground hover:text-foreground transition-smooth"
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{content}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Mobile: tap popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="What does session open mean?"
            className="md:hidden inline-grid place-items-center h-5 w-5 rounded-full bg-background/40 text-muted-foreground"
          >
            <Info className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-w-xs rounded-2xl">{content}</PopoverContent>
      </Popover>
    </>
  );
}

export function CircleStatusBanner() {
  const [now, setNow] = useState(() => Date.now());
  const [tz] = useTimezone();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const states = TIERS.map((t) => ({ tier: t, ...getSessionState(t, now) }));
  const open = states.find((s) => s.status === "open");
  const SAST = "Africa/Johannesburg";
  const showBoth = tz !== SAST;

  if (open) {
    const remaining = open.target - now;
    const handleJump = () => {
      const goTo = () => {
        const el = document.getElementById(`tier-${open.tier}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      if (window.location.pathname !== "/circle") {
        window.location.href = `/circle#tier-${open.tier}`;
      } else {
        goTo();
      }
    };
    return (
      <button
        type="button"
        onClick={handleJump}
        aria-label={`Jump to ${LABELS[open.tier]} circle — session live`}
        className="w-full text-left rounded-3xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-center text-white shadow-[0_8px_32px_rgba(16,185,129,0.45)] animate-pulse-glow cursor-pointer transition-smooth hover:brightness-110 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg animate-pulse">🔥</span>
          <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-white">
            {LABELS[open.tier]} session live — click to bid →
          </p>
          <HelpDot />
        </div>
        <p className="mt-2 font-mono font-display text-3xl text-white drop-shadow">
          closes in {fmt(remaining, false)}
        </p>
        <p className="mt-1 text-[10px] text-white/80">
          closes {formatTime(open.target, tz)} {tzAbbrev(open.target, tz)}
          {showBoth && <> · {formatTime(open.target, SAST)} SAST</>}
        </p>
      </button>
    );
  }

  const soonest = states.reduce((a, b) => (a.target < b.target ? a : b));
  return (
    <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-destructive">🔴 Session closed</p>
        <HelpDot />
      </div>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        Next ({LABELS[soonest.tier]}) opens in
      </p>
      <p className="mt-1 font-mono font-display text-2xl text-foreground">
        {fmt(soonest.target - now, true)}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        opens {formatTime(soonest.target, tz)} {tzAbbrev(soonest.target, tz)}
        {showBoth && <> · {formatTime(soonest.target, SAST)} SAST</>}
      </p>
    </div>
  );
}

export default CircleStatusBanner;
