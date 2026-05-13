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
    const email = (args.email ?? "").trim().toLowerCase();
    const emailValid = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
    console.log("[Paystack Debug] Email:", email, "valid?", emailValid);
    if (!emailValid) {
      toast.error("Valid email address required for payment");
      return { ok: false, error: "invalid_email" };
    }
    const amountInKobo = Math.floor(Math.abs(Number(args.amountZar) * 100));
    console.log("[Paystack Debug] Amount check:", {
      original: args.amountZar,
      kobo: amountInKobo,
      type: typeof amountInKobo,
    });
    if (!Number.isFinite(amountInKobo) || amountInKobo < 100) {
      toast.error("Invalid amount. Minimum R1 required.");
      return { ok: false, error: "invalid_amount" };
    }
    const cleanRef = String(args.reference ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 100);
    console.log("[Paystack Debug] Reference check:", {
      original: args.reference,
      cleaned: cleanRef,
      length: cleanRef.length,
    });
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
      const customFields = Object.entries(args.metadata ?? {}).map(([k, v]) => ({
        display_name: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        variable_name: k,
        value: String(v ?? ""),
      }));
      const txParams: any = {
        key,
        email,
        amount: amountInKobo,
        currency: "ZAR",
        ref: cleanRef,
      };
      if (args.plan) txParams.plan = args.plan;
      if (customFields.length) txParams.metadata = { custom_fields: customFields };
      console.log("[Paystack Debug] 6a. Parameters:", {
        ...txParams,
        key: key.substring(0, 15) + "...",
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
            console.log("[Paystack Debug] verify response:", { data, error });
            const d = data as any;
            if (error || !d?.ok) {
              const msg = (error as any)?.message || d?.error || "Verification pending";
              console.warn("[Paystack Debug] verify hard-fail:", msg, { error, data });
              toast.warning("Payment received — verification pending", {
                description: `${msg}. Ref: ${tx.reference}`,
              });
              resolve({ ok: false, reference: tx.reference, error: msg });
              return;
            }
            if (d.applied === false) {
              console.warn("[Paystack Debug] verified but not applied:", d);
              toast.success("Payment received ✓", {
                description: `Activation pending review. Ref: ${tx.reference}`,
              });
            } else {
              toast.success("Payment successful ✓", { description: `Ref: ${tx.reference}` });
            }
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
        console.log("[Paystack Debug] 7. newTransaction called successfully (popup should be opening)");
      } catch (e: any) {
        console.error("[Paystack Debug] ❌ Exception thrown opening popup:", {
          name: e?.name,
          message: e?.message,
          stack: e?.stack,
          fullError: e,
        });
        const msg: string = e?.message ?? String(e);
        let friendly = "Payment popup failed to open: " + (msg || "Unknown error");
        if (/invalid/i.test(msg)) friendly = "Payment details invalid. Please try EFT payment instead.";
        else if (/key/i.test(msg)) friendly = "Payment system configuration error. Contact support.";
        toast.error("Could not open payment", { description: friendly });
        resolve({ ok: false, error: friendly });
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
