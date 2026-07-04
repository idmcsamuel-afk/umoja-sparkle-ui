import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Wallet,
  BarChart3,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemberTier, fmtZar } from "@/lib/sparkTradeMoq";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const CAPITAL_BANDS = [2500, 5000, 10000, 20000];
const MIN_CAPITAL = 2500;

type BasketItem = {
  opportunity_id: string;
  name: string;
  image_url: string | null;
  member_moq_units: number;
  landed_cost_per_unit_zar: number;
  selling_price_zar: number;
  investment_zar: number;
  potential_profit_zar: number;
  margin_pct: number;
};

type Blueprint = {
  version: number;
  recommended_business_name: string;
  tier_label: string;
  product_limit: number;
  capital_zar: number;
  basket: {
    items: BasketItem[];
    total_investment_zar: number;
    potential_gross_profit_zar: number;
    blended_margin_pct: number;
    product_count: number;
  };
  next_band: null | {
    capital_zar: number;
    product_count: number;
    total_investment_zar: number;
    potential_gross_profit_zar: number;
    additional_products: number;
    additional_profit_zar: number;
  };
  tier_upgrade_nudge: null | {
    message: string | null;
    unspent_zar: number;
  };
  estimated_first_stock: string;
  confidence_score: number;
};

export default function SparkTradeAIBlueprint() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const { tier, bufferPct } = useMemberTier();
  const [capital, setCapital] = useState<number | null>(null);
  const [capitalPicked, setCapitalPicked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preload existing capital & most recent blueprint (only used if capital matches)
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("spark_trade_capital")
        .eq("id", user.id)
        .maybeSingle();
      if (!alive) return;
      const cap = Number((data as any)?.spark_trade_capital) || 0;
      if (cap >= MIN_CAPITAL) setCapital(cap);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const callBlueprintFn = async (payload: Record<string, unknown>) => {
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess?.session?.access_token;
    if (!accessToken) throw new Error("Your session expired. Please sign in again.");
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-spark-trade-blueprint`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? `Blueprint failed (HTTP ${res.status})`);
    return body as Blueprint;
  };

  const generate = async (cap: number) => {
    if (!user) return;
    if (cap < MIN_CAPITAL) {
      setError(`Minimum starting capital is ${fmtZar(MIN_CAPITAL)}.`);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const data = await callBlueprintFn({ memberId: user.id, capital: cap });
      setBlueprint(data);
    } catch (err: any) {
      console.error("[AIBlueprint] generate failed", err);
      setError(err?.message ?? "Failed to generate blueprint.");
    } finally {
      setGenerating(false);
    }
  };

  const pickCapital = (v: number) => {
    setCapital(v);
    setCapitalPicked(true);
    setBlueprint(null);
    generate(v);
  };

  const regenerate = () => {
    if (capital) generate(capital);
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showCapitalPicker = !blueprint && !generating;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Step 3 of 10</span>
            <span>Spark Trade Launchpad</span>
          </div>
          <Progress value={30} className="h-1.5" />
        </div>

        <div className="rounded-3xl border border-border bg-card shadow-sm p-6 md:p-10">
          <div className="flex justify-center mb-6">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>

          <h1 className="font-display text-2xl md:text-[28px] font-bold text-center text-foreground">
            Your AI Business Blueprint
          </h1>
          <p className="mt-2 text-center text-base text-muted-foreground">
            Personalised, capital-driven — real numbers, no promises.
          </p>

          {showCapitalPicker && (
            <div className="mt-8">
              <p className="text-sm font-semibold mb-3 text-foreground">
                How much are you starting with?
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Minimum {fmtZar(MIN_CAPITAL)}. Pick the band closest to your available capital —
                your basket is built to fit it.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CAPITAL_BANDS.map((b) => {
                  const selected = capital === b;
                  return (
                    <button
                      key={b}
                      onClick={() => pickCapital(b)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <p className="font-display text-lg font-bold">
                        {b >= 20000 ? "R20,000+" : fmtZar(b)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {b === MIN_CAPITAL ? "Starter" : b === 5000 ? "Comfortable" : b === 10000 ? "Growth" : "Scale"}
                      </p>
                    </button>
                  );
                })}
              </div>
              {capital && !capitalPicked && (
                <div className="mt-4">
                  <Button
                    onClick={() => pickCapital(capital)}
                    className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow"
                  >
                    Continue with {fmtZar(capital)}
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    Previously saved capital — pick a band to change.
                  </p>
                </div>
              )}
              {error && (
                <p className="mt-3 text-xs text-destructive text-center">{error}</p>
              )}
            </div>
          )}

          {generating && (
            <div className="mt-10 flex flex-col items-center text-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Building your basket for {fmtZar(capital ?? 0)}…
              </p>
            </div>
          )}

          {error && !generating && !showCapitalPicker && (
            <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center">
              <p className="text-sm text-destructive mb-3">{error}</p>
              <Button variant="outline" onClick={regenerate} className="rounded-xl">
                <RefreshCw className="h-4 w-4 mr-2" /> Try again
              </Button>
            </div>
          )}

          {blueprint && !generating && (
            <div className="mt-8 space-y-6">
              {/* Header */}
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5">
                <p className="text-xs uppercase tracking-wider text-primary mb-1">
                  Your plan · {blueprint.tier_label}
                </p>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {blueprint.recommended_business_name}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Starting capital: {fmtZar(blueprint.capital_zar)} · up to{" "}
                  {blueprint.product_limit} products on your tier · Confidence{" "}
                  {blueprint.confidence_score}%
                </p>
              </div>

              {/* Basket */}
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-semibold text-foreground">
                    Recommended basket ({blueprint.basket.product_count})
                  </h3>
                  <button
                    onClick={() => {
                      setBlueprint(null);
                      setCapitalPicked(false);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Change capital
                  </button>
                </div>
                <div className="space-y-2">
                  {blueprint.basket.items.map((p) => (
                    <div
                      key={p.opportunity_id}
                      className="rounded-xl border border-border bg-background p-3 flex gap-3 items-center"
                    >
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.member_moq_units} units × {fmtZar(p.landed_cost_per_unit_zar)} ={" "}
                          {fmtZar(p.investment_zar)} · sell {fmtZar(p.selling_price_zar)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Potential</p>
                        <p className="text-sm font-semibold text-accent">
                          +{fmtZar(p.potential_profit_zar)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Honest Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  icon={Wallet}
                  label="Total Investment"
                  value={fmtZar(blueprint.basket.total_investment_zar)}
                />
                <Metric
                  icon={TrendingUp}
                  label="Potential Gross Profit"
                  value={`+${fmtZar(blueprint.basket.potential_gross_profit_zar)}`}
                  sub="if all stock sells"
                />
                <Metric
                  icon={BarChart3}
                  label="Blended Margin"
                  value={`${blueprint.basket.blended_margin_pct}%`}
                />
                <Metric
                  icon={Clock}
                  label="First Stock"
                  value={blueprint.estimated_first_stock}
                />
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Numbers above are your real basket cost and *potential* profit if every unit sells
                at the listed price. Not guaranteed income.
              </p>

              {/* Upsell — next band */}
              {blueprint.next_band && blueprint.next_band.additional_products > 0 && (
                <button
                  onClick={() => pickCapital(blueprint.next_band!.capital_zar)}
                  className="w-full text-left rounded-2xl border border-accent/30 bg-accent/5 p-4 hover:bg-accent/10 transition"
                >
                  <div className="flex items-start gap-3">
                    <ArrowUpRight className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Unlock more with more capital
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        With {fmtZar(blueprint.capital_zar)} you can start with{" "}
                        {blueprint.basket.product_count} products (potential profit{" "}
                        +{fmtZar(blueprint.basket.potential_gross_profit_zar)} on this batch).
                        Step up to {fmtZar(blueprint.next_band.capital_zar)} to unlock{" "}
                        {blueprint.next_band.additional_products} more products — potential profit
                        +{fmtZar(blueprint.next_band.potential_gross_profit_zar)} on that batch.
                      </p>
                    </div>
                  </div>
                </button>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => nav("/spark-trade/onboarding/ai-store-creation")}
                  className="flex-1 h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow"
                >
                  Create My Store →
                </Button>
                <Button
                  onClick={regenerate}
                  variant="outline"
                  className="h-12 rounded-2xl"
                  title="Regenerate"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Tier applied: {blueprint.tier_label} · pricing includes your tier's landed rate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-xs">{label}</p>
      </div>
      <p className="font-display text-lg font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">*{sub}</p>}
    </div>
  );
}
