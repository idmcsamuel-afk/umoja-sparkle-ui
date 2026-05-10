import { useEffect, useState } from "react";

const KEY = "umoja_timezone";
const EVENT = "umoja:timezone-change";

function detect(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg";
  } catch {
    return "Africa/Johannesburg";
  }
}

export function getTimezone(): string {
  if (typeof window === "undefined") return "Africa/Johannesburg";
  return localStorage.getItem(KEY) || detect();
}

export function setTimezone(tz: string) {
  localStorage.setItem(KEY, tz);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: tz }));
}

export function useTimezone(): [string, (tz: string) => void] {
  const [tz, setTz] = useState<string>(() => getTimezone());
  useEffect(() => {
    const handler = (e: Event) => setTz((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return [tz, setTimezone];
}

/** Format an absolute timestamp as HH:MM in the given IANA timezone. */
export function formatTime(ts: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(new Date(ts));
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  }
}

/** Short tz abbreviation, e.g. "SAST", "GMT+1". */
export function tzAbbrev(ts: number, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date(ts));
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}
