import { Sparkles } from "lucide-react";

interface Props {
  total: number;
  /** Optional override labels — defaults to "Member Pool / Platform Fee / Ubuntu Fund" */
  poolLabel?: string;
  className?: string;
}

const fmt = (n: number) =>
  "R" + Math.round(n).toLocaleString("en-ZA");

/**
 * Always-visible 95% / 2% / 3% transparency box.
 * 95% → member pool, 2% → platform fee, 3% → Ubuntu Fund.
 */
export function PaymentBreakdown({ total, poolLabel = "Member Pool", className = "" }: Props) {
  const pool = total * 0.95;
  const platform = total * 0.02;
  const ubuntu = total * 0.03;

  const Row = ({ pct, label, value, color }: { pct: number; label: string; value: number; color: string }) => (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{fmt(value)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );

  return (
    <div className={`rounded-2xl border border-border bg-secondary/40 p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your payment breakdown</p>
      </div>
      <Row pct={95} label={`${poolLabel} (95%)`} value={pool} color="bg-primary" />
      <Row pct={2} label="Platform fee (2%)" value={platform} color="bg-accent" />
      <Row pct={3} label="Ubuntu Fund (3%)" value={ubuntu} color="bg-accent/60" />
      <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
        <span>Total</span>
        <span className="text-gradient-gold font-display">{fmt(total)}</span>
      </div>
    </div>
  );
}
