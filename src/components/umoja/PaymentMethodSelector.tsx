import { CreditCard, Landmark, Coins } from "lucide-react";

export type PaymentMethod = "paystack" | "eft" | "usdt";

export function PaymentMethodSelector({
  value,
  onChange,
  cryptoEnabled = false,
  paystackEnabled = true,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  cryptoEnabled?: boolean;
  paystackEnabled?: boolean;
}) {
  const opts: Array<{
    id: PaymentMethod;
    title: string;
    desc: string;
    icon: typeof CreditCard;
    badge?: string;
    hidden?: boolean;
  }> = [
    {
      id: "paystack",
      title: "Card Payment",
      desc: "Process instantly via Paystack — no waiting for approval.",
      icon: CreditCard,
      badge: "Instant · Recommended",
      hidden: !paystackEnabled,
    },
    {
      id: "eft",
      title: "Bank Transfer (EFT)",
      desc: "Manual transfer + proof upload. Admin approval (1–2 days).",
      icon: Landmark,
    },
    {
      id: "usdt",
      title: "Cryptocurrency (USDT)",
      desc: "Pay in USDT on Tron (TRC20). Instant settlement, low fees.",
      icon: Coins,
      badge: "Instant · TRC20",
      hidden: !cryptoEnabled,
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Choose payment method</p>
      <div className="grid gap-2">
        {opts.filter((o) => !o.hidden).map((o) => {
          const active = value === o.id;
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`text-left rounded-2xl border p-3 transition-smooth ${
                active
                  ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                  : "border-border bg-secondary/40 hover:border-accent/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${active ? "bg-accent/20 text-accent" : "bg-secondary text-foreground/70"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{o.title}</p>
                    {o.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent uppercase tracking-wider">
                        {o.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                </div>
                <div className={`mt-1 h-4 w-4 rounded-full border-2 ${active ? "border-accent bg-accent" : "border-border"}`} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
