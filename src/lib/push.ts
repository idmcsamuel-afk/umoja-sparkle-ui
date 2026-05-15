import { supabase } from "@/integrations/supabase/client";

// Public VAPID key (safe to ship). Keep in sync with VAPID_PUBLIC_KEY secret.
export const VAPID_PUBLIC_KEY =
  "BHNTPhEaR3rbazEL_mn_WxFG9-MlfLmupw78Dte2WhXSQhiMyj_0cKNa181Zb5UypsIIuknX4jqig0f6BNAeD7U";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return typeof window !== "undefined" &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function ensureSwRegistered() {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return await navigator.serviceWorker.register("/sw.js");
}

export async function getPushPermission() {
  if (!("Notification" in window)) return "denied" as NotificationPermission;
  return Notification.permission;
}

export async function subscribePush() {
  if (!pushSupported()) throw new Error("Push not supported on this device");
  const reg = await ensureSwRegistered();
  if (!reg) throw new Error("Service worker registration failed");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission denied");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first");
  const { error } = await supabase.from("push_subscriptions").upsert({
    member_id: user.id,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return sub;
}

export async function unsubscribePush() {
  const reg = await ensureSwRegistered();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

export async function isSubscribed() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}
