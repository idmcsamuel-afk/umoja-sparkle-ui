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
  id: Tier; name: string; price: number; benefits: string[]; ring: string;
}> = [
  { id: "bronze", name: "BRONZE CLUB", price: 199, ring: "ring-amber-700/50",
    benefits: [
      "Access to all real products",
      "Join buying groups (MOQ pooling)",
      "Standard delivery (6–8 weeks)",
      "2 concurrent orders",
      "Baseline profit margins",
    ] },
  { id: "silver", name: "SILVER CLUB", price: 399, ring: "ring-zinc-300/50",
    benefits: [
      "All Bronze benefits",
      "+5% better margins on every product",
      "Priority placement when MOQ fills",
      "Early access to Buy Soon",
      "3 concurrent orders",
    ] },
  { id: "gold", name: "GOLD CLUB", price: 799, ring: "ring-accent/60",
    benefits: [
      "All Silver benefits",
      "+10% better margins (15% vs Bronze)",
      "VIP queue — first when MOQ hits",
      "5 concurrent orders",
      "Dedicated account manager",
      "Member storefront page",
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
      const result = await payWithPaystack({
        email: user.email ?? "",
        amountZar: selected.price,
        reference: ref,
        plan: `umoja-${tier}`,
        metadata: { member_id: user.id, payment_type: "buyers_club", tier },
      });
      setBusy(false);
      if (result.ok) { onOpenChange(false); onSuccess?.(); }
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
              <div key={t.id} className={`rounded-2xl p-4 border border-border bg-secondary/40 ring-1 ${t.ring}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-lg">{t.name}</p>
                  <p className="text-gradient-gold font-display">R{t.price.toLocaleString()}<span className="text-xs text-muted-foreground font-sans"> / month</span></p>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {t.benefits.map((b) => (
                    <li key={b} className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-accent" /> {b}</li>
                  ))}
                </ul>
                <Button className="mt-3 w-full bg-gradient-primary text-primary-foreground" onClick={() => { setTier(t.id); setStep(2); }}>
                  Select tier
                </Button>
              </div>
            ))}
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
