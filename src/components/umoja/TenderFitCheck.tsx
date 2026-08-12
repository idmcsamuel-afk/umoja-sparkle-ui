import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Loader2, AlertTriangle, ListChecks, ShieldCheck, Clock, Users, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SparkBalanceChip from "@/components/umoja/SparkBalanceChip";
import { useSparkBalance } from "@/hooks/useSparkBalance";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/tenders";

const FIT_CHECK_COST = 10;

export type FitCheck = {
  go_no_go: string;
  one_line_verdict: string;
  key_requirements: string[];
  likely_compliance_signals: string[];
  deadline_pressure: string;
  who_this_suits: string;
  watch_outs: string[];
};

const FOOTER =
  "This is guidance based on the tender summary. Read the official bid document before deciding — UMOJA does not guarantee any outcome.";

function verdictStyle(v: string) {
  const s = (v ?? "").toLowerCase();
  if (s.includes("strong")) return "bg-primary/15 text-primary border-primary/40";
  if (s.includes("considering")) return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40";
  return "bg-muted text-muted-foreground border-border";
}

function Section({
  icon: Icon, title, items,
}: { icon: typeof ListChecks; title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />{title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={`${title}-${i}`} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">{it}</li>
        ))}
      </ul>
    </div>
  );
}

export default function TenderFitCheck({ tenderId }: { tenderId: string }) {
  const { user } = useAuth();
  const [fit, setFit] = useState<FitCheck | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { balance, refresh: refreshBalance } = useSparkBalance();

  const loadExisting = useCallback(async () => {
    if (!user) { setFit(null); setLoading(false); return; }
    const { data } = await supabase
      .from("tender_ai_outputs")
      .select("content_json, created_at")
      .eq("tender_id", tenderId)
      .eq("member_id", user.id)
      .eq("kind", "fit_check")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.content_json) {
      setFit(data.content_json as unknown as FitCheck);
      setGeneratedAt(data.created_at);
    }
    setLoading(false);
  }, [tenderId, user]);

  useEffect(() => { setLoading(true); loadExisting(); }, [loadExisting]);


  const run = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("generate-fit-check", {
      body: { p_tender_id: tenderId },
    });
    setRunning(false);
    setConfirmOpen(false);
    await refreshBalance();

    const payload = data as
      | { ok?: boolean; fit_check?: FitCheck; generated_at?: string; error?: string; message?: string }
      | null;

    if (payload?.ok && payload.fit_check) {
      setFit(payload.fit_check);
      setGeneratedAt(payload.generated_at ?? new Date().toISOString());
      toast.success("Fit-Check ready");
      return;
    }

    const code = payload?.error;
    if (code === "insufficient_sparks") {
      toast.error("Not enough Sparks — earn more in Spark Trade or Spark Pit, or top up.");
    } else if (code === "spark_payments_disabled") {
      toast.error("Spark unlocks are temporarily disabled. Please try again later.");
    } else if (code === "ai_failed") {
      toast.error(payload?.message ?? "AI analysis failed — your Sparks were refunded. Please try again.");
    } else {
      toast.error(payload?.message ?? error?.message ?? "Fit-Check failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <Card className="p-5 grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  return (
    <Card className={`p-5 space-y-4 ${fit ? "border-primary/40 bg-primary/5" : "border-dashed border-accent/40"}`}>
      <div className="flex items-center gap-2">
        <span
          className={`grid h-8 w-8 place-items-center rounded-xl ring-1 ${
            fit
              ? "bg-primary/15 text-primary ring-primary/30"
              : "bg-accent/15 text-accent ring-accent/30"
          }`}
        >
          {fit ? <ShieldCheck className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <h2 className="font-medium">AI Fit-Check</h2>
          <p className={`text-xs ${fit ? "text-primary/80" : "text-muted-foreground"}`}>
            {fit
              ? generatedAt ? `Generated ${formatDateTime(generatedAt)} · free to re-view` : "Free to re-view"
              : "Should you bid on this one? Get a plain-language read in seconds."}
          </p>
        </div>
      </div>


      {fit ? (
        <div className="space-y-4">
          <Badge variant="outline" className={`capitalize ${verdictStyle(fit.go_no_go)}`}>
            {fit.go_no_go}
          </Badge>
          <p className="text-base md:text-lg font-medium leading-snug">{fit.one_line_verdict}</p>

          <Section icon={ListChecks} title="Key requirements" items={fit.key_requirements} />
          <Section icon={ShieldCheck} title="Likely compliance expectations (not confirmed)" items={fit.likely_compliance_signals} />

          {fit.deadline_pressure && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />Deadline pressure
              </p>
              <p className="text-sm">{fit.deadline_pressure}</p>
            </div>
          )}
          {fit.who_this_suits && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />Who this suits
              </p>
              <p className="text-sm">{fit.who_this_suits}</p>
            </div>
          )}
          <Section icon={TriangleAlert} title="Watch-outs" items={fit.watch_outs} />
        </div>
      ) : user ? (
        <>
          <ul className="space-y-2 text-sm">
            {[
              "Go / no-go verdict and one-line summary",
              "Key requirements in plain language",
              "Likely compliance expectations (B-BBEE, documents)",
              "Deadline pressure, who it suits and watch-outs",
            ].map((item) => (
              <li key={item} className="rounded-xl bg-muted/50 px-3 py-2 text-muted-foreground">{item}</li>
            ))}
          </ul>
          <Button variant="spark" className="w-full" onClick={() => setConfirmOpen(true)} disabled={running}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            AI Fit-Check — {FIT_CHECK_COST} Sparks
          </Button>
          <div className="flex justify-center">
            <SparkBalanceChip />
          </div>

        </>
      ) : (
        <Button asChild className="w-full"><Link to="/login">Sign in for the AI Fit-Check</Link></Button>
      )}

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground border-t pt-3">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {FOOTER}
      </p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run the AI Fit-Check?</AlertDialogTitle>
            <AlertDialogDescription>
              This costs {FIT_CHECK_COST} Sparks (R{FIT_CHECK_COST}).{" "}
              {balance !== null ? `You have ${balance.toLocaleString()} Sparks.` : ""} You can re-view the
              result any time at no extra cost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={(e) => { e.preventDefault(); run(); }} disabled={running}>
              {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm — {FIT_CHECK_COST} Sparks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
