import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Lock,
  Sparkles,
  Unlock,
} from "lucide-react";

const SPARK_RATE = 1.4;
const FEE_RATE = 0.05;
const MIN_ZAR = 500;
const MIN_SPARKS = Math.ceil(MIN_ZAR / SPARK_RATE); // 358 with ceil(500/1.4)

interface Breakdown {
  promotional: number;
  earned: number;
  purchased: number;
  referral: number;
  total: number;
  total_playable: number;
  withdrawable: number;
  total_withdrawable: number;
  referral_releasable: number;
  referral_locked: number;
  promo_expires_at: string | null;
  zar_value: number;
  has_contributed: boolean;
  qualifying_contribution_zar: number;
}

interface MemberInfo {
  kyc_level: number | null;
  created_at: string;
  bank_name: string | null;
  bank_account: string | null;
  bank_branch: string | null;
  full_name: string | null;
  promotional_sparks_unlocked: boolean;
}

const bankSchema = z.object({
  amount: z.number().int().positive(),
  bank_name: z.string().trim().min(2).max(60),
  account_number: z.string().trim().regex(/^\d{6,18}$/, "Account number must be 6–18 digits"),
  account_holder: z.string().trim().min(2).max(80),
  branch_code: z
    .string()
    .trim()
    .max(10)
    .optional()
    .or(z.literal("")),
});

const SA_BANKS = [
  "Absa",
  "Standard Bank",
  "FNB",
  "Nedbank",
  "Capitec",
  "TymeBank",
  "African Bank",
  "Investec",
  "Discovery Bank",
  "Bidvest Bank",
  "Other",
];

