import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, BookOpen, Lightbulb, Rocket, Star, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { usePaystack, buildReference } from "@/hooks/usePaystack";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyCountry } from "@/hooks/useCountryConfig";
import { formatCurrency, getCurrencyCode, exchangeRates } from "@/lib/currency";

/** Show "(Equivalent: ₦42,415)" next to a SA anchor price for non-ZA members. */
function equiv(zar: number, countryCode: string): string {
  const cc = (countryCode || "ZA").toUpperCase();
  if (cc === "ZA") return "";
  const code = getCurrencyCode(cc);
  const rate = exchangeRates[code] ?? 1;
  return ` (Equivalent: ${formatCurrency(zar * rate, code)})`;
}

type Period = "monthly" | "annual";
type TierKey = "basic" | "pro" | "fulfilled";

interface TierDef {
  key: TierKey;
  name: string;
  monthly: number;
  annual: number;
  monthlyValue: number;
  annualSavings: number;
  highlight?: string;
  features: string[];
  extras: string[];
  cta?: string;
}

const TIERS: TierDef[] = [
  {
    key: "basic",
    name: "Spark Trade Basic",
    monthly: 499,
    annual: 4992,
    monthlyValue: 998,
    annualSavings: 1500,
    features: [
      "Weekly product list",
      "Buying group access",
      "Free course included",
      "Community support",
    ],
    extras: [],
  },
  {
    key: "pro",
    name: "Spark Trade Pro",
    monthly: 999,
    annual: 9990,
    monthlyValue: 1998,
    annualSavings: 3000,
    highlight: "MOST POPULAR",
    features: [
      "Real-time alerts",
      "90-day forecasting",
      "Finzite dashboard",
      "Priority support",
    ],
    extras: ["Everything in Basic"],
    cta: "Most popular choice",
  },
  {
    key: "fulfilled",
    name: "Fulfilled by UMOJA",
    monthly: 1999,
    annual: 19990,
    monthlyValue: 3998,
    annualSavings: 6000,
    features: [
      "We warehouse items",
      "We list on platforms",
      "We handle shipping",
      "We manage returns",
      "White-label option",
    ],
    extras: ["Everything in Pro"],
    cta: "Enterprise solution",
  },
];

const COMPARISON: { label: string; basic: boolean; pro: boolean; full: boolean }[] = [
  { label: "Weekly product list", basic: true, pro: true, full: true },
  { label: "Buying group access", basic: true, pro: true, full: true },
  { label: "Free course (90 min)", basic: true, pro: true, full: true },
  { label: "Real-time alerts", basic: false, pro: true, full: true },
  { label: "90-day forecasting", basic: false, pro: true, full: true },
  { label: "Finzite dashboard", basic: false, pro: true, full: true },
  { label: "Warehousing service", basic: false, pro: false, full: true },
  { label: "Listing service", basic: false, pro: false, full: true },
  { label: "Fulfillment service", basic: false, pro: false, full: true },
  { label: "Priority support", basic: false, pro: true, full: true },
];

const buildFaqs = (cc: string): { q: string; a: string }[] => {
  const code = getCurrencyCode(cc);
  const rate = exchangeRates[code] ?? 1;
  const isZA = (cc || "ZA").toUpperCase() === "ZA";
  const range = isZA
    ? ""
    : ` (Equivalent: ${formatCurrency(499 * rate, code)}–${formatCurrency(1999 * rate, code)})`;
  return [
    {
      q: "Do I really get 2 months free?",
      a: `Yes! You pay R499–R1,999${range} this month, then get next month completely free. After that, your subscription continues monthly (or annually if you chose annual).`,
    },
    {
      q: "Can I change tiers later?",
      a: "Yes! Upgrade or downgrade anytime. Changes take effect next billing cycle.",
    },
    {
      q: "What if I want to cancel?",
      a: "You can cancel anytime. No lock-in period. But you'll lose access after your current billing period ends.",
    },
    {
      q: "Is the course really free?",
      a: `Yes! Included with every tier. Worth R1,499${equiv(1499, cc)} if purchased separately. Covers Takealot, Amazon SA, Makro setup (90 minutes).`,
    },
    {
      q: "When does the price increase?",
      a: "After 100 founding members, pricing increases 20%. Early birds lock in current pricing for life if they stay subscribed.",
    },
  ];
};

