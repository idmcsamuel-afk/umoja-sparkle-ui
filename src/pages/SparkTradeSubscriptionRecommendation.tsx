import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Check, X, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyCountry } from "@/hooks/useCountryConfig";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type TierKey = "buyers-club" | "spark-trade-pro" | "fulfilled-by-umoja";

const PRICING: Record<string, Record<TierKey, string | null>> = {
  ZA: { "buyers-club": "R499/mo", "spark-trade-pro": "R999/mo", "fulfilled-by-umoja": "R1,999/mo" },
  NG: { "buyers-club": "₦42,415/mo", "spark-trade-pro": "₦84,915/mo", "fulfilled-by-umoja": null },
  KE: { "buyers-club": "KES 3,953/mo", "spark-trade-pro": "KES 7,926/mo", "fulfilled-by-umoja": null },
  ZM: { "buyers-club": "ZMW 574/mo", "spark-trade-pro": "ZMW 1,149/mo", "fulfilled-by-umoja": null },
  MZ: { "buyers-club": "MZN 1,950/mo", "spark-trade-pro": "MZN 3,905/mo", "fulfilled-by-umoja": null },
};

const TIER_INFO: Record<TierKey, { label: string; tagline: string; features: string[] }> = {
  "buyers-club": {
    label: "Buyers Club",
    tagline: "Start exploring",
    features: [
      "Browse opportunities",
      "Join group buys",
      "Basic dashboard",
    ],
  },
  "spark-trade-pro": {
    label: "Spark Trade Pro",
    tagline: "Unlock reserved inventory",
    features: [
      "7-day inventory reservations",
      "Priority access to group buys",
      "Real-time MOQ tracking",
      "Member insights & analytics",
    ],
  },
  "fulfilled-by-umoja": {
    label: "Fulfilled by Umoja",
    tagline: "We ship for you",
    features: [
      "30-day inventory reservations",
      "White-glove fulfilment & shipping",
      "Branded storefront",
      "Priority support",
    ],
  },
};

function getRecommendedTier(incomeGoal: number, country: string): TierKey {
  if (incomeGoal <= 5000) return "buyers-club";
  if (incomeGoal <= 20000) return "spark-trade-pro";
  if (country === "ZA") return "fulfilled-by-umoja";
  return "spark-trade-pro";
}

const READINESS_ITEMS = [
  { key: "businessRegistered", label: "Business Registered", help: "Formal registration (CIPC, CAC, etc.)" },
  { key: "supplierContacts", label: "Supplier Contacts Ready", help: "Reached out to 2+ suppliers" },
  { key: "capitalConfirmed", label: "Capital Confirmed", help: "Your capital is available for first order" },
  { key: "shippingPlan", label: "Shipping Plan Set", help: "Know how you'll receive & deliver products" },
] as const;

type ReadinessKey = (typeof READINESS_ITEMS)[number]["key"];

