import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Target, Users, TrendingUp, RotateCcw, ArrowRight } from "lucide-react";
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

type ResumeInfo = {
  nextRoute: string;
  nextStep: number;
  progressPct: number;
  label: string;
};

const STEP_ROUTES: { route: string; label: string }[] = [
  { route: "/spark-trade/onboarding/income-goal", label: "Income goal" },
  { route: "/spark-trade/onboarding/business-preference", label: "Business preference" },
  { route: "/spark-trade/onboarding/ai-blueprint", label: "AI blueprint" },
  { route: "/spark-trade/onboarding/ai-store-creation", label: "Store creation" },
  { route: "/spark-trade/onboarding/subscription-recommendation", label: "Subscription" },
];

export default function SparkTradeIncomeGoal() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [path, setPath] = useState<Path | null>(null);
  const [incomeGoal, setIncomeGoal] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingResume, setCheckingResume] = useState(true);
  const [resume, setResume] = useState<ResumeInfo | null>(null);

  useEffect(() => {
    if (!user) {
      if (!loading) setCheckingResume(false);
      return;
    }
    (async () => {
      const { data: member } = await supabase
        .from("members")
        .select("spark_trade_income_goal, spark_trade_income_path")
        .eq("id", user.id)
        .maybeSingle();

      const m = member as any;
      // Check onboarding_complete + business_type via separate any-cast query
      const { data: extra } = await (supabase.from("members") as any)
        .select("spark_trade_business_type, spark_trade_onboarding_complete")
        .eq("id", user.id)
        .maybeSingle();

      if (extra?.spark_trade_onboarding_complete) {
        nav("/spark-trade/dashboard", { replace: true });
        return;
      }

      if (m?.spark_trade_income_goal) setIncomeGoal(m.spark_trade_income_goal);
      const storedPath = m?.spark_trade_income_path as Path | undefined;
      if (storedPath === "individual" || storedPath === "group_brands") setPath(storedPath);

      const [{ data: bp }, { data: store }] = await Promise.all([
        (supabase.from("spark_trade_blueprints") as any).select("id").eq("member_id", user.id).maybeSingle(),
        (supabase.from("spark_trade_stores") as any).select("id").eq("member_id", user.id).maybeSingle(),
      ]);

      let nextStep = 1;
      if (m?.spark_trade_income_goal) nextStep = 2;
      if (extra?.spark_trade_business_type) nextStep = 3;
      if (bp?.id) nextStep = 4;
      if (store?.id) nextStep = 5;

      if (nextStep > 1) {
        const idx = nextStep - 1;
        setResume({
          nextRoute: STEP_ROUTES[idx].route,
          nextStep,
          progressPct: Math.round(((nextStep - 1) / STEP_ROUTES.length) * 100),
          label: STEP_ROUTES[idx].label,
        });
      }
      setCheckingResume(false);
    })();
  }, [user, loading, nav]);

  const restart = () => {
    setResume(null);
    toast.message("Starting from the beginning");
  };

  const handleNext = async () => {
    if (!path || !user) return;
    if (path === "individual" && !incomeGoal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const update: Record<string, any> = { spark_trade_income_path: path };
      if (path === "individual") update.spark_trade_income_goal = incomeGoal;
      const { error: updateError } = await (supabase
        .from("members") as any)
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

  if (loading || checkingResume) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (resume) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-4 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-border bg-card shadow-sm p-6 md:p-10">
            <div className="flex justify-center mb-6">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <Target className="h-7 w-7" />
              </div>
            </div>
            <h1 className="font-display text-2xl md:text-[28px] font-bold text-center text-foreground">
              Welcome back 👋
            </h1>
            <p className="mt-2 text-center text-base text-muted-foreground">
              You're {resume.progressPct}% done with your AI Income Builder.
            </p>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span className="font-medium">Next: {resume.label}</span>
                <span>Step {resume.nextStep} of {STEP_ROUTES.length}</span>
              </div>
              <Progress value={resume.progressPct} className="h-1.5" />
            </div>
            <div className="mt-8 flex flex-col gap-3">
              <Button
                onClick={() => nav(resume.nextRoute)}
                className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow"
              >
                Continue where I left off <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={restart}
                variant="outline"
                className="w-full h-12 rounded-2xl"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Start over
              </Button>
            </div>
          </div>
        </div>
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
