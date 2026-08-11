export type TenderRow = {
  id: string;
  ocid: string;
  reference_number: string | null;
  title: string | null;
  description: string | null;
  buyer_name: string | null;
  province: string | null;
  delivery_location: string | null;
  category: string | null;
  procurement_method: string | null;
  status: string | null;
  value_amount: number | null;
  value_currency: string | null;
  published_at: string | null;
  closing_at: string | null;
  briefing_at: string | null;
  briefing_compulsory: boolean | null;
  source_url: string | null;
  documents: unknown;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

/** Short display title for cards: ~70 chars, trimmed at a word boundary. */
export function displayTitle(text: string | null | undefined, max = 70): string {
  const raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "Untitled tender";
  if (raw.length <= max) return raw;
  const slice = raw.slice(0, max);
  const cut = slice.lastIndexOf(" ");
  return `${(cut > 30 ? slice.slice(0, cut) : slice).replace(/[,;:.\-–—]$/, "")}…`;
}

/** Whole days until closing (negative = closed). Null when unknown. */
export function daysUntil(closing: string | null | undefined): number | null {
  if (!closing) return null;
  const ms = new Date(closing).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / 86_400_000);
}

export function isUrgent(closing: string | null | undefined): boolean {
  const d = daysUntil(closing);
  return d !== null && d >= 0 && d <= 3;
}

export function isClosed(closing: string | null | undefined): boolean {
  const d = daysUntil(closing);
  return d !== null && d < 0;
}

export function closingLabel(closing: string | null | undefined): string {
  const d = daysUntil(closing);
  if (d === null) return "Closing date not stated";
  if (d < 0) return "Closed";
  if (d === 0) return "Closes today";
  if (d === 1) return "Closes tomorrow";
  return `Closes in ${d} days`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Only render a value when it is a real amount — never show "R0". */
export function formatTenderValue(amount: number | null | undefined, currency?: string | null): string | null {
  if (amount === null || amount === undefined) return null;
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currency || "ZAR",
    maximumFractionDigits: 0,
  }).format(n);
}

export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
  "National",
];

export const ETENDERS_HOME = "https://www.etenders.gov.za/Home/opportunities?id=1";
