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
import { formatTierPrice, calculateTierPrice, formatCurrency } from "@/lib/currency";

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

  const upgrade = async (tier: Tier) => {
    if (!user) return;
    setBusyTier(tier);
    const nextPayment = new Date();
    nextPayment.setMonth(nextPayment.getMonth() + 1);

    const { error } = await supabase
      .from("product_memberships" as any)
      .upsert({
        user_id: user.id,
        product: "spark_trade",
        tier,
        status: "active",
        membership_start_date: new Date().toISOString(),
        next_payment_date: nextPayment.toISOString(),
      }, { onConflict: "user_id,product" });

    setBusyTier(null);
    if (error) return toast.error(error.message);

    toast.success("Membership activated 🎉");
    setCurrent({
      tier, status: "active",
      membership_start_date: new Date().toISOString(),
      next_payment_date: nextPayment.toISOString(),
    });
    if (tier === "storefront" || tier === "fulfilled_by_umoja") {
      nav("/spark-trade/onboarding");
    }
  };

  const monthly = Number(config.monthly_price ?? 999);
  const sym = config.currency_symbol;
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
                {/* Card 1: Buyers Club */}
                <TierCard
                  icon={<Sparkles className="h-5 w-5" />}
                  title="Buyers Club"
                  badge="All countries"
                  priceLines={[formatTierPrice("buyers_club", config.currency_code) ?? "Coming soon"]}
                  features={[
                    "Buy wholesale with group",
                    "200+ vetted products",
                    "Real-time profit calculator",
                    "Weekly payouts",
                  ]}
                  cta={current?.tier === "buyers_club" ? "Active" : "Get Started"}
                  disabled={current?.tier === "buyers_club"}
                  busy={busyTier === "buyers_club"}
                  onClick={() => upgrade("buyers_club")}
                />

                {/* Card 2: Storefront */}
                <TierCard
                  icon={<Store className="h-5 w-5" />}
                  title="Storefront + Buyers Club"
                  badge="All countries"
                  highlight
                  priceLines={[formatTierPrice("storefront", config.currency_code) ?? "Coming soon"]}
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
                  cta={current?.tier === "storefront" ? "Active" : (current ? "Upgrade" : "Start Free Trial")}
                  disabled={current?.tier === "storefront"}
                  busy={busyTier === "storefront"}
                  onClick={() => upgrade("storefront")}
                />

                {/* Card 3: Fulfilled by UMOJA — SA only */}
                {isSA ? (
                  <TierCard
                    icon={<Truck className="h-5 w-5" />}
                    title="Fulfilled by UMOJA + Storefront + Club"
                    badge="South Africa only"
                    priceLines={[formatTierPrice("fulfilled", "ZAR")!]}
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
                    cta={current?.tier === "fulfilled_by_umoja" ? "Active" : "Upgrade to Fulfilled"}
                    disabled={current?.tier === "fulfilled_by_umoja"}
                    busy={busyTier === "fulfilled_by_umoja"}
                    onClick={() => upgrade("fulfilled_by_umoja")}
                  />
                )}
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
