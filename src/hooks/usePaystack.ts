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
    console.log("[Paystack Debug] 4. Key prefix:", key ? key.substring(0, 8) : "NULL");

    // ---- Validation block ----
    if (!key || !/^pk_(live|test)_/.test(key)) {
      console.error("[Paystack Debug] ❌ Invalid public key format:", key?.substring(0, 8));
      toast.error("Payment system configuration error");
      return { ok: false, error: "invalid_public_key" };
    }
    const email = (args.email ?? "").trim();
    const emailValid = /\S+@\S+\.\S+/.test(email);
    console.log("[Paystack Debug] Email:", email, "valid?", emailValid);
    if (!emailValid) {
      toast.error("Valid email address required for payment");
      return { ok: false, error: "invalid_email" };
    }
    const amountInKobo = Math.round(Number(args.amountZar) * 100);
    console.log("[Paystack Debug] Amount ZAR:", args.amountZar, "→ kobo:", amountInKobo);
    if (!Number.isFinite(amountInKobo) || amountInKobo < 100) {
      toast.error("Invalid amount. Minimum R1 required.");
      return { ok: false, error: "invalid_amount" };
    }
    const cleanRef = String(args.reference ?? "").replace(/[^A-Za-z0-9\-_=.]/g, "").slice(0, 100);
    console.log("[Paystack Debug] Reference (clean):", cleanRef);
    if (!cleanRef || cleanRef.length < 6) {
      toast.error("Invalid payment reference");
      return { ok: false, error: "invalid_reference" };
    }

    console.log("[Paystack Debug] ✅ Final parameters:", {
      key: key.substring(0, 10) + "...",
      email,
      amount: amountInKobo,
      currency: "ZAR",
      reference: cleanRef,
      plan: args.plan,
      allValid: true,
    });

    return new Promise((resolve) => {
      const txParams = {
        key,
        email,
        amount: amountInKobo,
        currency: "ZAR",
        reference: cleanRef,
        plan: args.plan,
        metadata: args.metadata,
      };
      console.log("[Paystack Debug] 6a. Parameters:", {
        key: key.substring(0, 15) + "...",
        email,
        amount: amountInKobo,
        currency: "ZAR",
        reference: cleanRef,
        plan: args.plan,
        metadata: args.metadata,
      });
      try {
        console.log("[Paystack Debug] 5. Instantiating PaystackPop…", typeof PaystackPop);
        const popup = new PaystackPop();
        console.log("[Paystack Debug] 6. Calling popup.newTransaction…");
        popup.newTransaction({
          ...txParams,
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
