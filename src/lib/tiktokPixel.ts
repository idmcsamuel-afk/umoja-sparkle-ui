// Tiny wrapper around the TikTok Pixel (loaded in index.html).
// Safe no-ops if the script hasn't loaded.
type TtqEventProps = Record<string, unknown>;

interface Ttq {
  track: (event: string, props?: TtqEventProps) => void;
  page: () => void;
  identify?: (props: TtqEventProps) => void;
}

function ttq(): Ttq | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ttq?: Ttq };
  return w.ttq ?? null;
}

export function ttTrack(event: string, props?: TtqEventProps) {
  try {
    ttq()?.track(event, props);
  } catch (e) {
    console.warn("[tiktok-pixel] track failed", event, e);
  }
}

export function ttPage() {
  try { ttq()?.page(); } catch {}
}