export default function Withdraw() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState<string>(String(MIN_SPARKS));
  const [includePromo, setIncludePromo] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ reference: string; net: number } | null>(null);

  const loadAll = async () => {
    if (!user) return;
    const [{ data: br }, { data: mb }, { data: bd }] = await Promise.all([
      supabase.rpc("spark_balance_breakdown", { _member: user.id }),
      supabase
        .from("members")
        .select(
          "kyc_level, created_at, bank_name, bank_account, bank_branch, full_name, promotional_sparks_unlocked",
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("member_banking_details")
        .select("bank_name, account_holder_name, account_number, branch_code")
        .eq("member_id", user.id)
        .maybeSingle(),
    ]);
    if (br) setBreakdown(br as unknown as Breakdown);
    if (mb) {
      const m = mb as unknown as MemberInfo;
      setMember(m);
    }
    // Prefer the registered banking details from the Banking page,
    // fall back to legacy fields on members.
    const reg = bd as any;
    const fallback = mb as any;
    const pickBank = reg?.bank_name ?? fallback?.bank_name ?? "";
    const pickAccount = reg?.account_number ?? fallback?.bank_account ?? "";
    const pickBranch = reg?.branch_code ?? fallback?.bank_branch ?? "";
    const pickHolder = reg?.account_holder_name ?? fallback?.full_name ?? "";
    if (pickBank) setBankName(pickBank);
    if (pickAccount) setAccountNumber(pickAccount);
    if (pickBranch) setBranchCode(pickBranch);
    if (pickHolder) setAccountHolder((prev) => prev || pickHolder);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    if (!user) return;
    const ch = supabase
      .channel("withdraw-wallet-" + user.id + "-" + Math.random().toString(36).slice(2, 9))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spark_wallets", filter: `member_id=eq.${user.id}` },
        () => loadAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line
  }, [user?.id]);

  const amountNum = Math.max(0, Math.floor(Number(amount) || 0));
  const gross = +(amountNum * SPARK_RATE).toFixed(2);
  const fee = +(gross * FEE_RATE).toFixed(2);
  const net = +(gross - fee).toFixed(2);

  const promoUnlocked = !!member?.promotional_sparks_unlocked;
  const promoBalance = breakdown?.promotional ?? 0;
  const earnedBalance = breakdown?.earned ?? 0;
  const purchasedBalance = breakdown?.purchased ?? 0;

  const maxWithdrawable =
    earnedBalance + purchasedBalance + (includePromo && promoUnlocked ? promoBalance : 0);

  const accountAgeDays = member
    ? Math.floor((Date.now() - new Date(member.created_at).getTime()) / 86400000)
    : 0;
  const accountTooNew = accountAgeDays < 7;
  const kycReady = (member?.kyc_level ?? 0) >= 1;

  const validations = useMemo(() => {
    const errs: string[] = [];
    if (!kycReady) errs.push("Complete KYC Level 1 to withdraw");
    if (accountTooNew) errs.push(`Wait ${7 - accountAgeDays} more day(s) (account < 7 days old)`);
    if (amountNum < MIN_SPARKS)
      errs.push(`Minimum withdrawal is ${MIN_SPARKS} sparks (≈ R${MIN_ZAR})`);
    if (amountNum > maxWithdrawable) errs.push("Insufficient withdrawable balance");
    return errs;
  }, [kycReady, accountTooNew, accountAgeDays, amountNum, maxWithdrawable]);

  const canSubmit =
    validations.length === 0 &&
    confirmChecked &&
    bankName &&
    accountNumber &&
    accountHolder &&
    !submitting;

  const handleSubmit = async () => {
    if (!user) return;
    const parsed = bankSchema.safeParse({
      amount: amountNum,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder: accountHolder,
      branch_code: branchCode || undefined,
    });
    if (!parsed.success) {
      toast({
        title: "Check your details",
        description: parsed.error.issues[0]?.message ?? "Invalid input",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_withdrawal_request", {
      _amount_sparks: amountNum,
      _bank_name: bankName,
      _account_number: accountNumber,
      _account_holder: accountHolder,
      _branch_code: branchCode || null,
      _include_promotional: includePromo && promoUnlocked,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Withdrawal failed", description: error.message, variant: "destructive" });
      return;
    }
    const r = data as { ok: boolean; reason?: string; reference?: string; net?: number };
    if (!r?.ok) {
      const reasons: Record<string, string> = {
        kyc_required: "Complete KYC to withdraw.",
        account_too_new: "Your account must be 7+ days old.",
        below_minimum: `Minimum withdrawal is ${MIN_SPARKS} sparks.`,
        insufficient_withdrawable: "Insufficient withdrawable balance.",
        daily_cap_reached: "Daily withdrawal cap reached. Try again tomorrow.",
        no_wallet: "No wallet found.",
      };
      toast({
        title: "Withdrawal blocked",
        description: reasons[r?.reason ?? ""] ?? r?.reason ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    setSuccess({ reference: r.reference!, net: r.net! });
    loadAll();
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading your balance…</div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <CardTitle className="mt-2">Withdrawal Submitted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <p className="text-3xl font-bold">R{success.net.toLocaleString("en-ZA")}</p>
            <p className="text-sm text-muted-foreground">
              EFT will arrive within 24–48 hours.
            </p>
            <p className="text-xs">
              Reference: <span className="font-mono font-semibold">{success.reference}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              We've emailed you the details and you'll get a notification when it completes.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Dashboard
              </Button>
              <Button onClick={() => setSuccess(null)}>New Withdrawal</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowDownToLine className="h-6 w-6 text-primary" /> Withdraw Sparks
        </h1>
        <p className="text-sm text-muted-foreground">
          Convert your withdrawable sparks to ZAR via EFT. Rate: R{SPARK_RATE}/spark · Fee: 5%
        </p>
      </header>

      {/* Section 1: Balance breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Your Balance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <BalanceRow
            label="Promotional Sparks"
            value={promoBalance}
            note={
              promoUnlocked
                ? "Unlocked ✓ Withdrawable"
                : "Locked — contribute R50+ to a Circle to unlock"
            }
            tone={promoUnlocked ? "ok" : "warn"}
          />
          <BalanceRow
            label="Earned Sparks"
            value={earnedBalance}
            note="Withdrawable ✓"
            tone="ok"
          />
          <BalanceRow
            label="Purchased Sparks"
            value={purchasedBalance}
            note="Withdrawable ✓"
            tone="ok"
          />
          <div className="mt-3 flex items-center justify-between rounded-lg bg-foreground/5 p-3">
            <span className="text-sm font-semibold">
              Total Withdrawable {includePromo && promoUnlocked ? "(incl. promo)" : ""}
            </span>
            <span className="text-2xl font-extrabold">{maxWithdrawable}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            ≈ R{(maxWithdrawable * SPARK_RATE).toFixed(2)} gross
          </p>
        </CardContent>
      </Card>

      {/* Promo unlock card */}
      {promoBalance > 0 && (
        <Card
          className={
            promoUnlocked
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-orange-500/40 bg-orange-500/5"
          }
        >
          <CardContent className="pt-5">
            {promoUnlocked ? (
              <div className="flex items-start gap-3">
                <Unlock className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">Promotional sparks unlocked ✓</p>
                  <p className="text-muted-foreground mt-1">
                    Tick the box below to include your {promoBalance} promo sparks in this
                    withdrawal.
                  </p>
                  <label className="mt-2 flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={includePromo}
                      onCheckedChange={(v) => setIncludePromo(!!v)}
                    />
                    <span className="text-sm">Include promotional sparks</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="text-sm flex-1">
                  <p className="font-semibold">Promotional sparks are locked</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside text-xs">
                    <li>Contribute R50+ to a Circle to unlock R{(promoBalance * SPARK_RATE).toFixed(2)} in promo value</li>
                    <li>Bonus earned sparks: R50–99 → +5, R100–500 → +10, R501–1000 → +75, R1001+ → +200</li>
                    <li>Bonus sparks are fully withdrawable</li>
                  </ul>
                  <Button asChild className="mt-3" size="sm">
                    <Link to="/circle">Go to Circles</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 2: Withdrawal Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider">Withdrawal Amount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="amt">Amount (sparks)</Label>
            <Input
              id="amt"
              type="number"
              min={MIN_SPARKS}
              max={maxWithdrawable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Min: {MIN_SPARKS} (R{MIN_ZAR})</span>
              <button
                type="button"
                onClick={() => setAmount(String(maxWithdrawable))}
                className="text-primary hover:underline"
              >
                Max: {maxWithdrawable}
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3 text-sm space-y-1">
            <Row label={`Gross (${amountNum} × R${SPARK_RATE})`} value={`R${gross.toFixed(2)}`} />
            <Row label="Fee (5%)" value={`–R${fee.toFixed(2)}`} muted />
            <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
              <span>You'll receive</span>
              <span className="text-emerald-600 dark:text-emerald-400">R{net.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="bank">Bank</Label>
              <select
                id="bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select your bank…</option>
                {SA_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="acc">Account number</Label>
              <Input
                id="acc"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                maxLength={18}
              />
            </div>
            <div>
              <Label htmlFor="branch">Branch code (optional)</Label>
              <Input
                id="branch"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                maxLength={10}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="holder">Account holder name</Label>
              <Input
                id="holder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                maxLength={80}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: KYC + checks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider">Eligibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Check ok={kycReady} label="KYC Level 1 verified" />
          <Check ok={!accountTooNew} label={`Account 7+ days old (${accountAgeDays}d)`} />
          <Check ok={amountNum >= MIN_SPARKS} label={`Amount ≥ ${MIN_SPARKS} sparks`} />
          <Check ok={amountNum <= maxWithdrawable && amountNum > 0} label="Sufficient balance" />
          {!kycReady && (
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to="/kyc">Complete KYC</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {validations.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <ul className="space-y-0.5">
            {validations.map((v) => (
              <li key={v}>• {v}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 4: Confirm */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="text-sm space-y-1">
            <Row label="Amount" value={`${amountNum} sparks`} />
            <Row label="Net payout" value={`R${net.toFixed(2)}`} />
            <Row label="Fee" value={`R${fee.toFixed(2)}`} muted />
            <Row
              label="To account"
              value={
                accountNumber
                  ? `${bankName || "—"} •••• ${accountNumber.slice(-4)}`
                  : "—"
              }
            />
            <Row label="Processing time" value="24–48 hours" muted />
          </div>
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={confirmChecked}
              onCheckedChange={(v) => setConfirmChecked(!!v)}
              className="mt-0.5"
            />
            <span>I confirm my bank details are correct.</span>
          </label>
          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting…" : "Confirm & Send EFT"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BalanceRow({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone: "ok" | "warn";
}) {
  const ring =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : "border-orange-500/30 bg-orange-500/5";
  return (
    <div className={`rounded-lg border p-3 ${ring}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{note}</p>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={muted ? "text-muted-foreground" : "font-medium"}>{value}</span>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${
          ok ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
        }`}
      >
        {ok ? "✓" : "•"}
      </span>
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
