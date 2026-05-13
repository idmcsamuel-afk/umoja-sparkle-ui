import { useEffect, useState } from "react";
import PaystackPop from "@paystack/inline-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const isDev = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname.includes("lovable"));
const dlog = (...a: any[]) => { if (isDev) console.log(...a); };
const dwarn = (...a: any[]) => { if (isDev) console.warn(...a); };
const derr = (...a: any[]) => console.error(...a);

let cachedKey: string | null = null;
async function fetchPublicKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  const fromEnv = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  if (fromEnv) {
    cachedKey = fromEnv;
    return cachedKey;
  }
  const { data, error } = await supabase.functions.invoke("paystack-config", { method: "GET" });
  if (error) {
    derr("[Paystack] paystack-config error:", error);
    return null;
  }
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
    fetchPublicKey().then((k) => {
      setPubKey(k);
      setReady(!!k);
    }).catch((e) => derr("[Paystack] Key load failed:", e));
  }, []);

  const pay = async (args: PaystackPaymentArgs): Promise<{ ok: boolean; reference?: string; error?: string }> => {
    const key = pubKey ?? (await fetchPublicKey());

    if (!key || !/^pk_(live|test)_/.test(key)) {
      toast.error("Payment system configuration error");
      return { ok: false, error: "invalid_public_key" };
    }
    const email = (args.email ?? "").trim().toLowerCase();
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
      toast.error("Valid email address required for payment");
      return { ok: false, error: "invalid_email" };
    }
    const amountInKobo = Math.floor(Math.abs(Number(args.amountZar) * 100));
    if (!Number.isFinite(amountInKobo) || amountInKobo < 100) {
      toast.error("Invalid amount. Minimum R1 required.");
      return { ok: false, error: "invalid_amount" };
    }
    const cleanRef = String(args.reference ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 100);
    if (!cleanRef || cleanRef.length < 6) {
      toast.error("Invalid payment reference");
      return { ok: false, error: "invalid_reference" };
    }

    // Stash metadata for verify-time use; do NOT pass to Paystack popup (causes input lag)
    if (args.metadata && Object.keys(args.metadata).length) {
      try {
        sessionStorage.setItem(`paystack:meta:${cleanRef}`, JSON.stringify(args.metadata));
      } catch {}
    }

    toast.message("Opening payment gateway…", { duration: 1200 });

    return new Promise((resolve) => {
      const txParams: any = {
        key,
        email,
        amount: amountInKobo,
        currency: "ZAR",
        ref: cleanRef,
      };
      if (args.plan) txParams.plan = args.plan;

      // Signal app to pause heavy background work while popup is open
      const fireOpen = () => window.dispatchEvent(new Event("paystack-popup-open"));
      const fireClose = () => window.dispatchEvent(new Event("paystack-popup-close"));

      try {
        const popup = new PaystackPop();
        fireOpen();
        popup.newTransaction({
          ...txParams,
          onSuccess: async (tx: any) => {
            fireClose();
            dlog("[Paystack] success:", tx?.reference);
            const { data, error } = await supabase.functions.invoke("verify-paystack-payment", {
              body: { reference: tx.reference },
            });
            const d = data as any;
            if (error || !d?.ok) {
              const msg = (error as any)?.message || d?.error || "Verification pending";
              dwarn("[Paystack] verify hard-fail:", msg);
              toast.warning("Payment received — verification pending", {
                description: `${msg}. Ref: ${tx.reference}`,
              });
              resolve({ ok: false, reference: tx.reference, error: msg });
              return;
            }
            if (d.applied === false) {
              toast.success("Payment received ✓", {
                description: `Activation pending review. Ref: ${tx.reference}`,
              });
            } else {
              toast.success("Payment successful ✓", { description: `Ref: ${tx.reference}` });
            }
            resolve({ ok: true, reference: tx.reference });
          },
          onCancel: () => {
            fireClose();
            toast.message("Payment cancelled");
            resolve({ ok: false, error: "cancelled" });
          },
          onError: (e: any) => {
            fireClose();
            derr("[Paystack] onError:", e);
            toast.error("Payment failed", { description: e?.message ?? "Try again or use EFT" });
            resolve({ ok: false, error: e?.message ?? "error" });
          },
        });
      } catch (e: any) {
        fireClose();
        derr("[Paystack] Exception opening popup:", e);
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
