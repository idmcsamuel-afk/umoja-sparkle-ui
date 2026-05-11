import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Banknote, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Settings {
  id?: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch_code: string;
  payment_instructions: string;
}

const empty: Settings = {
  bank_name: "",
  account_name: "",
  account_number: "",
  branch_code: "",
  payment_instructions: "",
};

export default function AdminSettings() {
  const [s, setS] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unmask, setUnmask] = useState(false);

  const maskAccount = (v: string) => {
    if (!v) return "";
    if (unmask) return v;
    const digits = v.replace(/\s+/g, "");
    if (digits.length <= 4) return "•".repeat(digits.length);
    return "•".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
  };

  const previewReady = !!(s.bank_name && s.account_number);
  const sampleRef = "BID-PREVIEW-0001";
  const sampleAmount = "R2,500";

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setS({
          id: data.id,
          bank_name: data.bank_name ?? "",
          account_name: data.account_name ?? "",
          account_number: data.account_number ?? "",
          branch_code: data.branch_code ?? "",
          payment_instructions: data.payment_instructions ?? "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      bank_name: s.bank_name || null,
      account_name: s.account_name || null,
      account_number: s.account_number || null,
      branch_code: s.branch_code || null,
      payment_instructions: s.payment_instructions || null,
    };
    let error;
    if (s.id) {
      ({ error } = await supabase.from("platform_settings").update(payload).eq("id", s.id));
    } else {
      const res = await supabase.from("platform_settings").insert(payload).select("id").single();
      error = res.error;
      if (res.data?.id) setS({ ...s, id: res.data.id });
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Bank details saved");
  };

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const field = (k: keyof Settings, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</Label>
      <Input
        value={(s[k] as string) ?? ""}
        onChange={(e) => setS({ ...s, [k]: e.target.value })}
        placeholder={placeholder}
        className="h-11 rounded-2xl bg-secondary/40 border-border"
      />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Banknote className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl">Platform settings</h1>
          <p className="text-sm text-muted-foreground mt-1">EFT bank details shown to members on the bid screen.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 rounded-3xl border border-border bg-gradient-card p-6">
        {field("bank_name", "Bank name", "e.g. Standard Bank")}
        {field("account_name", "Account name", "Umoja Rise (Pty) Ltd")}
        {field("account_number", "Account number", "10-digit account number")}
        {field("branch_code", "Branch code", "e.g. 051001")}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Payment instructions (optional)</Label>
          <Textarea
            value={s.payment_instructions}
            onChange={(e) => setS({ ...s, payment_instructions: e.target.value })}
            placeholder="Use the reference exactly as shown. Allow up to 24h for clearance."
            className="rounded-2xl bg-secondary/40 border-border min-h-[100px]"
          />
        </div>
        <div className="pt-2 flex justify-end">
          <Button
            onClick={save}
            disabled={saving}
            className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Save</>}
          </Button>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-border bg-gradient-card p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl">Member EFT preview</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Exactly what members see in the bid modal. Account number is masked by default.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setUnmask((v) => !v)}
            className="rounded-2xl"
          >
            {unmask ? <><EyeOff className="h-4 w-4 mr-1" /> Mask</> : <><Eye className="h-4 w-4 mr-1" /> Reveal</>}
          </Button>
        </div>

        {!previewReady ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            Fill in at least the bank name and account number above to preview the modal.
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-accent pb-2 border-b border-border/40">
              Pay via EFT
            </p>
            {[
              ["Bank", s.bank_name],
              ["Account Name", s.account_name],
              ["Account Number", maskAccount(s.account_number)],
              ["Branch Code", s.branch_code],
              ["Reference", sampleRef],
              ["Amount", sampleAmount],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 py-1 border-b border-border/40 last:border-b-0"
              >
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                <span className="font-mono text-sm truncate">{value || "—"}</span>
              </div>
            ))}
            {s.payment_instructions && (
              <p className="pt-2 text-xs text-muted-foreground whitespace-pre-line">
                {s.payment_instructions}
              </p>
            )}
            <p className="pt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Sample reference & amount — actual values are generated per bid.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
