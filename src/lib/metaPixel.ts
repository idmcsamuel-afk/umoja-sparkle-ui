// Meta Pixel helper. Base script + init are in index.html, so fbq is already
// queued/loaded globally. These helpers are safe no-ops in SSR / when blocked.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const fbqTrack = (
  event: string,
  params?: Record<string, unknown>
): void => {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.("track", event, params);
  } catch {
    /* swallow */
  }
};

export const fbqPageView = (): void => fbqTrack("PageView");
