import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { useSparkBalance } from "@/hooks/useSparkBalance";

/**
 * Small read-only Spark balance chip. No balance logic of its own —
 * it reads the shared useSparkBalance hook (spark_balance_breakdown).
 */
export default function SparkBalanceChip({ className = "" }: { className?: string }) {
  const { balance } = useSparkBalance();
  if (balance === null) return null;

  return (
    <Link
      to="/buy-sparks"
      title="Your live Spark balance"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-primary/10 ${className}`}
    >
      <Zap className="h-3.5 w-3.5 text-accent" aria-hidden />
      <span className="tabular-nums">{balance.toLocaleString()}</span>
      <span className="text-muted-foreground">Sparks</span>
    </Link>
  );
}
