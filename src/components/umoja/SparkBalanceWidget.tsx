import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Wallet, ShoppingCart, ArrowDownToLine, AlertCircle, Info } from "lucide-react";
import { SparksExplainer, BUCKET_TOOLTIPS } from "./SparksExplainer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMyCountry } from "@/hooks/useCountryConfig";
import { formatCurrency, getCurrencyCode } from "@/lib/currency";
import { exchangeRates } from "@/lib/currency";

interface Breakdown {
  promotional: number;
  earned: number;
  purchased: number;
  referral: number;
  total: number;
  total_playable: number;
  withdrawable: number;
  total_withdrawable: number;
  referral_releasable: number;
  referral_locked: number;
  promo_expires_at: string | null;
  zar_value: number;
  has_contributed: boolean;
  qualifying_contribution_zar: number;
}

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export function SparkBalanceWidget() {
  const { user } = useAuth();
  const { config: country } = useMyCountry();
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
            ≈ {formatCurrency(
              data.zar_value * (exchangeRates[getCurrencyCode(country.country_code)] ?? 1),
              getCurrencyCode(country.country_code),
            )}
          </span>
        </div>

        <TooltipProvider delayDuration={150}>
        <div className="mt-4 space-y-3">
          {/* Promotional */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                🟡 Promotional Sparks
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help opacity-60" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-[11px]">{BUCKET_TOOLTIPS.promotional}</TooltipContent>
                </Tooltip>
              </span>
              <span className="text-lg font-bold text-amber-700 dark:text-amber-200">
                {data.promotional}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Play in Spark Pit · Not withdrawable
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
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                🟢 Earned Sparks
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help opacity-60" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-[11px]">{BUCKET_TOOLTIPS.earned}</TooltipContent>
                </Tooltip>
              </span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-200">
                {data.earned}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {data.has_contributed ? "Withdrawable ✓" : "Withdrawable after first contribution"}
            </p>
          </div>

          {/* Purchased */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                🔵 Purchased Sparks
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help opacity-60" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-[11px]">{BUCKET_TOOLTIPS.purchased}</TooltipContent>
                </Tooltip>
              </span>
              <span className="text-lg font-bold text-blue-700 dark:text-blue-200">
                {data.purchased}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Play or withdraw anytime ✓</p>
          </div>

          {/* Referral */}
          <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-300">
                🟣 Referral Sparks
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help opacity-60" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-[11px]">{BUCKET_TOOLTIPS.referral}</TooltipContent>
                </Tooltip>
              </span>
              <span className="text-lg font-bold text-fuchsia-700 dark:text-fuchsia-200">
                {data.referral}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Playable now ·{" "}
              {data.referral_releasable > 0
                ? `${data.referral_releasable} unlocked for cash`
                : "Invest in a Circle to unlock (R3 in → R2 out)"}
              {data.referral_locked > 0 && data.referral_releasable > 0 && (
                <> · {data.referral_locked} still to unlock</>
              )}
            </p>
          </div>

          {/* Totals */}
          <div className="rounded-xl bg-foreground/5 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Total Balance</span>
              <span className="text-xl font-extrabold">{data.total_playable ?? data.total}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Withdrawable
              </span>
              <span className="font-medium text-foreground">
                {data.total_withdrawable ?? data.withdrawable}
              </span>
            </div>
          </div>
        </div>
        <SparksExplainer />
        </TooltipProvider>

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
