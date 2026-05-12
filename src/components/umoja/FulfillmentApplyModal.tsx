import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const SA_BANKS = ["FNB", "Standard Bank", "ABSA", "Nedbank", "Capitec", "Investec", "African Bank", "TymeBank", "Discovery Bank"];
const CATEGORIES = ["Electronics", "Home & Garden", "Beauty & Health", "Kitchen & Dining", "Sports & Outdoors"];
const VOLUMES = ["1-10 orders/month", "11-50 orders/month", "51-200 orders/month", "200+ orders/month"];

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onSubmitted?: () => void; }

export function FulfillmentApplyModal({ open, onOpenChange, onSubmitted }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    has_amazon: false, needs_amazon: false, amazon_seller_id: "",
    has_takealot: false, needs_takealot: false, takealot_seller_id: "",
    has_makro: false, needs_makro: false, makro_seller_id: "",
    expected_volume: "",
    categories: [] as string[],
    other_category: "",
    bank_name: "", account_number: "", account_type: "Cheque", branch_code: "",
    agreed: false,
  });

  const toggleCat = (c: string) => setForm((f) => ({
    ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
  }));

  const submit = async () => {
    if (!user) return;
    if (!form.agreed) { toast({ title: "Please agree to terms", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.from("fulfillment_applications").insert({
      member_id: user.id,
      has_amazon: form.has_amazon, needs_amazon: form.needs_amazon, amazon_seller_id: form.amazon_seller_id || null,
      has_takealot: form.has_takealot, needs_takealot: form.needs_takealot, takealot_seller_id: form.takealot_seller_id || null,
      has_makro: form.has_makro, needs_makro: form.needs_makro, makro_seller_id: form.makro_seller_id || null,
      expected_volume: form.expected_volume,
      product_categories: form.categories,
      other_category: form.other_category || null,
      bank_name: form.bank_name, account_number: form.account_number, account_type: form.account_type, branch_code: form.branch_code,
      agreed: true,
    });
    setBusy(false);
    if (error) { console.error(error); toast({ title: "Submission failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Application submitted!", description: "We'll review within 2 business days." });
    onOpenChange(false);
    setStep(1);
    onSubmitted?.();
  };

  const canNext1 = true;
  const canNext2 = !!form.expected_volume && (form.categories.length > 0 || !!form.other_category);
  const canNext3 = !!form.bank_name && !!form.account_number && !!form.branch_code;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply for Fulfilled by UMOJA</DialogTitle>
          <DialogDescription>Step {step} of 4</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Marketplace Accounts</h3>
            {[
              { key: "amazon", label: "Amazon" },
              { key: "takealot", label: "Takealot" },
              { key: "makro", label: "Makro" },
            ].map(({ key, label }) => {
              const has = (form as any)[`has_${key}`];
              const needs = (form as any)[`needs_${key}`];
              const sid = (form as any)[`${key}_seller_id`];
              return (
                <div key={key} className="rounded-xl border border-border p-3 space-y-2">
                  <p className="text-sm font-medium">{label}</p>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={has} onCheckedChange={(v) => setForm((f) => ({ ...f, [`has_${key}`]: !!v, [`needs_${key}`]: !!v ? false : f[`needs_${key}` as keyof typeof f] }))} />
                    Yes, I have an account
                  </label>
                  {has && (
                    <Input placeholder={`${label} Seller ID`} value={sid} onChange={(e) => setForm((f) => ({ ...f, [`${key}_seller_id`]: e.target.value }))} />
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={needs} onCheckedChange={(v) => setForm((f) => ({ ...f, [`needs_${key}`]: !!v, [`has_${key}`]: !!v ? false : f[`has_${key}` as keyof typeof f] }))} />
                    No, help me create one
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Business Details</h3>
            <div className="space-y-2">
              <Label>Expected monthly volume</Label>
              <Select value={form.expected_volume} onValueChange={(v) => setForm((f) => ({ ...f, expected_volume: v }))}>
                <SelectTrigger><SelectValue placeholder="Select volume" /></SelectTrigger>
                <SelectContent>{VOLUMES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primary product categories</Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.categories.includes(c)} onCheckedChange={() => toggleCat(c)} />
                    {c}
                  </label>
                ))}
              </div>
              <Input placeholder="Other (optional)" value={form.other_category} onChange={(e) => setForm((f) => ({ ...f, other_category: e.target.value }))} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Banking Details</h3>
            <p className="text-xs text-muted-foreground">Profits will be deposited weekly to this account.</p>
            <div className="space-y-2">
              <Label>Bank name</Label>
              <Select value={form.bank_name} onValueChange={(v) => setForm((f) => ({ ...f, bank_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                <SelectContent>{SA_BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account number</Label>
              <Input value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value.replace(/\D/g, "") }))} maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label>Account type</Label>
              <Select value={form.account_type} onValueChange={(v) => setForm((f) => ({ ...f, account_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch code</Label>
              <Input value={form.branch_code} onChange={(e) => setForm((f) => ({ ...f, branch_code: e.target.value.replace(/\D/g, "") }))} maxLength={10} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Agreement</h3>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-2">
              <p className="font-medium">I understand that:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs">
                <li>Monthly fee of R1,500 + per-item fees apply</li>
                <li>UMOJA will have access to my marketplace accounts</li>
                <li>Inventory must be delivered to UMOJA warehouse</li>
                <li>UMOJA handles all order fulfillment</li>
                <li>Payment processed via monthly invoice</li>
              </ul>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={form.agreed} onCheckedChange={(v) => setForm((f) => ({ ...f, agreed: !!v }))} />
              <span>I agree to the terms above</span>
            </label>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}>
            {step > 1 ? "Back" : "Cancel"}
          </Button>
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2) || (step === 3 && !canNext3)}
            >Next</Button>
          ) : (
            <Button onClick={submit} disabled={busy || !form.agreed}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Application
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
