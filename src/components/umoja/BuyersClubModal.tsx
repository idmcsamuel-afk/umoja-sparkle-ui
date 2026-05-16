import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, Check, Copy, Upload, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PaymentMethodSelector, type PaymentMethod } from "@/components/umoja/PaymentMethodSelector";
import { usePaystack, buildReference } from "@/hooks/usePaystack";

type Tier = "bronze" | "silver" | "gold";

const TIERS: Array<{
  id: Tier; name: string; price: number; tagline: string; benefits: string[]; ring: string; featured?: boolean; note?: string; cta?: string;
}> = [
  { id: "bronze", name: "SPARK TRADE BASIC", price: 499, ring: "ring-amber-700/50",
    tagline: "UMOJA sources everything. You just choose what to buy.",
    benefits: [
      "Weekly validated product shortlist (7 proven products every Sunday)",
      "Join buying groups — pool orders with members",
      "UMOJA handles all sourcing from China",
      "Consolidated shipping to SA",
      "True margin calculator per product",
      "Stock delivered to your door",
      "Access to Trending products intelligence",
      "Track products you're interested in",
    ] },
  { id: "silver", name: "SPARK TRADE PRO", price: 999, ring: "ring-accent/60", featured: true,
    tagline: "For serious traders ready to scale.",
    benefits: [
      "Everything in Basic",
      "Real-time alerts — first in buying groups",
      "90-day trend forecasting",
      "Coming Wave early access (see trends before SA)",
      "Finzite seller health dashboard",
      "Connect Takealot/Amazon for competitive intelligence",
      "Import financing eligibility",
      "Dedicated WhatsApp sourcing support",
      "Monthly live sourcing webinar",
      "+5% better margins on group buys",
      "5 concurrent orders (vs 2 on Basic)",
    ] },
  { id: "gold", name: "FULFILLED BY UMOJA", price: 1999, ring: "ring-amber-400/60",
    tagline: "You provide capital. We do everything else.",
    note: "Fulfilled tier requires application and approval.",
    cta: "Apply for Fulfilled",
    benefits: [
      "Everything in Pro",
      "Complete hands-off fulfilment service",
      "UMOJA stores your inventory (warehouse)",
      "UMOJA lists products on marketplace",
      "UMOJA packs and ships all orders",
      "UMOJA handles returns and customer service",
      "Member storefront page (your branded shop)",
      "Dedicated account manager",
      "VIP queue — first when MOQ hits",
      "+10% better margins (15% total vs Basic)",
      "Unlimited concurrent orders",
      "Monthly performance reports",
    ] },
];

interface Bank { bank_name?: string; account_name?: string; account_number?: string; branch_code?: string; payment_instructions?: string; }

export function BuyersClubModal({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess?: () => void }) {
  const { user, member } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tier, setTier] = useState<Tier | null>(null);
  const [bank, setBank] = useState<Bank>({});
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("paystack");
  const { pay: payWithPaystack } = usePaystack();

  useEffect(() => {
    if (!open) { setStep(1); setTier(null); setFile(null); setMethod("paystack"); return; }
    supabase.rpc("get_member_platform_settings").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setBank(row as Bank);
    });
  }, [open]);

  const selected = TIERS.find((t) => t.id === tier);
  const memberCode = (member as any)?.referral_code ?? user?.id?.slice(0, 6).toUpperCase() ?? "MEMBER";
  const reference = `CLUB-${memberCode}`;

  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success("Copied"); };

  const payNow = async () => {
    if (!user || !tier || !selected) return;
    setBusy(true);
    if (method === "paystack") {
      const ref = buildReference("BC", tier, memberCode);
      // Close this dialog first so Radix focus trap doesn't block Paystack iframe inputs
      onOpenChange(false);
      await new Promise((r) => setTimeout(r, 150));
      const result = await payWithPaystack({
        email: user.email ?? "",
        amountZar: selected.price,
        reference: ref,
        plan: `umoja-${tier}`,
        metadata: { member_id: user.id, payment_type: "buyers_club", tier },
      });
      setBusy(false);
      if (result.ok) onSuccess?.();
      return;
    }
    if (!file) { setBusy(false); return toast.error("Please attach proof of payment"); }
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const up = await supabase.storage.from("buyers-club-proofs").upload(path, file, { upsert: false });
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { error } = await supabase.rpc("submit_buyers_club_payment", {
      _tier: tier, _amount: selected.price, _proof_url: path,
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
            Step {step} of 3 — {step === 1 ? "Select your tier" : step === 2 ? "Pay via EFT" : "Upload proof"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3 mt-2">
            {TIERS.map((t) => (
              <div key={t.id} className={`relative rounded-2xl p-4 border bg-secondary/40 ring-1 ${t.ring} ${t.featured ? "border-accent/60" : "border-border"}`}>
                {t.featured && (
                  <span className="absolute -top-2 right-3 text-[10px] uppercase tracking-[0.18em] rounded-full bg-accent text-accent-foreground px-2 py-0.5">⭐ Most popular</span>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-lg">{t.name}</p>
                  <p className="text-gradient-gold font-display">R{t.price.toLocaleString()}<span className="text-xs text-muted-foreground font-sans"> / month</span></p>
                </div>
                <p className="text-xs italic text-muted-foreground mt-1">{t.tagline}</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {t.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-1.5"><Check className="h-3 w-3 mt-0.5 text-accent shrink-0" /> <span>{b}</span></li>
                  ))}
                </ul>
                {t.note && <p className="text-[11px] text-amber-500 mt-2">⚠️ {t.note}</p>}
                <Button className="mt-3 w-full bg-gradient-primary text-primary-foreground" onClick={() => { setTier(t.id); setStep(2); }}>
                  {t.cta ?? "Select tier"} — R{t.price.toLocaleString()}/month
                </Button>
              </div>
            ))}
            <div className="rounded-xl bg-secondary/40 p-3 text-[11px] text-muted-foreground space-y-1 mt-2">
              <p>💡 Gold founding members receive FREE Buyers Club Pro access (R999/mo value)</p>
              <p>⚠️ All members must meet monthly purchase minimums to maintain access (anti-spy protection)</p>
              <p>✅ Cancel anytime. No long-term commitment.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Not to be confused with Founding Tiers</p>
              <p>Founding Tiers (one-time support): Bronze R2K · Silver R5K · Gold R10K</p>
              <p>Buyers Club (monthly subscription): Basic R499/mo · Pro R999/mo · Fulfilled R1,999/mo</p>
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
                  ["Amount", `R${selected.price.toLocaleString()} (1 month)`],
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
