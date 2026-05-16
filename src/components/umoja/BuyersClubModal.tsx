import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, Check, Copy, Upload, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PaymentMethodSelector, type PaymentMethod } from "@/components/umoja/PaymentMethodSelector";
import { usePaystack, buildReference } from "@/hooks/usePaystack";

interface Plan {
  id: string;
  tier_name: string; // basic | pro | fulfilled
  display_name: string;
  monthly_price: number;
  features: string[] | null;
  paystack_plan_code: string | null;
  is_active: boolean;
}

const TIER_META: Record<string, { ring: string; tagline: string; featured?: boolean; note?: string; cta?: string }> = {
  basic: {
    ring: "ring-amber-700/50",
    tagline: "UMOJA sources everything. You just choose what to buy.",
  },
  pro: {
    ring: "ring-accent/60",
    tagline: "For serious traders ready to scale.",
    featured: true,
  },
  fulfilled: {
    ring: "ring-amber-400/60",
    tagline: "You provide capital. We do everything else.",
    note: "Fulfilled tier requires application and approval.",
    cta: "Apply for Fulfilled",
  },
};

interface Bank { bank_name?: string; account_name?: string; account_number?: string; branch_code?: string; payment_instructions?: string; }

export function BuyersClubModal({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess?: () => void }) {
  const { user, member } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [bank, setBank] = useState<Bank>({});
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("paystack");
  const { pay: payWithPaystack } = usePaystack();

  useEffect(() => {
    if (!open) { setStep(1); setSelectedPlanId(null); setFile(null); setMethod("paystack"); return; }
    setLoadingPlans(true);
    supabase
      .from("subscription_plans")
      .select("id, tier_name, display_name, monthly_price, features, paystack_plan_code, is_active")
      .eq("is_active", true)
      .order("monthly_price", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("Could not load plans");
        setPlans((data as Plan[] | null) ?? []);
        setLoadingPlans(false);
      });
    supabase.rpc("get_member_platform_settings").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setBank(row as Bank);
    });
  }, [open]);

  const selected = plans.find((p) => p.id === selectedPlanId) ?? null;
  const memberCode = (member as any)?.referral_code ?? user?.id?.slice(0, 6).toUpperCase() ?? "MEMBER";
  const reference = `CLUB-${memberCode}`;

  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success("Copied"); };

  const payNow = async () => {
    if (!user || !selected) return;
    setBusy(true);
    if (method === "paystack") {
      const ref = buildReference("BC", selected.tier_name, memberCode);
      onOpenChange(false);
      await new Promise((r) => setTimeout(r, 150));
      const result = await payWithPaystack({
        email: user.email ?? "",
        amountZar: Number(selected.monthly_price),
        reference: ref,
        plan: selected.paystack_plan_code ?? undefined,
        metadata: {
          member_id: user.id,
          payment_type: "buyers_club",
          tier: selected.tier_name,
          plan_id: selected.id,
          paystack_plan_code: selected.paystack_plan_code,
        },
      });
      setBusy(false);
      if (result.ok) {
        // Best-effort client-side update so the UI reflects access immediately.
        // The verify-paystack-payment edge function is the source of truth.
        await supabase.from("members").update({
          buyers_club_tier: selected.tier_name,
          has_buyers_club_access: true,
          buyers_club_status: "active",
          paystack_plan_code: selected.paystack_plan_code,
        }).eq("id", user.id);
        onSuccess?.();
      }
      return;
    }
    if (!file) { setBusy(false); return toast.error("Please attach proof of payment"); }
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const up = await supabase.storage.from("buyers-club-proofs").upload(path, file, { upsert: false });
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { error } = await supabase.rpc("submit_buyers_club_payment", {
      _tier: selected.tier_name, _amount: Number(selected.monthly_price), _proof_url: path,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payment submitted — admin will verify shortly");
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Crown className="h-5 w-5 text-accent" /> Join Buyers Club
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3 — {step === 1 ? "Select your tier" : step === 2 ? "Pay" : "Upload proof"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3 mt-2">
            {loadingPlans && (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading plans…
              </div>
            )}
            {!loadingPlans && plans.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No plans available right now.</p>
            )}
            {plans.map((p) => {
              const meta = TIER_META[p.tier_name] ?? { ring: "ring-border", tagline: "" };
              const featList = Array.isArray(p.features) ? p.features : [];
              const includesFlame = p.tier_name === "pro" || p.tier_name === "fulfilled";
              const isFlameFeature = (s: string) => /flame pro|unlimited graphic|unlimited slideshow|no watermark|brand kit|batch generation|creative library/i.test(s);
              return (
                <div
                  key={p.id}
                  className={`relative rounded-2xl p-4 border bg-secondary/40 ring-1 ${meta.ring} ${meta.featured ? "border-accent/60 shadow-[0_20px_60px_-20px_hsl(45_90%_50%/0.5)] scale-[1.02]" : "border-border"}`}
                >
                  {includesFlame && (
                    <div className="-mt-1 mb-3 -mx-1 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-3 py-1.5 text-center shadow-[0_8px_24px_-8px_hsl(45_90%_50%/0.6)]">
                      <p className="text-[10px] font-bold tracking-[0.18em] text-emerald-950">
                        ✨ INCLUDES FLAME PRO <span className="font-semibold opacity-80">(R249 value)</span>
                      </p>
                    </div>
                  )}
                  {meta.featured && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] uppercase tracking-[0.18em] rounded-full bg-accent text-accent-foreground px-2 py-0.5">⭐ Most popular</span>
                      <span className="text-[10px] uppercase tracking-[0.18em] rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5">Best value</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-lg">{p.display_name}</p>
                    <p className="text-gradient-gold font-display">R{Number(p.monthly_price).toLocaleString()}<span className="text-xs text-muted-foreground font-sans"> / month</span></p>
                  </div>
                  {meta.tagline && <p className="text-xs italic text-muted-foreground mt-1">{meta.tagline}</p>}
                  <ul className="mt-2 space-y-1 text-xs">
                    {featList.map((b) => {
                      const flame = isFlameFeature(b);
                      return flame ? (
                        <li key={b} className="flex items-start gap-1.5 text-sm font-bold text-amber-400">
                          <span className="shrink-0">🔥</span>
                          <span>{b}</span>
                        </li>
                      ) : (
                        <li key={b} className="flex items-start gap-1.5 text-muted-foreground">
                          <Check className="h-3 w-3 mt-0.5 text-accent shrink-0" />
                          <span>{b}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {meta.note && <p className="text-[11px] text-amber-500 mt-2">⚠️ {meta.note}</p>}
                  <Button className="mt-3 w-full bg-gradient-primary text-primary-foreground" onClick={() => { setSelectedPlanId(p.id); setStep(2); }}>
                    {meta.cta ?? "Subscribe"} — R{Number(p.monthly_price).toLocaleString()}/month
                  </Button>
                </div>
              );
            })}
            <div className="rounded-xl bg-secondary/40 p-3 text-[11px] text-muted-foreground space-y-1 mt-2">
              <p>💡 Gold founding members receive FREE Buyers Club Pro access (R999/mo value)</p>
              <p>⚠️ All members must meet monthly purchase minimums to maintain access (anti-spy protection)</p>
              <p>✅ Cancel anytime. No long-term commitment.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Not to be confused with Founding Tiers</p>
              <p>Founding Tiers (one-time support): Bronze R2K · Silver R5K · Gold R10K</p>
              <p>Buyers Club (monthly subscription): pricing managed in the subscription_plans table</p>
            </div>
          </div>
        )}

        {step === 2 && selected && (
          <div className="space-y-3 mt-2">
            <PaymentMethodSelector value={method} onChange={setMethod} />
            {method === "eft" && (
              <div className="rounded-2xl bg-secondary/60 p-4 space-y-2 text-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Pay via EFT</p>
                {[
                  ["Bank", bank.bank_name ?? "—"],
                  ["Account name", bank.account_name ?? "—"],
                  ["Account", bank.account_number ?? "—"],
                  ["Branch", bank.branch_code ?? "—"],
                  ["Reference", reference],
                  ["Amount", `R${Number(selected.monthly_price).toLocaleString()} (1 month)`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-muted-foreground text-xs">{k}</span>
                    <button onClick={() => copy(String(v))} className="font-mono text-xs inline-flex items-center gap-1 hover:text-accent">
                      {v} <Copy className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" /> Back</Button>
              {method === "paystack" ? (
                <Button disabled={busy} className="flex-1 bg-gradient-primary text-primary-foreground" onClick={payNow}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay with card"}
                </Button>
              ) : (
                <Button className="flex-1 bg-gradient-primary text-primary-foreground" onClick={() => setStep(3)}>I've made payment</Button>
              )}
            </div>
          </div>
        )}

        {step === 3 && selected && (
          <div className="space-y-3 mt-2">
            <label className="block rounded-2xl border-2 border-dashed border-border p-6 text-center cursor-pointer hover:border-accent transition-smooth">
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Upload className="h-6 w-6 mx-auto text-accent" />
              <p className="mt-2 text-sm">{file ? file.name : "Tap to upload proof of payment"}</p>
              <p className="text-xs text-muted-foreground">Image or PDF</p>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4" /> Back</Button>
              <Button disabled={!file || busy} className="flex-1 bg-gradient-primary text-primary-foreground" onClick={payNow}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for verification"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
