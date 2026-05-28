import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Wallet, ShoppingCart, ArrowDownToLine, AlertCircle } from "lucide-react";

interface Breakdown {
  promotional: number;
  earned: number;
  purchased: number;
  total: number;
  withdrawable: number;
  promo_expires_at: string | null;
  zar_value: number;
}

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export function SparkBalanceWidget() {
  const { user } = useAuth();
  const [data, setData] = useState<Breakdown | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: res } = await supabase.rpc("spark_balance_breakdown", { _member: user.id });
    if (res) setData(res as unknown as Breakdown);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("spark-wallet-" + user.id + "-" + Math.random().toString(36).slice(2, 9))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spark_wallets", filter: `member_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line
  }, [user?.id]);

  if (!data) return null;

  const promoDays = daysUntil(data.promo_expires_at);
  const promoUrgent = promoDays !== null && promoDays <= 5 && data.promotional > 0;

  return (
    <section className="px-5 pt-4">
      <div className="mx-auto max-w-md rounded-2xl border border-primary/30 bg-gradient-to-br from-card to-primary/5 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Your Spark Balance</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            ≈ R{data.zar_value.toLocaleString("en-ZA")}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {/* Promotional */}
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-orange-600 dark:text-orange-300">
                Promotional Sparks
              </span>
              <span className="text-lg font-bold text-orange-700 dark:text-orange-200">
                {data.promotional}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Hard Mode (30% win) · Not withdrawable
              {promoDays !== null && data.promotional > 0 && (
                <span className={promoUrgent ? " text-destructive font-medium" : ""}>
                  {" "}· Expires in {promoDays}d
                </span>
              )}
            </p>
          </div>

          {/* Earned */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Earned Sparks
              </span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-200">
                {data.earned}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Normal (45% win) · Withdrawable ✓</p>
          </div>

          {/* Purchased */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Purchased Sparks
              </span>
              <span className="text-lg font-bold text-blue-700 dark:text-blue-200">
                {data.purchased}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Normal (45% win) · Withdrawable ✓</p>
          </div>

          {/* Totals */}
          <div className="rounded-xl bg-foreground/5 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Total Balance</span>
              <span className="text-xl font-extrabold">{data.total}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Withdrawable
              </span>
              <span className="font-medium text-foreground">{data.withdrawable}</span>
            </div>
          </div>
        </div>

        {promoUrgent && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Your promo sparks expire soon — play or contribute to a Circle to convert them.</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to="/buy-sparks"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <ShoppingCart className="h-4 w-4" /> Buy More
          </Link>
          <Link
            to="/withdraw"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold transition hover:bg-accent/10"
          >
            <ArrowDownToLine className="h-4 w-4" /> Withdraw
          </Link>
        </div>
      </div>
    </section>
  );
}
