import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

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
  const [incomeGoal, setIncomeGoal] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from existing value
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("spark_trade_income_goal")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.spark_trade_income_goal) setIncomeGoal(data.spark_trade_income_goal);
    })();
  }, [user]);

  const handleNext = async () => {
    if (!incomeGoal || !user) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("members")
        .update({ spark_trade_income_goal: incomeGoal })
        .eq("id", user.id);
      if (updateError) throw updateError;
      toast.success("Income goal saved");
      nav("/spark-trade/onboarding/business-preference");
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
        {/* Progress */}
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
            What's your income goal?
          </h1>
          <p className="mt-2 text-center text-base text-muted-foreground">
            Help us find the right business model for you
          </p>

          <div className="mt-8 space-y-4">
            {GOAL_OPTIONS.map((opt) => {
              const selected = incomeGoal === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIncomeGoal(opt.value)}
                  aria-pressed={selected}
                  className={[
                    "w-full text-left flex items-start gap-4 rounded-2xl border p-4 md:p-5 transition-all",
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border bg-background hover:border-primary/50 hover:bg-muted/30",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
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

          {error && (
            <p className="mt-4 text-sm text-destructive text-center" role="alert">
              {error}
            </p>
          )}

          <Button
            onClick={handleNext}
            disabled={!incomeGoal || isSubmitting}
            className="mt-8 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow disabled:opacity-50"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              "Next: Tell us more →"
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Same targets shown to all members — you can change this later.
          </p>
        </div>
      </div>
    </div>
  );
}
