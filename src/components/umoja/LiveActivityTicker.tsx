import { Zap } from "lucide-react";
import { useSocialProof, timeAgo, type ActivityKind } from "@/hooks/useSocialProof";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityKind, string> = {
  payout: "💰",
  signup: "🎉",
  referral: "🤝",
  bid: "⚡",
};

interface Props { className?: string; }

export function LiveActivityTicker({ className }: Props) {
  const { activity } = useSocialProof();
  if (!activity.length) return null;

  // Double the items so the marquee loops seamlessly.
  const items = [...activity, ...activity];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] py-2",
        className,
      )}
      aria-label="Live member activity"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent z-10" />
      <div className="flex items-center gap-2 px-3">
        <span className="inline-flex items-center gap-1 shrink-0 text-[10px] uppercase tracking-wider text-emerald-400 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <Zap className="h-3 w-3" /> Live
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex gap-6 animate-marquee whitespace-nowrap will-change-transform">
            {items.map((a, i) => (
              <span key={`${a.id}-${i}`} className="text-xs text-foreground/85 inline-flex items-center gap-1.5">
                <span aria-hidden>{ICONS[a.kind]}</span>
                {a.message}
                <span className="text-muted-foreground">· {timeAgo(a.at)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveActivityTicker;