export default function SparkTradeSubscriptionRecommendation() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const { config } = useMyCountry();
  const [incomeGoal, setIncomeGoal] = useState<number>(10000);
  const [capital, setCapital] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<ReadinessKey, boolean>>({
    businessRegistered: false,
    supplierContacts: false,
    capitalConfirmed: false,
    shippingPlan: false,
  });
  const [showAllTiers, setShowAllTiers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TierKey | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("spark_trade_income_goal, spark_trade_capital")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setIncomeGoal((data as any).spark_trade_income_goal ?? 10000);
        setCapital((data as any).spark_trade_capital ?? null);
      }
    })();
  }, [user]);

  const country = (config.country_code || "ZA").toUpperCase();
  const pricing = PRICING[country] ?? PRICING.ZA;
  const recommended = getRecommendedTier(incomeGoal, country);
  const tiers: TierKey[] = ["buyers-club", "spark-trade-pro", "fulfilled-by-umoja"];
  const visibleTiers = tiers.filter((t) => pricing[t] !== null);

  const readinessPct = useMemo(
    () =>
      Math.round(
        (Object.values(checks).filter(Boolean).length / READINESS_ITEMS.length) * 100
      ),
    [checks]
  );

  const handleContinue = async () => {
    if (!user) return;
    const tier = selectedTier ?? recommended;
    setSubmitting(true);
    try {
      // Persist tier choice but do NOT mark onboarding complete yet
      await supabase
        .from("spark_trade_subscriptions" as any)
        .upsert(
          { member_id: user.id, tier, status: "pending" },
          { onConflict: "member_id" }
        );
      nav("/spark-trade/onboarding/summary", { state: { tier } });
    } catch (err: any) {
      console.error("[Subscription] save tier failed", err);
      toast.error(err?.message ?? "Failed to save selection");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rec = TIER_INFO[recommended];
  const recPrice = pricing[recommended];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Step 5 of 10</span>
            <span>Spark Trade Launchpad</span>
          </div>
          <Progress value={50} className="h-1.5" />
        </div>

        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
          Ready to launch your business?
        </h1>
        <p className="text-muted-foreground mb-6">
          Pick the right plan and review your readiness.
        </p>

        {/* SECTION A */}
        <div className="rounded-3xl border border-border bg-card shadow-sm p-6 md:p-8 mb-6">
          <h2 className="font-display text-lg font-bold mb-4 text-foreground">
            Subscription Recommendation
          </h2>

          <div className="rounded-2xl border-2 border-primary bg-primary/5 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              Recommended for your goals
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="font-display text-xl font-bold text-foreground">{rec.label}</h3>
              <p className="text-base font-semibold text-accent">{recPrice}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Based on your R{incomeGoal.toLocaleString()}/month income goal:
            </p>
            <ul className="mt-3 space-y-1.5">
              {rec.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setShowAllTiers((s) => !s)}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            {showAllTiers ? "Hide" : "See all"} tiers
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showAllTiers ? "rotate-180" : ""}`}
            />
          </button>

          {showAllTiers && (
            <div className="mt-4 space-y-3">
              {visibleTiers.map((t) => {
                const isSelected = (selectedTier ?? recommended) === t;
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setSelectedTier(t)}
                    className={`w-full text-left rounded-xl border p-4 transition ${
                      isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{TIER_INFO[t].label}</h4>
                      <p className="text-sm font-semibold text-accent">{pricing[t]}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{TIER_INFO[t].tagline}</p>
                    <ul className="mt-2 space-y-1">
                      {TIER_INFO[t].features.map((f) => (
                        <li key={f} className="text-xs text-foreground flex items-start gap-1.5">
                          <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
              {country !== "ZA" && (
                <p className="text-xs text-muted-foreground italic">
                  Fulfilled by Umoja currently available in South Africa only.
                </p>
              )}
            </div>
          )}
        </div>

        {/* SECTION B */}
        <div className="rounded-3xl border border-border bg-card shadow-sm p-6 md:p-8 mb-6">
          <h2 className="font-display text-lg font-bold mb-4 text-foreground">
            Inventory Readiness Assessment
          </h2>
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">
                {readinessPct}% complete
              </span>
              <span className="text-muted-foreground">
                {Object.values(checks).filter(Boolean).length} of {READINESS_ITEMS.length}
              </span>
            </div>
            <Progress value={readinessPct} className="h-2 mt-2" />
          </div>

          <div className="space-y-2">
            {READINESS_ITEMS.map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30"
              >
                <Checkbox
                  checked={checks[item.key]}
                  onCheckedChange={(v) =>
                    setChecks((c) => ({ ...c, [item.key]: !!v }))
                  }
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.key === "capitalConfirmed" && capital
                      ? `Your R${capital.toLocaleString()} available for first order`
                      : item.help}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Button
          onClick={handleContinue}
          disabled={submitting}
          className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
            </>
          ) : (
            `Continue with ${TIER_INFO[selectedTier ?? recommended].label} →`
          )}
        </Button>
      </div>
    </div>
  );
}