function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export default function SparkTradeBeta() {
  const { user } = useAuth();
  const { config: country } = useMyCountry();
  const cc = country.country_code;
  const faqs = useMemo(() => buildFaqs(cc), [cc]);
  const { pay, ready } = usePaystack();
  const pricingRef = useRef<HTMLDivElement>(null);

  const [period, setPeriod] = useState<Period>("monthly");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    tier: "pro" as TierKey,
    billing: "monthly" as Period,
    accept: false,
  });

  useEffect(() => {
    document.title = "Spark Trade Beta — Pay Once, Get 2 Months Free | UMOJA";
    const desc = "Spark Trade beta early access: weekly product lists, real-time alerts, 90-day forecasting, and a free 90-min course. Only 100 founding spots.";
    let m = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!m) {
      m = document.createElement("meta");
      m.name = "description";
      document.head.appendChild(m);
    }
    m.content = desc;
  }, []);

  useEffect(() => {
    if (user?.email && !form.email) {
      setForm((f) => ({ ...f, email: user.email || "" }));
    }
  }, [user, form.email]);

  const scrollToPricing = () => pricingRef.current?.scrollIntoView({ behavior: "smooth" });

  const openCheckout = (tier: TierKey, billing: Period) => {
    setForm((f) => ({ ...f, tier, billing }));
    setOpen(true);
  };

  const selectedTier = useMemo(() => TIERS.find((t) => t.key === form.tier)!, [form.tier]);
  const amount = form.billing === "annual" ? selectedTier.annual : selectedTier.monthly;

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Please enter your full name");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return toast.error("Please enter a valid email");
    if (!form.whatsapp.trim()) return toast.error("Please enter your WhatsApp number");
    if (!form.accept) return toast.error("Please accept the Terms of Service");
    if (!ready) return toast.error("Payment system loading, try again in a moment");

    setSubmitting(true);
    try {
      const ref = buildReference("ST", `${form.tier}${form.billing[0].toUpperCase()}`, (user?.id ?? "GUEST").slice(0, 12));
      const result = await pay({
        email: form.email.trim().toLowerCase(),
        amountZar: amount,
        reference: ref,
        metadata: {
          payment_type: "spark_trade",
          tier: form.tier,
          billing_period: form.billing,
        },
      });
      if (!result.ok) {
        setSubmitting(false);
        return;
      }
      const now = new Date();
      const end = form.billing === "annual" ? addMonths(now, 12) : addMonths(now, 2);
      const { error } = await supabase.from("spark_trade_subscriptions").insert({
        user_id: user?.id ?? null,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp.trim(),
        tier: form.tier,
        billing_period: form.billing,
        amount_paid: amount,
        payment_reference: result.reference ?? ref,
        access_start_date: now.toISOString().slice(0, 10),
        access_end_date: end.toISOString().slice(0, 10),
        status: "active",
      });
      if (error) {
        console.error("[spark-trade-beta] insert error", error);
        toast.warning("Payment received — we'll activate access shortly", {
          description: `Ref: ${result.reference}`,
        });
      } else {
        toast.success("You're in! Check your email for the course link.");
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #0EA5E9 0%, #1E40AF 100%)" }}
          aria-hidden
        />
        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-28 text-center text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Paid Early Access — Beta launches today
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Stop guessing what to sell.<br />Start selling what people are buying.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
            Spark Trade gives you weekly winning products, real-time pricing intelligence,
            and a free course — so you can build a profitable online store from day one.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={scrollToPricing}
              className="text-base font-semibold px-8"
              style={{ backgroundColor: "#F59E0B", color: "#0b1220" }}
            >
              Get Started Now
            </Button>
            <span className="text-white/80 text-sm">Pay once · Get 2 months free</span>
          </div>
          <div className="mt-10 grid sm:grid-cols-3 gap-3 text-sm text-white/95 max-w-3xl mx-auto">
            {[
              "Only 100 founding spots",
              "Free 90-min course included",
              "Cancel anytime, no lock-in",
            ].map((t) => (
              <div key={t} className="flex items-center justify-center gap-2">
                <Check className="h-4 w-4" /> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VALUE PROP */}
      <section className="py-16 px-4 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: BookOpen, title: "Free Course Included", text: "Learn Takealot, Amazon SA, Makro setup (90 minutes)", value: "Worth R1,499" },
            { icon: Lightbulb, title: "Real Intelligence", text: "Know what's selling, at what price, with what margins", value: "Worth R5,000+ in research" },
            { icon: Rocket, title: "First-Mover Advantage", text: "Only 100 beta spots. Join before public launch.", value: "Lifetime early-access pricing" },
          ].map(({ icon: Icon, title, text, value }) => (
            <Card key={title} className="p-6">
              <Icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{text}</p>
              <p className="text-sm font-medium mt-3" style={{ color: "#0EA5E9" }}>{value}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section ref={pricingRef} className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold">Choose your plan</h2>
            <p className="text-muted-foreground mt-2">Founding-member pricing — locked in for life if you stay subscribed.</p>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="annual">Annual · Save 3 months</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="monthly">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold">Pay Once, Get 2 Months Free</h3>
                <p className="text-sm text-muted-foreground">Pay this month, access next 2 months free</p>
              </div>
              <PricingGrid tiers={TIERS} period="monthly" onBuy={openCheckout} />
            </TabsContent>

            <TabsContent value="annual">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold">Save 3 Months Worth</h3>
                <p className="text-sm text-muted-foreground">Pay for 9 months, get 3 months completely free</p>
              </div>
              <PricingGrid tiers={TIERS} period="annual" onBuy={openCheckout} />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* WHY NOW */}
      <section className="py-16 px-4 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold">Why This Pricing Now?</h2>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          Spark Trade is new to South Africa. We're offering founding-member pricing to 100 early
          adopters. After that, pricing increases 20%.
        </p>
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          {[
            "100 beta spots only — then prices increase 20%",
            "This pricing locked in for life if you stay subscribed",
            "Free course (worth R1,499) included with every tier",
          ].map((t) => (
            <Card key={t} className="p-5 text-left">
              <Check className="h-5 w-5 mb-2" style={{ color: "#0EA5E9" }} />
              <p className="text-sm font-medium">{t}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* COMPARISON */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">What's included</h2>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Feature</th>
                  <th className="p-3 font-medium">Basic</th>
                  <th className="p-3 font-medium">Pro</th>
                  <th className="p-3 font-medium">Fulfilled</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? "bg-muted/20" : ""}>
                    <td className="p-3">{row.label}</td>
                    <td className="p-3 text-center">{row.basic ? <Check className="h-4 w-4 mx-auto text-primary" /> : <span className="text-muted-foreground/50">—</span>}</td>
                    <td className="p-3 text-center">{row.pro ? <Check className="h-4 w-4 mx-auto text-primary" /> : <span className="text-muted-foreground/50">—</span>}</td>
                    <td className="p-3 text-center">{row.full ? <Check className="h-4 w-4 mx-auto text-primary" /> : <span className="text-muted-foreground/50">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Frequently asked</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`q-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CLOSING CTA */}
      <section className="py-20 px-4 text-center text-white" style={{ background: "linear-gradient(135deg, #0EA5E9 0%, #1E40AF 100%)" }}>
        <h2 className="text-3xl md:text-4xl font-bold">Stop guessing. Start winning.</h2>
        <p className="mt-3 text-white/90">Join 100 early founders building wealth with data.</p>
        <Button
          size="lg"
          onClick={scrollToPricing}
          className="mt-6 font-semibold px-8"
          style={{ backgroundColor: "#F59E0B", color: "#0b1220" }}
        >
          Choose Your Plan
        </Button>
        <p className="mt-6 text-xs text-white/70">
          By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> &{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </section>

      {/* CHECKOUT MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Your Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="st-name">Full Name</Label>
              <Input id="st-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            </div>
            <div>
              <Label htmlFor="st-email">Email</Label>
              <Input id="st-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="st-wa">WhatsApp Number</Label>
              <Input id="st-wa" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+27 …" />
            </div>
            <div>
              <Label>Select Tier</Label>
              <RadioGroup
                value={`${form.tier}-${form.billing}`}
                onValueChange={(v) => {
                  const [tier, billing] = v.split("-") as [TierKey, Period];
                  setForm({ ...form, tier, billing });
                }}
                className="mt-2 space-y-2"
              >
                {(["monthly", "annual"] as Period[]).flatMap((b) =>
                  TIERS.map((t) => {
                    const id = `${t.key}-${b}`;
                    const amt = b === "annual" ? t.annual : t.monthly;
                    return (
                      <label key={id} htmlFor={id} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                        <RadioGroupItem id={id} value={id} />
                        <span className="text-sm flex-1">
                          {t.name.replace("Spark Trade ", "")} {b === "annual" ? "Annual" : "Monthly"}
                        </span>
                        <span className="text-sm font-semibold">R{amt.toLocaleString()}</span>
                      </label>
                    );
                  })
                )}
              </RadioGroup>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={form.accept} onCheckedChange={(v) => setForm({ ...form, accept: v === true })} className="mt-0.5" />
              <span>
                I agree to the <Link to="/terms" className="underline">Terms of Service</Link> and{" "}
                <Link to="/privacy" className="underline">Privacy Policy</Link>.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              onClick={submit}
              disabled={submitting}
              className="w-full font-semibold"
              style={{ backgroundColor: "#F59E0B", color: "#0b1220" }}
            >
              {submitting ? "Processing…" : `Pay R${amount.toLocaleString()} & Complete Order`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PricingGrid({
  tiers,
  period,
  onBuy,
}: {
  tiers: TierDef[];
  period: Period;
  onBuy: (tier: TierKey, period: Period) => void;
}) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {tiers.map((t) => {
        const price = period === "annual" ? t.annual : t.monthly;
        const isAnnual = period === "annual";
        const monthlyEq = Math.round(t.annual / 12);
        return (
          <Card
            key={t.key}
            className={`p-6 flex flex-col relative ${t.highlight ? "border-2" : ""}`}
            style={t.highlight ? { borderColor: "#F59E0B" } : undefined}
          >
            {t.highlight && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
                style={{ backgroundColor: "#F59E0B", color: "#0b1220" }}
              >
                <Star className="h-3 w-3" /> {isAnnual ? "BEST VALUE" : t.highlight}
              </div>
            )}
            <h3 className="text-lg font-semibold">{t.name}</h3>
            <div className="mt-4">
              <div className="text-4xl font-bold">R{price.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {isAnnual ? "Pay for 9 months · Get 3 free" : "Pay this month · Next month free"}
              </div>
            </div>
            <div className="mt-3 text-sm">
              <div>
                Total access: <strong>{isAnnual ? "12 months" : "2 months"}</strong>
              </div>
              {isAnnual ? (
                <>
                  <div>Monthly equivalent: <strong>R{monthlyEq.toLocaleString()}</strong></div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Savings: R{t.annualSavings.toLocaleString()}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">Value: R{t.monthlyValue.toLocaleString()}</div>
              )}
            </div>
            <ul className="mt-5 space-y-2 text-sm flex-1">
              {t.extras.map((e) => (
                <li key={e} className="font-medium">{e} +</li>
              ))}
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#0EA5E9" }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => onBuy(t.key, period)}
              className="mt-6 font-semibold"
              style={{ backgroundColor: "#F59E0B", color: "#0b1220" }}
            >
              Buy Now
            </Button>
            {t.cta && <p className="text-xs text-center text-muted-foreground mt-2">{t.cta}</p>}
          </Card>
        );
      })}
    </div>
  );
}
