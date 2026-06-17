// Shared currency formatter for edge functions (Deno).
// Mirrors src/lib/currency.ts so server-rendered messages (notifications, SMS,
// email) can show amounts in a member's local currency.
//
// Exchange rates anchored to ZAR. Keep in sync with src/lib/currency.ts.

export const EXCHANGE_RATES: Record<string, number> = {
  ZAR: 1,
  NGN: 85,
  KES: 7.93,
  ZMW: 1.15,
  MZN: 3.91,
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  ZA: "ZAR",
  NG: "NGN",
  KE: "KES",
  ZM: "ZMW",
  MZ: "MZN",
};

const SYMBOLS: Record<string, string> = {
  ZAR: "R",
  NGN: "₦",
  KES: "KES ",
  ZMW: "ZMW ",
  MZN: "MZN ",
};

export function getCurrencyCodeByCountry(countryCode: string): string {
  return COUNTRY_TO_CURRENCY[(countryCode || "").toUpperCase()] ?? "ZAR";
}

/** Convert a ZAR amount into the member's local currency and format it. */
export function formatCurrencyForMember(amountZar: number, countryCode: string): string {
  const code = getCurrencyCodeByCountry(countryCode);
  const rate = EXCHANGE_RATES[code] ?? 1;
  const local = Math.round(amountZar * rate);
  const symbol = SYMBOLS[code] ?? "";
  return `${symbol}${local.toLocaleString("en-US")}`;
}

/** Look up a member's country_code (defaults to ZA). */
export async function fetchMemberCountry(
  sb: { from: (t: string) => any },
  memberId: string,
): Promise<string> {
  try {
    const { data } = await sb
      .from("members")
      .select("country_code")
      .eq("id", memberId)
      .maybeSingle();
    return (data?.country_code as string) || "ZA";
  } catch {
    return "ZA";
  }
}
