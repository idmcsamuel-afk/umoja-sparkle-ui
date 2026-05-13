import { useEffect, useState } from "react";
import PaystackPop from "@paystack/inline-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let cachedKey: string | null = null;
async function fetchPublicKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  // Prefer build-time env if present
  const fromEnv = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  if (fromEnv) { cachedKey = fromEnv; return cachedKey; }
  const { data, error } = await supabase.functions.invoke("paystack-config", { method: "GET" });
  if (error) return null;
  cachedKey = (data as any)?.public_key ?? null;
  return cachedKey;
}

export interface PaystackPaymentArgs {
  email: string;
  amountZar: number;
  reference: string;
  metadata?: Record<string, any>;
  plan?: string;
}

export function usePaystack() {
  const [ready, setReady] = useState(false);
  const [pubKey, setPubKey] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicKey().then((k) => { setPubKey(k); setReady(!!k); });
  }, []);

  const pay = async (args: PaystackPaymentArgs): Promise<{ ok: boolean; reference?: string; error?: string }> => {
    const key = pubKey ?? (await fetchPublicKey());
    if (!key) {
      toast.error("Payment unavailable — Paystack not configured");
      return { ok: false, error: "no_public_key" };
    }
    return new Promise((resolve) => {
      try {
        const popup = new PaystackPop();
        popup.newTransaction({
          key,
          email: args.email,
          amount: Math.round(args.amountZar * 100),
          currency: "ZAR",
          reference: args.reference,
          plan: args.plan,
          metadata: args.metadata,
          onSuccess: async (tx: any) => {
            const { data, error } = await supabase.functions.invoke("verify-paystack-payment", {
              body: { reference: tx.reference },
            });
            if (error || !(data as any)?.ok) {
              const msg = (error as any)?.message || (data as any)?.error || "Verification pending";
              toast.warning("Payment received — verification pending", { description: msg });
              resolve({ ok: false, reference: tx.reference, error: msg });
              return;
            }
            toast.success("Payment successful ✓", { description: `Ref: ${tx.reference}` });
            resolve({ ok: true, reference: tx.reference });
          },
          onCancel: () => {
            toast.message("Payment cancelled");
            resolve({ ok: false, error: "cancelled" });
          },
          onLoad: () => {},
          onError: (e: any) => {
            toast.error("Payment failed", { description: e?.message ?? "Try again or use EFT" });
            resolve({ ok: false, error: e?.message ?? "error" });
          },
        });
      } catch (e: any) {
        resolve({ ok: false, error: e?.message ?? String(e) });
      }
    });
  };

  return { pay, ready, pubKey };
}

export function buildReference(prefix: "CIRCLE" | "PROP" | "DRIVE" | "BC" | "ST", id: string, memberCode: string) {
  const ts = Date.now();
  const safe = (s: string) => String(s).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12) || "X";
  return `${prefix}-${safe(id)}-${safe(memberCode)}-${ts}`;
}
