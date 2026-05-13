import { useEffect, useState } from "react";
import PaystackPop from "@paystack/inline-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let cachedKey: string | null = null;
async function fetchPublicKey(): Promise<string | null> {
  if (cachedKey) {
    console.log("[Paystack Debug] Using cached public key:", cachedKey?.slice(0, 10) + "...");
    return cachedKey;
  }
  const fromEnv = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  if (fromEnv) {
    console.log("[Paystack Debug] Loaded public key from VITE env");
    cachedKey = fromEnv;
    return cachedKey;
  }
  console.log("[Paystack Debug] Fetching public key from edge function paystack-config…");
  const { data, error } = await supabase.functions.invoke("paystack-config", { method: "GET" });
  if (error) {
    console.error("[Paystack Debug] paystack-config error:", error);
    return null;
  }
  cachedKey = (data as any)?.public_key ?? null;
  console.log("[Paystack Debug] Edge function returned public_key:", cachedKey ? cachedKey.slice(0, 10) + "…" : "null");
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
    console.log("[Paystack Debug] 1. usePaystack mounted — loading key");
    fetchPublicKey().then((k) => {
      console.log("[Paystack Debug] 2. Public key resolved:", k ? k.slice(0, 10) + "…" : "NULL");
      setPubKey(k);
      setReady(!!k);
    }).catch((e) => {
      console.error("[Paystack Debug] Key load threw:", e);
    });
  }, []);

  const pay = async (args: PaystackPaymentArgs): Promise<{ ok: boolean; reference?: string; error?: string }> => {
    console.log("[Paystack Debug] 3. pay() called with:", {
      email: args.email,
      amountZar: args.amountZar,
      reference: args.reference,
      plan: args.plan,
    });
    const key = pubKey ?? (await fetchPublicKey());
    console.log("[Paystack Debug] 4. Using key:", key ? key.slice(0, 10) + "…" : "NULL");
    if (!key) {
      console.error("[Paystack Debug] ❌ No public key — aborting");
      toast.error("Payment unavailable — Paystack not configured");
      return { ok: false, error: "no_public_key" };
    }
    if (!args.email) {
      console.error("[Paystack Debug] ❌ No email provided — aborting");
      toast.error("Email is required for payment");
      return { ok: false, error: "no_email" };
    }
    if (!args.amountZar || args.amountZar <= 0) {
      console.error("[Paystack Debug] ❌ Invalid amount:", args.amountZar);
      toast.error("Invalid payment amount");
      return { ok: false, error: "invalid_amount" };
    }
    return new Promise((resolve) => {
      try {
        console.log("[Paystack Debug] 5. Instantiating PaystackPop…", typeof PaystackPop);
        const popup = new PaystackPop();
        console.log("[Paystack Debug] 6. Calling popup.newTransaction…");
        popup.newTransaction({
          key,
          email: args.email,
          amount: Math.round(args.amountZar * 100),
          currency: "ZAR",
          reference: args.reference,
          plan: args.plan,
          metadata: args.metadata,
          onSuccess: async (tx: any) => {
            console.log("[Paystack Debug] ✅ onSuccess:", tx);
            const { data, error } = await supabase.functions.invoke("verify-paystack-payment", {
              body: { reference: tx.reference },
            });
            if (error || !(data as any)?.ok) {
              const msg = (error as any)?.message || (data as any)?.error || "Verification pending";
              console.warn("[Paystack Debug] verify failed:", msg, { error, data });
              toast.warning("Payment received — verification pending", { description: msg });
              resolve({ ok: false, reference: tx.reference, error: msg });
              return;
            }
            toast.success("Payment successful ✓", { description: `Ref: ${tx.reference}` });
            resolve({ ok: true, reference: tx.reference });
          },
          onCancel: () => {
            console.log("[Paystack Debug] 🚫 onCancel");
            toast.message("Payment cancelled");
            resolve({ ok: false, error: "cancelled" });
          },
          onLoad: () => {
            console.log("[Paystack Debug] 7. Popup onLoad fired");
          },
          onError: (e: any) => {
            console.error("[Paystack Debug] ❌ onError:", e);
            toast.error("Payment failed", { description: e?.message ?? "Try again or use EFT" });
            resolve({ ok: false, error: e?.message ?? "error" });
          },
        });
        console.log("[Paystack Debug] 8. newTransaction() returned (popup should be opening)");
      } catch (e: any) {
        console.error("[Paystack Debug] ❌ Exception thrown opening popup:", e);
        toast.error("Could not open payment", { description: e?.message ?? String(e) });
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
