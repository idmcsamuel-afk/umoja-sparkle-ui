import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Target, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Path = "individual" | "group_brands";

type GoalOption = {
  label: string;
  value: number;
  display: string;
  description: string;
};

const GOAL_OPTIONS: GoalOption[] = [
  { label: "Starter", value: 5000, display: "R5,000/month", description: "Start small, grow steady" },
  { label: "Grower", value: 10000, display: "R10,000/month", description: "Scale beyond basics" },
  { label: "Builder", value: 20000, display: "R20,000/month", description: "Serious side income" },
  { label: "Owner", value: 50000, display: "R50,000/month", description: "Near full-time business" },
  { label: "CEO", value: 100000, display: "R100,000/month", description: "Full-time, multi-product" },
];

export default function SparkTradeIncomeGoal() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [path, setPath] = useState<Path | null>(null);
  const [incomeGoal, setIncomeGoal] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("spark_trade_income_goal, spark_trade_income_path")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.spark_trade_income_goal) setIncomeGoal(data.spark_trade_income_goal);
      const storedPath = (data as any)?.spark_trade_income_path as Path | undefined;
      if (storedPath === "individual" || storedPath === "group_brands") setPath(storedPath);
    })();
  }, [user]);

  const handleNext = async () => {
    if (!path || !user) return;
    if (path === "individual" && !incomeGoal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const update: Record<string, any> = { spark_trade_income_path: path };
      if (path === "individual") update.spark_trade_income_goal = incomeGoal;
      const { error: updateError } = await supabase
        .from("members")
        .update(update)
        .eq("id", user.id);
      if (updateError) throw updateError;
      toast.success("Saved");
      if (path === "individual") {
        nav("/spark-trade/onboarding/business-preference");
      } else {
        nav("/spark-trade/onboarding/group-brands");
      }
    } catch (err: any) {
      console.error("[IncomeGoal] save failed", err);
      setError(err?.message ?? "Failed to save. Please try again.");
      setIsSubmitting(false);
    }
  };

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
            <span className="font-medium">Step 1 of 10</span>
            <span>Spark Trade Launchpad</span>
          </div>
          <Progress value={10} className="h-1.5" />
        </div>

        <div className="rounded-3xl border border-border bg-card shadow-sm p-6 md:p-12">
          <div className="flex justify-center mb-6">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Target className="h-7 w-7" />
            </div>
          </div>

          <h1 className="font-display text-2xl md:text-[28px] font-bold text-center text-foreground">
            Which path interests you?
          </h1>
          <p className="mt-2 text-center text-base text-muted-foreground">
            Choose how you want to build wealth with Spark Trade
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setPath("individual")}
              aria-pressed={path === "individual"}
              className={[
                "text-left rounded-2xl border p-5 transition-all",
                path === "individual"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border bg-background hover:border-primary/50 hover:bg-muted/30",
              ].join(" ")}
            >
              <TrendingUp className="h-6 w-6 text-primary mb-3" />
              <div className="font-bold text-foreground">Individual Scaling</div>
              <p className="text-sm text-muted-foreground mt-1">
                Resell products from suppliers on your own
              </p>
              <div className="mt-3 text-xs font-semibold text-accent">Goal: R5K – R100K+/mo</div>
            </button>

            <button
              type="button"
              onClick={() => setPath("group_brands")}
              aria-pressed={path === "group_brands"}
              className={[
                "text-left rounded-2xl border p-5 transition-all",
                path === "group_brands"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border bg-background hover:border-primary/50 hover:bg-muted/30",
              ].join(" ")}
            >
              <Users className="h-6 w-6 text-primary mb-3" />
              <div className="font-bold text-foreground">Group Owned Brands</div>
              <p className="text-sm text-muted-foreground mt-1">
                Co-own branded products (OEM) with other UMOJA members. Share revenue by stake.
              </p>
              <div className="mt-3 text-xs font-semibold text-accent">Min investment: R50,000</div>
            </button>
          </div>

          {path === "individual" && (
            <div className="mt-8 space-y-3">
              <div className="text-sm font-semibold text-foreground">Pick a monthly income goal</div>
              {GOAL_OPTIONS.map((opt) => {
                const selected = incomeGoal === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setIncomeGoal(opt.value)}
                    aria-pressed={selected}
                    className={[
                      "w-full text-left flex items-start gap-4 rounded-2xl border p-4 transition-all",
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border bg-background hover:border-primary/50 hover:bg-muted/30",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                        selected ? "border-primary" : "border-muted-foreground/40",
                      ].join(" ")}
                    >
                      {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <span className="text-base font-bold text-foreground">{opt.label}</span>
                        <span className="text-sm font-semibold text-accent">{opt.display}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-destructive text-center" role="alert">
              {error}
            </p>
          )}

          <Button
            onClick={handleNext}
            disabled={!path || (path === "individual" && !incomeGoal) || isSubmitting}
            className="mt-8 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow disabled:opacity-50"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              "Continue →"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
