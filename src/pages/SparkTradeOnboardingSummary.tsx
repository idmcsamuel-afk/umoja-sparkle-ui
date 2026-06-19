import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Check, Sparkles, Store, Wallet, TrendingUp, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type TierKey = "buyers-club" | "spark-trade-pro" | "fulfilled-by-umoja";

const TIER_LABEL: Record<TierKey, string> = {
  "buyers-club": "Buyers Club",
  "spark-trade-pro": "Spark Trade Pro",
  "fulfilled-by-umoja": "Fulfilled by Umoja",
};

type Product = {
  name: string;
  moq?: number;
  unit_cost_zar?: number;
  suggested_selling_price_zar?: number;
};

type Blueprint = {
  recommended_business_name?: string;
  recommended_products?: Product[];
  estimated_startup_capital?: number;
  estimated_monthly_revenue?: number;
  estimated_gross_margin?: string | number;
};

type Store = {
  store_name?: string;
  store_template?: string;
  banner_color?: string;
  accent_color?: string;
  featured_products?: Product[];
};

export default function SparkTradeOnboardingSummary() {
  const nav = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const tierFromState = (location.state as any)?.tier as TierKey | undefined;

  const [tier, setTier] = useState<TierKey | null>(tierFromState ?? null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setFetching(true);
      try {
        const [{ data: bp }, { data: st }, { data: sub }] = await Promise.all([
          supabase
            .from("spark_trade_blueprints" as any)
            .select("blueprint_json, recommended_business_name, recommended_products")
            .eq("member_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("spark_trade_stores" as any)
            .select("*")
            .eq("member_id", user.id)
            .maybeSingle(),
          supabase
            .from("spark_trade_subscriptions" as any)
            .select("tier")
            .eq("member_id", user.id)
            .maybeSingle(),
        ]);

        if (bp) {
          const json = (bp as any).blueprint_json ?? {};
          setBlueprint({
            recommended_business_name:
              json.recommended_business_name ?? (bp as any).recommended_business_name,
            recommended_products:
              json.recommended_products ?? (bp as any).recommended_products ?? [],
            estimated_startup_capital: json.estimated_startup_capital,
            estimated_monthly_revenue: json.estimated_monthly_revenue,
            estimated_gross_margin: json.estimated_gross_margin,
          });
        }
        if (st) setStore(st as Store);
        if (!tier && sub && (sub as any).tier) setTier((sub as any).tier as TierKey);
      } finally {
        setFetching(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const goToDashboard = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("members")
        .update({
          spark_trade_onboarding_complete: true,
          spark_trade_onboarding_completed_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id);
      if (error) throw error;

      // Activate subscription
      if (tier) {
        await supabase
          .from("spark_trade_subscriptions" as any)
          .upsert(
            { member_id: user.id, tier, status: "active" },
            { onConflict: "member_id" }
          );
      }

      toast.success("Onboarding complete!");
      nav("/spark-trade/dashboard");
    } catch (err: any) {
      console.error("[Summary] complete failed", err);
      toast.error(err?.message ?? "Failed to complete onboarding");
      setSubmitting(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const products = store?.featured_products ?? blueprint?.recommended_products ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Final Review</span>
            <span>Spark Trade Launchpad</span>
          </div>
          <Progress value={100} className="h-1.5" />
        </div>

        <div className="flex justify-center mb-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <BadgeCheck className="h-7 w-7" />
          </div>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-center text-foreground mb-2">
          You're ready to launch
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Review your setup below, then enter your dashboard.
        </p>

        {/* Selected tier */}
        <section className="rounded-3xl border-2 border-primary bg-primary/5 p-6 mb-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Selected subscription
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            {tier ? TIER_LABEL[tier] : "No tier selected"}
          </h2>
        </section>

        {/* Blueprint preview */}
        {blueprint && (
          <section className="rounded-3xl border border-border bg-card shadow-sm p-6 mb-6">
            <h2 className="font-display text-lg font-bold mb-3 text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Business Blueprint
            </h2>
            {blueprint.recommended_business_name && (
              <p className="text-base font-semibold text-foreground mb-3">
                {blueprint.recommended_business_name}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {blueprint.estimated_startup_capital != null && (
                <Metric icon={Wallet} label="Startup capital" value={`R${blueprint.estimated_startup_capital.toLocaleString()}`} />
              )}
              {blueprint.estimated_monthly_revenue != null && (
                <Metric icon={TrendingUp} label="Monthly revenue" value={`R${blueprint.estimated_monthly_revenue.toLocaleString()}`} />
              )}
              {blueprint.estimated_gross_margin != null && (
                <Metric icon={Check} label="Gross margin" value={`${blueprint.estimated_gross_margin}${typeof blueprint.estimated_gross_margin === "number" ? "%" : ""}`} />
              )}
            </div>
          </section>
        )}

        {/* Store preview */}
        {store && (
          <section className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden mb-6">
            <div
              className="h-24"
              style={{ background: store.banner_color ?? "hsl(var(--primary))" }}
            />
            <div className="p-6">
              <h2 className="font-display text-lg font-bold mb-1 text-foreground flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" /> {store.store_name ?? "Your Store"}
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Template: {store.store_template ?? "default"}
              </p>
              {products.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Featured products
                  </p>
                  {products.slice(0, 3).map((p, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-background p-3 flex justify-between items-center"
                    >
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.suggested_selling_price_zar != null && (
                        <p className="text-sm font-semibold" style={{ color: store.accent_color ?? undefined }}>
                          R{p.suggested_selling_price_zar}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <Button
          onClick={goToDashboard}
          disabled={submitting}
          className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finishing...
            </>
          ) : (
            "Go to Dashboard →"
          )}
        </Button>
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
      <p className="font-display text-base font-bold text-foreground">{value}</p>
    </div>
  );
}
