import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Loader2, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  bidId: string;
  amountUsdt: number;
  amountZar: number;
  platformAddress: string | null;
  deadlineMs?: number;
  nowMs: number;
  onConfirmed: () => void;
}

function fmtCountdown(ms: number) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function friendlyUsdtError(code: string, details?: { expected?: number; received?: number }) {
  switch (code) {
    case "tx_not_found":
      return "Transaction not found yet. It may still be propagating — wait 1–2 minutes and retry.";
    case "tx_failed_on_chain":
      return "This transaction failed on the Tron network. Please send a new payment.";
    case "not_a_usdt_transfer":
      return "This is not a USDT transfer. Make sure you sent USDT on Tron (TRC20) — not ERC20 or another token.";
    case "wrong_recipient":
      return "Wrong recipient address. The USDT must be sent to the UMOJA platform address shown above.";
    case "amount_too_low":
      return `Amount too low after network fees. Expected ~${Number(details?.expected ?? 0).toFixed(2)} USDT, received ${Number(details?.received ?? 0).toFixed(2)} USDT. Exchanges (Binance/Luno) often deduct $1–2 in fees — send a bit extra and retry.`;
    case "txhash_already_used":
      return "This transaction hash is already linked to another bid. Use a different transaction.";
    case "different_txhash_already_recorded":
      return "A different transaction hash is already recorded for this bid. Contact support if this is wrong.";
    case "platform_address_not_configured":
      return "Crypto payments are not fully configured. Please use another payment method or contact support.";
    case "no_usdt_amount":
      return "Bid is missing the USDT amount — please re-create the bid and try again.";
    case "forbidden":
    case "auth_required":
      return "You don't have permission to verify this bid. Please log in again.";
    case "bid_not_found":
      return "Bid not found — it may have expired. Please create a new bid.";
    case "invalid_txhash_format":
      return "That doesn't look like a valid TRC20 transaction hash (should be 64 hex characters).";
    default:
      return `Verification failed (${code}). Please double-check the transaction hash and try again.`;
  }
}

export function UsdtPayPanel({ bidId, amountUsdt, amountZar, platformAddress, deadlineMs, nowMs, onConfirmed }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [txhash, setTxhash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const msLeft = deadlineMs ? deadlineMs - nowMs : null;
  const expired = msLeft !== null && msLeft <= 0;

  const verify = async () => {
    setErrorMsg(null);
    const clean = txhash.trim().replace(/^0x/, "");
    if (!/^[a-fA-F0-9]{64}$/.test(clean)) {
      setErrorMsg("Enter a valid 64-character TRC20 transaction hash.");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("usdt-verify-tx", {
        body: { bidId, txHash: clean },
      });
      if (error || !data?.ok) {
        const code = (data as any)?.error ?? "verify_failed";
        const msg = friendlyUsdtError(code, {
          expected: (data as any)?.expected,
          received: (data as any)?.received,
        });
        setErrorMsg(msg);
        toast.error(msg);
      } else {
        toast.success(`USDT payment confirmed (${data.usdt_amount} USDT)`);
        onConfirmed();
      }
    } catch (e: any) {
      const msg = e?.message ?? "Verification failed. Please retry.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  if (!platformAddress) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Crypto payments are enabled but the platform USDT address is not configured. Please contact support or use another payment method.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deadlineMs && (
        <div
          className={`rounded-2xl border p-3 text-sm ${
            expired
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-primary/40 bg-primary/10 text-primary"
          }`}
        >
          <p className="font-medium">
            {expired ? "⏰ Payment window expired — this bid is no longer valid." : "⏱️ Send USDT within 1 hour"}
          </p>
          {!expired && msLeft !== null && (
            <p className="mt-1 font-mono text-base tabular-nums">Time remaining: {fmtCountdown(msLeft)}</p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">USDT Payment Details</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
            TRC20 · Low fees
          </span>
        </div>

        <div className="grid place-items-center bg-white rounded-xl p-3">
          <QRCodeSVG value={platformAddress} size={160} />
        </div>

        {[
          ["Network", "Tron (TRC20)"],
          ["Amount", `${amountUsdt.toFixed(2)} USDT (≈R${Math.round(amountZar).toLocaleString("en-ZA")})`],
          ["Address", platformAddress],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-1 border-b border-border/40 last:border-b-0">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs truncate max-w-[180px]">{value}</span>
              {label === "Address" && (
                <button onClick={() => copy(label, String(value))} className="grid h-7 w-7 place-items-center rounded-lg bg-background/60 hover:bg-background text-muted-foreground hover:text-foreground transition-smooth" aria-label={`Copy ${label}`}>
                  {copied === label ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                </button>
              )}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-200 dark:text-amber-300">
          <p className="font-medium">⚠️ Network fee notice</p>
          <p className="mt-1 opacity-90">
            Exchanges like Binance / Luno usually deduct <strong>$1–2 USDT</strong> in network fees. To make sure the full <strong>{amountUsdt.toFixed(2)} USDT</strong> arrives, send <strong>{(amountUsdt + 1.5).toFixed(2)} USDT</strong> (or more). We accept payments within a 15% tolerance to cover fees.
          </p>
          <p className="mt-1 opacity-80">
            💡 Cheaper: withdraw to Trust Wallet first, then send (TRC20 fee ~$0.50).
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-4">
        <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          After sending: paste transaction hash
        </Label>
        <Input
          value={txhash}
          onChange={(e) => setTxhash(e.target.value)}
          placeholder="64-character TRC20 transaction hash"
          className="h-11 rounded-2xl bg-background/60 font-mono text-xs"
        />
        {errorMsg && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <p className="font-medium">⚠️ {errorMsg}</p>
            <p className="mt-1 text-[10px] opacity-80">Tip: check the hash on TronScan, then paste it again and retry.</p>
          </div>
        )}
        <Button
          onClick={verify}
          disabled={verifying || expired || !txhash.trim()}
          className="w-full rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : errorMsg ? "Retry verification" : "Verify USDT payment"}
        </Button>
        {txhash.trim().length >= 60 && (
          <a
            href={`https://tronscan.org/#/transaction/${txhash.trim().replace(/^0x/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-accent inline-flex items-center gap-1"
          >
            View this transaction on TronScan <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <p className="text-[10px] text-muted-foreground">
          We verify on-chain via TronScan. Confirmation usually takes seconds. You can retry as many times as needed.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        className="text-xs text-accent inline-flex items-center gap-1"
      >
        <Info className="h-3 w-3" /> {helpOpen ? "Hide help" : "What is USDT and how do I get it?"}
      </button>
      {helpOpen && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground space-y-2">
          <p><strong>USDT</strong> is a digital dollar (1 USDT ≈ $1 USD) sent over the blockchain — instant, cheap, global.</p>
          <p><strong>How to get USDT:</strong> Buy on Binance, Coinbase, or Luno, then withdraw to your Tron (TRC20) wallet.</p>
          <p><strong>Recommended wallets:</strong> Trust Wallet (mobile), Binance app, Luno (South Africa).</p>
          <p className="pt-1 border-t border-border/40 text-[10px]">
            Cryptocurrency payments are processed peer-to-peer. UMOJA does not provide crypto exchange services. Users are responsible for acquiring USDT independently.
          </p>
          <a
            href="https://tronscan.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent"
          >
            View on TronScan <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
