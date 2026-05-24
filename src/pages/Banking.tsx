import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Landmark, CheckCircle2, AlertTriangle, Wallet, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const BANKS: { name: string; branch: string }[] = [
  { name: "FNB", branch: "250655" },
  { name: "Standard Bank", branch: "051001" },
  { name: "Capitec", branch: "470010" },
  { name: "Nedbank", branch: "198765" },
  { name: "Absa", branch: "632005" },
  { name: "TymeBank", branch: "678910" },
  { name: "African Bank", branch: "430000" },
  { name: "Discovery Bank", branch: "679000" },
  { name: "Investec", branch: "580105" },
  { name: "Other", branch: "" },
];

type Banking = {
  id?: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  account_type: string;
  branch_code: string;
  verified?: boolean;
};

type Payout = {
  id: string;
  payout_amount: number;
  payout_period: string;
  status: string;
  paid_at: string | null;
  payment_reference: string | null;
  circle_tier: string | null;
  created_at: string;
};

const fmtR = (n: number) =>
  "R" + Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusTone: Record<string, string> = {
  pending: "bg-secondary text-muted-foreground",
  processing: "bg-accent/15 text-accent-soft",
  paid: "bg-primary/15 text-primary",
  failed: "bg-destructive/15 text-destructive",
};

export default function Banking() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banking, setBanking] = useState<Banking>({
    bank_name: "", account_holder_name: "", account_number: "", account_type: "savings", branch_code: "",
  });
  const [bankChoice, setBankChoice] = useState<string>("");
  const [otherBankName, setOtherBankName] = useState<string>("");
  const [verified, setVerified] = useState(false);
  const [existing, setExisting] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [b, p] = await Promise.all([
        supabase.from("member_banking_details").select("*").eq("member_id", user.id).maybeSingle(),
        supabase.from("circle_payouts").select("*").eq("member_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (b.data) {
        const savedBank = b.data.bank_name ?? "";
        setBanking({
          id: b.data.id,
          bank_name: savedBank,
          account_holder_name: b.data.account_holder_name ?? "",
          account_number: b.data.account_number ?? "",
          account_type: b.data.account_type ?? "savings",
          branch_code: b.data.branch_code ?? "",
        });
        const known = BANKS.some((b2) => b2.name === savedBank && b2.name !== "Other");
        if (known) {
          setBankChoice(savedBank);
        } else if (savedBank) {
          setBankChoice("Other");
          setOtherBankName(savedBank === "Other" ? "" : savedBank);
        }
        setVerified(!!b.data.verified);
        setExisting(true);
      }
      setPayouts((p.data ?? []) as Payout[]);
      setLoading(false);
    })();
  }, [user]);

  const validate = (): string | null => {
    if (!banking.bank_name) return "Pick a bank";
    if (banking.account_holder_name.trim().split(/\s+/).length < 2)
      return "Enter your full name (at least first and last)";
    if (!/^\d{9,12}$/.test(banking.account_number))
      return "Account number must be 9–12 digits";
    if (!banking.account_type) return "Select account type";
    return null;
  };

  const save = async () => {
    if (!user) return;
    const err = validate();
    if (err) { toast.error(err); return; }
    if (bankChoice === "Other" && !otherBankName.trim()) {
      toast.error("Please type your bank name");
      return;
    }
    setSaving(true);
    const payload = {
      member_id: user.id,
      bank_name: banking.bank_name,
      account_holder_name: banking.account_holder_name.trim(),
      account_number: banking.account_number.trim(),
      account_type: banking.account_type,
      branch_code: banking.branch_code || null,
    };
    const { error } = await supabase
      .from("member_banking_details")
      .upsert(payload, { onConflict: "member_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Banking details saved. Payouts will be sent to this account.");
    setExisting(true);
    // Editing resets verification
    if (verified) setVerified(false);
  };

  const onBankChange = (v: string) => {
    setBankChoice(v);
    if (v === "Other") {
      setBanking((s) => ({ ...s, bank_name: otherBankName.trim(), branch_code: "" }));
    } else {
      const found = BANKS.find((b) => b.name === v);
      setBanking((s) => ({ ...s, bank_name: v, branch_code: found?.branch || s.branch_code }));
    }
  };

  const onOtherBankNameChange = (v: string) => {
    setOtherBankName(v);
    if (bankChoice === "Other") {
      setBanking((s) => ({ ...s, bank_name: v.trim() }));
    }
  };

  const totals = payouts.reduce(
    (acc, p) => {
      const n = Number(p.payout_amount);
      acc.total += p.status === "paid" ? n : 0;
      if (p.status === "pending" || p.status === "processing") acc.pending += n;
      return acc;
    },
    { total: 0, pending: 0 },
  );

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/profile" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Payouts</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">Banking & payouts</h1>

          {loading ? (
            <div className="mt-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Summary */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-3xl glass p-5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total earned</p>
                  <p className="mt-1 font-display text-2xl text-gradient-gold">{fmtR(totals.total)}</p>
                </div>
                <div className="rounded-3xl glass p-5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</p>
                  <p className="mt-1 font-display text-2xl">{fmtR(totals.pending)}</p>
                </div>
              </div>

              {/* Alerts */}
              {!existing && (
                <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p>Add banking details below to receive payouts.</p>
                </div>
              )}
              {existing && !verified && (
                <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4 flex items-start gap-3 text-sm">
                  <Clock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <p>Banking details pending verification. Contact admin if payouts are delayed.</p>
                </div>
              )}
              {existing && verified && (
                <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p>Banking details verified.</p>
                </div>
              )}

              {/* Banking form */}
              <div className="mt-6 rounded-3xl border border-border bg-gradient-card p-5 space-y-4">
                <h2 className="font-display text-lg flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-accent" /> Banking details
                </h2>

                <div className="space-y-2">
                  <Label>Bank</Label>
                  <Select value={bankChoice} onValueChange={onBankChange}>
                    <SelectTrigger><SelectValue placeholder="Select your bank" /></SelectTrigger>
                    <SelectContent>
                      {BANKS.map((b) => (
                        <SelectItem key={b.name} value={b.name}>
                          {b.name === "Other" ? "Other (specify)" : b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {bankChoice === "Other" && (
                    <div className="space-y-1 pt-2">
                      <Label>Other bank name</Label>
                      <Input
                        value={otherBankName}
                        onChange={(e) => onOtherBankNameChange(e.target.value)}
                        placeholder="Type your bank name (e.g. Bidvest Bank)"
                        maxLength={60}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Admin will use this exact name to send your payout.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Account holder name <span className="text-muted-foreground">(must match your ID)</span></Label>
                  <Input
                    value={banking.account_holder_name}
                    onChange={(e) => setBanking({ ...banking, account_holder_name: e.target.value })}
                    placeholder="Full name as on ID"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Account number</Label>
                    <Input
                      inputMode="numeric"
                      value={banking.account_number}
                      onChange={(e) => setBanking({ ...banking, account_number: e.target.value.replace(/\D/g, "") })}
                      placeholder="10-digit number"
                      maxLength={12}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch code</Label>
                    <Input
                      value={banking.branch_code}
                      onChange={(e) => setBanking({ ...banking, branch_code: e.target.value })}
                      placeholder="Auto-filled when possible"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Account type</Label>
                  <RadioGroup
                    value={banking.account_type}
                    onValueChange={(v) => setBanking({ ...banking, account_type: v })}
                    className="flex gap-4"
                  >
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value="savings" /> Savings
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value="cheque" /> Cheque
                    </label>
                  </RadioGroup>
                </div>

                <Button onClick={save} disabled={saving} className="w-full rounded-2xl bg-gradient-primary text-primary-foreground">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : existing ? "Update banking details" : "Save banking details"}
                </Button>
              </div>

              {/* Payouts history */}
              <div className="mt-8">
                <h2 className="font-display text-xl flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" /> Payment history
                </h2>
                {payouts.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No payouts yet.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
                    {payouts.map((p) => (
                      <li key={p.id} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{p.payout_period}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {p.circle_tier && <span className="capitalize">{p.circle_tier}</span>}
                            <Badge className={`${statusTone[p.status] ?? "bg-secondary"} border-0 capitalize`}>{p.status}</Badge>
                            {p.paid_at && <span>{new Date(p.paid_at).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <p className="font-display text-lg text-gradient-gold shrink-0">{fmtR(p.payout_amount)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
