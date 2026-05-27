import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  ShoppingCart,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/umoja/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePaystack, buildReference } from "@/hooks/usePaystack";
import { toast } from "sonner";

interface Tier {
  id: string;
  title: string;
  sparks: number;
  bonus: number;
  priceZar: number;
  rate: string;
  best: string;
  savingsPct?: number;
  badge?: string;
  highlight?: boolean;
}

const TIERS: Tier[] = [
  { id: "entry", title: "Spark Pack", sparks: 50, bonus: 0, priceZar: 99, rate: "R1.98/spark", best: "Try the games" },
  { id: "bundle", title: "Spark Bundle", sparks: 200, bonus: 0, priceZar: 349, rate: "R1.75/spark", savingsPct: 12, best: "Regular players" },
  { id: "power", title: "Spark Power", sparks: 500, bonus: 0, priceZar: 799, rate: "R1.60/spark", savingsPct: 19, best: "Serious players" },
  { id: "vip", title: "Spark VIP", sparks: 1200, bonus: 0, priceZar: 1799, rate: "R1.50/spark", savingsPct: 24, best: "VIP members" },
  { id: "mega", title: "Spark Mega", sparks: 2500, bonus: 250, priceZar: 3499, rate: "R1.40/spark + 10% bonus", savingsPct: 30, badge: "SAVE 20% + BONUS", best: "Serious whales", highlight: true },
];

export default function BuySparks() {
  const navigate = useNavigate();
  const { user, member } = useAuth();
  const { pay, ready } = usePaystack();
  const [selectedId, setSelectedId] = useState<string>("bundle");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => TIERS.find((t) => t.id === selectedId) ?? TIERS[0], [selectedId]);

  useEffect(() => {
    document.title = "Buy Sparks | UMOJA";
    if (member?.email) setEmail(member.email);
    if ((member as any)?.phone) setPhone((member as any).phone);
  }, [member]);

  const handleBuy = async () => {
    if (!user) {
      toast.error("Please sign in to buy Sparks");
      navigate("/login?next=/buy-sparks");
      return;
    }
    const e = email.trim().toLowerCase();
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e)) {
      toast.error("Enter a valid email"); return;
    }
    if (!/^\+?\d[\d\s-]{6,}$/.test(phone.trim())) {
      toast.error("Enter a valid phone number"); return;
    }
    if (!ready) { toast.error("Payment system loading…"); return; }

    setBusy(true);
    try {
      const ref = buildReference("ST", selected.id, member?.id?.slice(0, 8) ?? "USR");
      const res = await pay({
        email: e,
        amountZar: selected.priceZar,
        reference: ref,
        metadata: {
          purpose: "spark_purchase",
          tier: selected.id,
          sparks: selected.sparks,
          bonus: selected.bonus,
          member_id: user.id,
        },
      });

      if (!res.ok || !res.reference) return;

      // Credit sparks via RPC (idempotent)
      const { data, error } = await supabase.rpc("apply_spark_purchase", {
        _member: user.id,
        _sparks: selected.sparks,
        _bonus: selected.bonus,
        _amount_paid: selected.priceZar,
        _reference: res.reference,
        _email: e,
        _phone: phone.trim(),
        _tier: selected.id,
      });

      if (error) {
        toast.error("Sparks pending", { description: "Payment received — credit will appear shortly. Ref: " + res.reference });
        return;
      }

      toast.success(`✨ ${selected.sparks + selected.bonus} Sparks added!`, {
        description: "Play now →",
      });
      setTimeout(() => navigate("/spark-pit"), 900);
      void data;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen pb-32 bg-gradient-to-b from-background via-purple-950/5 to-background">
      <header className="px-5 pt-6 pb-2 flex items-center gap-3">
        <Link to="/spark-pit" className="grid h-9 w-9 place-items-center rounded-full bg-card border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Spark Marketplace</h1>
      </header>

      {/* Hero */}
      <section className="px-5 pt-4 text-center">
        <div className="mx-auto max-w-xl rounded-3xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-amber-500 p-8 text-white shadow-xl">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
            Unlock the Games — Buy Sparks
          </h2>
          <p className="mt-2 text-sm sm:text-base text-white/85">
            Play harder games, boost your position, or just have fun.
          </p>
        </div>
      </section>

      {/* Pricing tiers */}
      <section className="px-5 pt-6">
        <h3 className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Choose your pack
        </h3>
        <div className="mx-auto grid max-w-5xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TIERS.map((t) => {
            const isSelected = selectedId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`text-left rounded-2xl border-2 p-5 transition-all relative overflow-hidden ${
                  isSelected
                    ? "border-purple-500 bg-purple-500/5 shadow-lg scale-[1.02]"
                    : "border-border bg-card hover:border-purple-400/50 hover:shadow-md"
                } ${t.highlight ? "ring-2 ring-amber-400/50" : ""}`}
              >
                {t.badge && (
                  <span className="absolute top-2 right-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                    {t.badge}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-semibold">{t.title}</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold">{t.sparks.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">Sparks</span>
                  {t.bonus > 0 && (
                    <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      +{t.bonus} BONUS
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    R{t.priceZar.toLocaleString()}
                  </span>
                  {t.savingsPct && (
                    <span className="text-[11px] font-semibold text-emerald-600">
                      Save {t.savingsPct}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.rate}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  <span className="font-medium">Best for:</span> {t.best}
                </p>
                <div
                  className={`mt-4 w-full rounded-xl py-2 text-center text-sm font-semibold ${
                    isSelected
                      ? "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white"
                      : "bg-foreground/5 text-foreground"
                  }`}
                >
                  {isSelected ? "✓ Selected" : t.badge ? "Buy Now — LIMITED" : "Select"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 pt-10">
        <div className="mx-auto max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { Icon: ShoppingCart, title: "1. Choose Sparks", desc: "Pick your pack above" },
            { Icon: CreditCard, title: "2. Pay with Card", desc: "Secure via Paystack" },
            { Icon: CheckCircle2, title: "3. Play Instantly", desc: "Sparks land in seconds" },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Payment form */}
      <section className="px-5 pt-10">
        <Card className="mx-auto max-w-md p-6">
          <h3 className="text-lg font-bold">Complete your purchase</h3>
          <p className="text-xs text-muted-foreground mb-4">
            You selected <span className="font-semibold text-foreground">{selected.title}</span> —{" "}
            {selected.sparks + selected.bonus} Sparks for R{selected.priceZar}
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bs-email" className="text-xs">Email</Label>
              <Input id="bs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="bs-phone" className="text-xs">Phone number</Label>
              <Input id="bs-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 ..." />
            </div>
            <div className="rounded-xl bg-foreground/5 p-3 text-xs">
              <div className="flex justify-between"><span>Pack</span><span className="font-medium">{selected.title}</span></div>
              <div className="flex justify-between"><span>Sparks</span><span className="font-medium">{selected.sparks}{selected.bonus > 0 ? ` + ${selected.bonus} bonus` : ""}</span></div>
              <div className="flex justify-between text-base font-bold pt-1 border-t border-border mt-2"><span>Total</span><span>R{selected.priceZar}</span></div>
            </div>
            <Button onClick={handleBuy} disabled={busy || !ready} className="w-full h-12 bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white font-bold hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Pay R{selected.priceZar} with Paystack</>}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">By purchasing you agree to our Terms. Sparks are non-refundable.</p>
          </div>
        </Card>
      </section>

      {/* Trust badges */}
      <section className="px-5 pt-8">
        <div className="mx-auto max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Secure via Paystack
          </div>
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Instant delivery
          </div>
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" /> Play in seconds
          </div>
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
