import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, RefreshCw, TrendingUp, Wallet, BarChart3, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Product = {
  name: string;
  moq: number;
  unit_cost_zar: number;
  suggested_selling_price_zar?: number;
};

type Blueprint = {
  recommended_business_name: string;
  recommended_products: Product[];
  estimated_startup_capital: number;
  estimated_monthly_revenue: number;
  estimated_gross_margin: string | number;
  overall_moq_fill_percentage: number;
  estimated_launch_timeline_days: number;
  confidence_score: number;
};

export default function SparkTradeAIBlueprint() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!user) return;
    setGenerating(true);
    setError(null);
    try {
      // Check if blueprint exists already
      const { data: existing } = await supabase
        .from("spark_trade_blueprints" as any)
        .select("blueprint_json")
        .eq("member_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing && (existing as any).blueprint_json) {
        setBlueprint((existing as any).blueprint_json as Blueprint);
        setGenerating(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-spark-trade-blueprint",
        { body: { memberId: user.id } }
      );
      if (fnError) throw fnError;
      if (!data) throw new Error("No blueprint returned");
      setBlueprint(data as Blueprint);
    } catch (err: any) {
      console.error("[AIBlueprint] generate failed", err);
      setError(err?.message ?? "Failed to generate blueprint. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = async () => {
    if (!user) return;
    setGenerating(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-spark-trade-blueprint",
        { body: { memberId: user.id, force: true } }
      );
      if (fnError) throw fnError;
      setBlueprint(data as Blueprint);
      toast.success("Blueprint regenerated");
    } catch (err: any) {
      setError(err?.message ?? "Failed to regenerate.");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (user && !blueprint && !generating) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            Personalised plan based on your goals & preferences
          </p>

          {generating && (
            <div className="mt-10 flex flex-col items-center text-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Generating your blueprint... this takes 5–10 seconds.
              </p>
            </div>
          )}

          {error && !generating && (
            <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center">
              <p className="text-sm text-destructive mb-3">{error}</p>
              <Button variant="outline" onClick={generate} className="rounded-xl">
                <RefreshCw className="h-4 w-4 mr-2" /> Try again
              </Button>
            </div>
          )}

          {blueprint && !generating && (
            <div className="mt-8 space-y-6">
              {/* Business Name */}
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5">
                <p className="text-xs uppercase tracking-wider text-primary mb-1">
                  Recommended Business
                </p>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {blueprint.recommended_business_name}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Confidence: {blueprint.confidence_score}%
                </p>
              </div>

              {/* Products */}
              <div>
                <h3 className="font-semibold mb-3 text-foreground">Recommended Products</h3>
                <div className="space-y-2">
                  {blueprint.recommended_products.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-background p-3 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          MOQ: {p.moq} · Cost: R{p.unit_cost_zar}
                        </p>
                      </div>
                      {p.suggested_selling_price_zar && (
                        <p className="text-sm font-semibold text-accent">
                          R{p.suggested_selling_price_zar}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <Metric icon={Wallet} label="Startup Capital" value={`R${blueprint.estimated_startup_capital.toLocaleString()}`} />
                <Metric icon={TrendingUp} label="Monthly Revenue" value={`R${blueprint.estimated_monthly_revenue.toLocaleString()}`} />
                <Metric icon={BarChart3} label="Gross Margin" value={`${blueprint.estimated_gross_margin}${typeof blueprint.estimated_gross_margin === "number" ? "%" : ""}`} />
                <Metric icon={Clock} label="Launch Timeline" value={`${blueprint.estimated_launch_timeline_days} days`} />
              </div>

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
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-xs">{label}</p>
      </div>
      <p className="font-display text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
