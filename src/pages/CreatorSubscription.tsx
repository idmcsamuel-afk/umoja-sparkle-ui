import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sparkles, CreditCard, Check, Crown, Loader2, ChevronLeft, Zap } from "lucide-react";
import { usePaystack, buildReference } from "@/hooks/usePaystack";
import { ZCREATOR_TIERS, getTierConfig, usagePct, usageColor, type ZCreatorTier } from "@/lib/zcreatorTiers";

export default function CreatorSubscription() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pay } = usePaystack();

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<any>(null);
  const [sparkBalance, setSparkBalance] = useState(0);
  const [selectedTier, setSelectedTier] = useState<ZCreatorTier | null>(null);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [s, w] = await Promise.all([
      supabase.from("zcreator_subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("spark_wallets").select("balance").eq("member_id", user.id).maybeSingle(),
    ]);
    setSub(s.data ?? null);
    setSparkBalance(Number(w.data?.balance ?? 0));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const currentTier: ZCreatorTier = (sub?.tier ?? "free") as ZCreatorTier;
  const currentCfg = getTierConfig(currentTier);
  const videosUsed = Number(sub?.videos_used_this_month ?? 0);
  const limit = Number(sub?.videos_per_month ?? currentCfg.videosPerMonth);
  const pct = usagePct(videosUsed, limit);

  const resetDate = useMemo(() => {
    const start = sub?.billing_cycle_starts_at ? new Date(sub.billing_cycle_starts_at) : new Date();
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    return next.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }, [sub]);

  const upgradeWithSparks = async () => {
    if (!selectedTier || !user) return;
    const cfg = getTierConfig(selectedTier);
    if (sparkBalance < cfg.monthlySparks) {
      toast.error(`Not enough Sparks. Need ${cfg.monthlySparks}, have ${Math.round(sparkBalance)}`);
      return;
    }
    setPaying(true);
    const { data, error } = await supabase.functions.invoke("zcreator-upgrade-subscription", {
      body: { tier: selectedTier, paymentMethod: "sparks" },
    });
    setPaying(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Upgrade failed");
      return;
    }
    toast.success(`Creator Studio upgraded to ${cfg.name}`);
    setSelectedTier(null);
    load();
  };

  const upgradeWithPaystack = async () => {
    if (!selectedTier || !user) return;
    const cfg = getTierConfig(selectedTier);
    setPaying(true);
    const reference = buildReference("ST", `ZC${cfg.id.toUpperCase()}`, user.id.slice(0, 8));
    const result = await pay({
      email: user.email ?? "",
      amountZar: cfg.monthlyRands,
      reference,
      metadata: { kind: "zcreator_subscription", tier: cfg.id, user_id: user.id },
    });
    if (!result.ok) { setPaying(false); return; }
    const { data, error } = await supabase.functions.invoke("zcreator-upgrade-subscription", {
      body: { tier: selectedTier, paymentMethod: "paystack", paystackReference: result.reference },
    });
    setPaying(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Activation pending");
      return;
    }
    toast.success(`Creator Studio upgraded to ${cfg.name}`);
    setSelectedTier(null);
    load();
  };

  return (
    <div className="min-h-screen pb-28 md:pb-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        <Link to="/creator-studio" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3 w-3" /> Back to Creator Studio
        </Link>

        {/* Banner */}
        <header className="rounded-2xl border border-border bg-gradient-to-br from-accent/10 via-transparent to-transparent p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent flex items-center gap-2">
                <Crown className="h-3 w-3" /> Add-on Feature
              </p>
              <h1 className="font-display text-2xl sm:text-3xl mt-1">Creator Studio — Content Generation Plans</h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
                Autonomous video creation for YouTube, TikTok &amp; Instagram. Separate from your main platform subscription.
              </p>
            </div>
            <Badge variant="outline" className="border-accent/40 text-accent">Add-on</Badge>
          </div>
        </header>

        {/* Current status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> Your Creator Studio Plan:{" "}
              <span className="uppercase">{currentTier}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span>{videosUsed} of {limit} videos used this month</span>
                  <Badge className={usageColor(pct)} variant="outline">{pct}%</Badge>
                </div>
                <Progress value={pct} />
                <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground pt-2">
                  <div>
                    <p className="uppercase tracking-wider text-[10px]">Resets on</p>
                    <p className="text-foreground text-sm mt-0.5">{resetDate}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wider text-[10px]">Monthly cost</p>
                    <p className="text-foreground text-sm mt-0.5">
                      {currentCfg.monthlyRands > 0 ? `R${currentCfg.monthlyRands}/mo` : "Free"}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wider text-[10px]">Auto-publish</p>
                    <p className="text-foreground text-sm mt-0.5">{currentCfg.autoPublish ? "Enabled" : "Disabled"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {currentCfg.platforms.map((p) => (
                    <Badge key={p} variant="secondary" className="capitalize">{p}</Badge>
                  ))}
                  <Badge variant="outline">{currentCfg.voice}</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tiers */}
        <section>
          <h2 className="font-display text-xl mb-3">Choose a plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ZCREATOR_TIERS.map((t) => {
              const active = t.id === currentTier;
              const isUpgrade = !active && t.id !== "free";
              return (
                <Card
                  key={t.id}
                  className={`relative flex flex-col ${active ? "border-accent ring-1 ring-accent/30" : t.highlight ? "border-accent/40" : ""}`}
                >
                  {t.highlight && !active && (
                    <Badge className="absolute -top-2 right-3">Most popular</Badge>
                  )}
                  <CardHeader className="pb-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t.tagline}</p>
                    <CardTitle className="font-display text-2xl mt-1">{t.name}</CardTitle>
                    <div className="mt-2">
                      <p className="text-3xl font-display">
                        {t.monthlyRands === 0 ? "Free" : `R${t.monthlyRands}`}
                        {t.monthlyRands > 0 && <span className="text-sm text-muted-foreground font-normal">/mo</span>}
                      </p>
                      {t.monthlySparks > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Zap className="h-3 w-3" /> or {t.monthlySparks.toLocaleString()} Sparks
                        </p>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3">
                    <ul className="space-y-1.5 text-sm flex-1">
                      {t.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {active ? (
                      <Badge variant="outline" className="justify-center py-2">Current Plan</Badge>
                    ) : isUpgrade ? (
                      <Button onClick={() => setSelectedTier(t.id)} className="w-full">
                        {t.ctaLabel}
                      </Button>
                    ) : (
                      <Button variant="outline" disabled className="w-full">Default tier</Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5 text-center space-y-1">
          <p className="text-sm font-medium">Generate professional videos from <span className="text-accent">R12–R13 per video</span></p>
          <p className="text-xs text-muted-foreground">International competitors charge R18–R55 per video — save 50–70% vs traditional video editing.</p>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          This is an add-on feature — billed separately from your main platform subscription.
        </p>
      </div>


      {/* Upgrade modal */}
      <Dialog open={!!selectedTier} onOpenChange={(o) => !o && setSelectedTier(null)}>
        <DialogContent>
          {selectedTier && (() => {
            const cfg = getTierConfig(selectedTier);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Upgrade to Creator Studio {cfg.name}</DialogTitle>
                  <DialogDescription>
                    This upgrades your <b>Creator Studio plan only</b>. Your main platform subscription is unaffected.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="rounded-lg border p-3 text-sm">
                    <div className="flex justify-between"><span>Monthly price</span><b>R{cfg.monthlyRands}</b></div>
                    <div className="flex justify-between text-muted-foreground"><span>or in Sparks</span><span>{cfg.monthlySparks.toLocaleString()} SP</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Videos / month</span><span>{cfg.videosPerMonth}</span></div>
                  </div>

                  <Button
                    className="w-full justify-start gap-2"
                    variant="outline"
                    disabled={paying || sparkBalance < cfg.monthlySparks}
                    onClick={upgradeWithSparks}
                  >
                    <Zap className="h-4 w-4" />
                    Pay with Sparks
                    <span className="ml-auto text-xs text-muted-foreground">
                      Balance: {Math.round(sparkBalance).toLocaleString()} SP
                    </span>
                  </Button>

                  <Button
                    className="w-full justify-start gap-2"
                    disabled={paying}
                    onClick={upgradeWithPaystack}
                  >
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Pay R{cfg.monthlyRands} with Paystack
                  </Button>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setSelectedTier(null)} disabled={paying}>Cancel</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
