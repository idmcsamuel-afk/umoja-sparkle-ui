import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Sparkles, Store, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { toast } from "sonner";
import { useMyCountry } from "@/hooks/useCountryConfig";
import { formatTierPrice, calculateTierPrice, formatCurrency, basePricesZAR } from "@/lib/currency";
import { usePaystack, buildReference } from "@/hooks/usePaystack";

// Paystack merchant account only supports ZAR — all charges are in ZAR.
// Users see local-currency equivalent for transparency only.

type Tier = "buyers_club" | "storefront" | "fulfilled_by_umoja";

type Membership = {
  tier: Tier;
  status: string;
  membership_start_date: string;
  next_payment_date: string | null;
};

export default function SparkTradeMembership() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { config, loading: countryLoading } = useMyCountry();
  const { pay, ready: paystackReady } = usePaystack();
  const [current, setCurrent] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTier, setBusyTier] = useState<Tier | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("product_memberships" as any)
        .select("tier, status, membership_start_date, next_payment_date")
        .eq("user_id", user.id)
        .eq("product", "spark_trade")
        .maybeSingle();
      setCurrent(data as unknown as Membership | null);
      setLoading(false);
    })();
  }, [user]);

  const tierKeyMap: Record<Tier, keyof typeof basePricesZAR> = {
    buyers_club: "buyers_club",
    storefront: "storefront",
    fulfilled_by_umoja: "fulfilled",
  };

  const activateMembership = async (
    tier: Tier,
    reference: string,
    amountZar: number,
    amountLocal: number,
    localCurrency: string,
  ) => {
    const nextPayment = new Date();
    nextPayment.setMonth(nextPayment.getMonth() + 1);
    const { error } = await supabase
      .from("product_memberships" as any)
      .upsert({
        user_id: user!.id,
        product: "spark_trade",
        tier,
        status: "active",
        membership_start_date: new Date().toISOString(),
        next_payment_date: nextPayment.toISOString(),
        paystack_reference: reference,
        payment_status: "success",
        amount_paid_zar: amountZar,
        amount_local_currency: amountLocal,
        local_currency_code: localCurrency,
      }, { onConflict: "user_id,product" });
    if (error) {
      toast.error(error.message);
      return false;
    }
    setCurrent({
      tier, status: "active",
      membership_start_date: new Date().toISOString(),
      next_payment_date: nextPayment.toISOString(),
    });
    return true;
  };

  const upgrade = async (tier: Tier) => {
    if (!user) return;
    if (!user.email) {
      toast.error("Add an email to your account before paying");
      return;
    }
    if (!paystackReady) {
      toast.error("Payment gateway loading… try again in a moment");
      return;
    }
    setBusyTier(tier);

    // Always charge in ZAR — Paystack merchant only supports ZAR.
    const localCcy = config.currency_code;
    const tierKey = tierKeyMap[tier];
    const amountZar = calculateTierPrice(tierKey, "ZAR");
    const amountLocal = calculateTierPrice(tierKey, localCcy) ?? amountZar ?? 0;
    if (amountZar == null || amountZar <= 0) {
      setBusyTier(null);
      toast.error("Could not determine price");
      return;
    }

    const memberCode = (user.id || "U").replace(/-/g, "").slice(0, 10).toUpperCase();
    const reference = buildReference("ST", tier.toUpperCase(), memberCode);

    if (localCcy !== "ZAR") {
      toast.message(`Charging R${amountZar} ZAR for ${formatCurrency(amountLocal, localCcy)} of service`);
    }

    const result = await pay({
      email: user.email,
      amountZar,
      currency: "ZAR",
      reference,
      metadata: {
        payment_type: "spark_trade_membership",
        member_id: user.id,
        tier,
        product: "spark_trade",
        amount_local_currency: amountLocal,
        local_currency_code: localCcy,
      },
    });

    setBusyTier(null);

    if (!result.ok) return;
    const ok = await activateMembership(tier, result.reference || reference, amountZar, amountLocal, localCcy);
    if (!ok) return;
    toast.success("Membership activated 🎉");
    if (tier === "storefront" || tier === "fulfilled_by_umoja") {
      nav("/spark-trade/onboarding");
    }
  };

  const tierRank: Record<Tier, number> = { buyers_club: 1, storefront: 2, fulfilled_by_umoja: 3 };
  const currentRank = current ? tierRank[current.tier] : 0;
  const showTier = (t: Tier) => currentRank === 0 || tierRank[t] > currentRank || current?.tier === t;

  const cancelMembership = async () => {
    if (!user || !current) return;
    if (!confirm("Cancel your membership? You will lose access at the end of the current billing period.")) return;
    const { error } = await supabase
      .from("product_memberships" as any)
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("product", "spark_trade");
    if (error) { toast.error(error.message); return; }
    toast.success("Membership cancelled");
    setCurrent(null);
  };

  // pricing comes from src/lib/currency (ZAR base * exchange rate)
  const isSA = config.country_code === "ZA";
  const tierLabel: Record<Tier, string> = {
    buyers_club: "Buyers Club",
    storefront: "Storefront + Buyers Club",
    fulfilled_by_umoja: "Fulfilled by UMOJA",
  };

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/spark" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" /> Spark Trade
          </p>
          <h1 className="mt-2 font-display text-[32px] leading-tight tracking-tight">
            Membership Tiers
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose how you want to earn with Spark Trade. Prices in {config.currency_code}.
          </p>

          {loading || countryLoading ? (
            <div className="mt-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <>
              {current && (
                <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4">
                  <p className="text-xs text-muted-foreground">You are on</p>
                  <p className="font-display text-lg text-gradient-gold">{tierLabel[current.tier]}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Started {new Date(current.membership_start_date).toLocaleDateString()}
                    {current.next_payment_date ? ` · Next payment ${new Date(current.next_payment_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
              )}

              <div className="mt-6 space-y-4">
                {(() => {
                  const localCcy = config.currency_code;
                  const zarNote = (tierKey: keyof typeof basePricesZAR) => {
                    const zar = calculateTierPrice(tierKey, "ZAR")!;
                    return localCcy === "ZAR" ? "Paystack accepts ZAR only" : `Pay R${zar} ZAR at checkout`;
                  };
                  const priceLinesFor = (tierKey: keyof typeof basePricesZAR, ccy: string) => [
                    formatTierPrice(tierKey, ccy) ?? "Coming soon",
                    zarNote(tierKey),
                  ];
                  const bcPrice = formatTierPrice("buyers_club", localCcy);
                  const sfPrice = formatTierPrice("storefront", localCcy);
                  const fulPrice = formatTierPrice("fulfilled", "ZAR");
                  const ctaFor = (tier: Tier, label: string, price: string | null) =>
                    current?.tier === tier ? "Active" : price ? `${label} — ${price}` : label;
                  return (
                    <>
                      <TierCard
                        icon={<Sparkles className="h-5 w-5" />}
                        title="Buyers Club"
                        badge="All countries"
                        priceLines={priceLinesFor("buyers_club", localCcy)}
                        features={[
                          "Buy wholesale with group",
                          "200+ vetted products",
                          "Real-time profit calculator",
                          "Weekly payouts",
                        ]}
                        cta={ctaFor("buyers_club", current ? "Switch to Buyers Club" : "Join Buyers Club", bcPrice)}
                        disabled={current?.tier === "buyers_club"}
                        busy={busyTier === "buyers_club"}
                        onClick={() => upgrade("buyers_club")}
                      />

                      <TierCard
                        icon={<Store className="h-5 w-5" />}
                        title="Storefront + Buyers Club"
                        badge="All countries"
                        highlight
                        priceLines={priceLinesFor("storefront", localCcy)}
                        features={[
                          "Everything in Buyers Club",
                          "AI-powered personal storefront",
                          "Auto-load products you buy",
                          "AI generates listings",
                          "AI auto-markets (social, email, WhatsApp)",
                          "88% payout on sales (sliding 12–8% commission)",
                          "Weekly payouts",
                          "You ship directly (no fulfilment by us yet)",
                        ]}
                        profitExample={(() => {
                          const buy = calculateTierPrice("buyers_club", config.currency_code);
                          const unit = Math.round((buy ?? 499) * 0.09);
                          const sell = unit * 4;
                          const rev = sell * 50;
                          const cost = unit * 50;
                          const cut = Math.round(rev * 0.88);
                          const profit = cut - cost;
                          const margin = Math.round((profit / rev) * 100);
                          return [
                            `Buy 50 units @ ${formatCurrency(unit, config.currency_code)} = ${formatCurrency(cost, config.currency_code)}`,
                            `Sell for ${formatCurrency(sell, config.currency_code)} each = ${formatCurrency(rev, config.currency_code)} revenue`,
                            `Your cut: 88% = ${formatCurrency(cut, config.currency_code)}`,
                            `Profit: ${formatCurrency(profit, config.currency_code)} (${margin}% margin)`,
                          ];
                        })()}
                        cta={ctaFor("storefront", "Upgrade to Storefront", sfPrice)}
                        disabled={current?.tier === "storefront"}
                        busy={busyTier === "storefront"}
                        onClick={() => upgrade("storefront")}
                      />

                      {isSA ? (
                        <TierCard
                          icon={<Truck className="h-5 w-5" />}
                          title="Fulfilled by UMOJA + Storefront + Club"
                          badge="South Africa only"
                          priceLines={priceLinesFor("fulfilled", "ZAR")}
                          features={[
                            "Everything in Storefront",
                            "UMOJA handles fulfilment (packing, courier, returns)",
                            "70% payout on sales (30% covers logistics)",
                            "Weekly payouts",
                            "Zero shipping work — we ship everything",
                            "Real-time customer tracking",
                            "Delivery photo proof",
                          ]}
                          profitExample={[
                            "Buy 50 units @ R45 = R2,250",
                            "Sell for R180 = R9,000 revenue",
                            "We take 30% (fulfilment) = R2,700",
                            "You keep 70% = R6,300",
                            "Your profit: R4,050 (45% margin) — we ship",
                          ]}
                          cta={ctaFor("fulfilled_by_umoja", "Upgrade to Fulfilled", fulPrice)}
                          disabled={current?.tier === "fulfilled_by_umoja"}
                          busy={busyTier === "fulfilled_by_umoja"}
                          onClick={() => upgrade("fulfilled_by_umoja")}
                        />
                      ) : (
                        <div className="rounded-3xl border border-dashed border-border bg-secondary/30 p-5 text-center">
                          <Truck className="mx-auto h-5 w-5 text-muted-foreground" />
                          <p className="mt-2 font-display text-base">Fulfilled by UMOJA</p>
                          <p className="text-xs text-muted-foreground">Available in SA only</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </section>
      <BottomNav />
    </main>
  );
}

function TierCard({
  icon, title, badge, priceLines, features, profitExample, cta, disabled, busy, onClick, highlight,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  priceLines: string[];
  features: string[];
  profitExample?: string[];
  cta: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <article className={`relative overflow-hidden rounded-3xl border ${highlight ? "border-accent/60 shadow-gold" : "border-border"} bg-gradient-card p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-secondary text-accent">{icon}</div>
          <div>
            <h3 className="font-display text-lg leading-tight">{title}</h3>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{badge}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {priceLines.map((p, i) => (
          <p key={i} className={i === 0 ? "font-display text-2xl text-gradient-gold" : "text-xs text-muted-foreground uppercase tracking-wider"}>
            {i === 1 && priceLines.length > 1 ? <span className="text-accent mr-2">OR</span> : null}{p}
          </p>
        ))}
      </div>

      <ul className="mt-4 space-y-1.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2 text-foreground/90">
            <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" /><span>{f}</span>
          </li>
        ))}
      </ul>

      {profitExample && (
        <div className="mt-4 rounded-2xl bg-secondary/40 p-3 text-[11px] leading-relaxed space-y-0.5">
          <p className="uppercase tracking-wider text-accent text-[10px] mb-1">Profit example</p>
          {profitExample.map((line, i) => (
            <p key={i} className="text-foreground/80">{line}</p>
          ))}
        </div>
      )}

      <Button
        onClick={onClick} disabled={disabled || busy}
        className="mt-5 w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : cta}
      </Button>
    </article>
  );
}
