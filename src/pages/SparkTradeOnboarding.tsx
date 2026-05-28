import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Sparkles, Truck, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useMyCountry } from "@/hooks/useCountryConfig";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

type Tier = "buyers_club" | "storefront" | "fulfilled_by_umoja";

export default function SparkTradeOnboarding() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { config } = useMyCountry();
  const [step, setStep] = useState(1);
  const [tier, setTier] = useState<Tier | null>(null);

  // step 1
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const slug = useMemo(() => slugify(name || ""), [name]);
  const [savingSf, setSavingSf] = useState(false);

  // step 2
  const [zone, setZone] = useState(config.country_name);
  const [estLoading, setEstLoading] = useState(false);
  const [estimate, setEstimate] = useState<{
    total_per_unit: number; base_rate?: number; weight_surcharge?: number; handling_fee?: number; fallback?: boolean;
  } | null>(null);

  // step 3
  const [prefs, setPrefs] = useState({
    auto_generate_listings: true,
    auto_social_posts: true,
    auto_email_campaigns: true,
    auto_optimize_pricing: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("product_memberships" as never)
        .select("tier")
        .eq("user_id", user.id)
        .eq("product", "spark_trade")
        .maybeSingle();
      setTier((data as { tier: Tier } | null)?.tier ?? null);
    })();
  }, [user]);

  useEffect(() => { setZone(config.country_name); }, [config.country_name]);

  const isFulfilled = tier === "fulfilled_by_umoja";

  const saveStorefront = async () => {
    if (!user) return;
    if (name.trim().length < 2) return toast.error("Storefront name required");
    setSavingSf(true);
    const { error } = await supabase.from("storefront_accounts" as never).upsert({
      user_id: user.id,
      name: name.trim(),
      slug,
      tagline: tagline.trim() || null,
      brand_color: color,
    }, { onConflict: "user_id" });
    setSavingSf(false);
    if (error) return toast.error(error.message);
    toast.success("Storefront created");
    setStep(isFulfilled ? 2 : 3);
  };

  const fetchEstimate = async () => {
    setEstLoading(true);
    const { data, error } = await supabase.functions.invoke("roboost-estimate-rate", {
      body: { origin_zone: zone, weight_kg: 0.5, quantity: 50 },
    });
    setEstLoading(false);
    if (error) return toast.error(error.message);
    setEstimate(data as typeof estimate);
  };

  const saveFulfillment = async () => {
    if (!user || !estimate) return;
    const { error } = await supabase.from("fulfillment_config" as never).upsert({
      user_id: user.id,
      roboost_zone: zone,
      estimated_cost_per_unit: estimate.total_per_unit,
      base_rate: estimate.base_rate ?? null,
      weight_surcharge: estimate.weight_surcharge ?? null,
      handling_fee: estimate.handling_fee ?? null,
      raw_response: estimate as unknown as object,
    }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    setStep(3);
  };

  const savePrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    const { error } = await supabase.from("ai_preferences" as never).upsert({
      user_id: user.id, ...prefs,
    }, { onConflict: "user_id" });
    setSavingPrefs(false);
    if (error) return toast.error(error.message);
    setStep(4);
  };

  const copyUrl = () => {
    const url = `https://sparktrade.com/store/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard");
  };

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/spark-trade/membership" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" /> Spark Trade onboarding
          </p>
          <div className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4].map((n) => {
              const visible = isFulfilled || n !== 2;
              return (
                <div key={n} className={`h-1 flex-1 rounded-full ${!visible ? "opacity-30" : ""} ${step >= n ? "bg-gradient-gold" : "bg-secondary"}`} />
              );
            })}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="mt-6 space-y-4">
              <h1 className="font-display text-2xl">Set up your Spark Trade Storefront</h1>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Storefront name</Label>
                <Input
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-2xl bg-secondary/60 border-border"
                  placeholder="Samuel's Electronics"
                />
                {slug && (
                  <p className="text-[11px] text-muted-foreground">
                    URL: <span className="text-accent">https://sparktrade.com/store/{slug}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tagline (optional)</Label>
                <Input
                  value={tagline} onChange={(e) => setTagline(e.target.value)}
                  className="h-11 rounded-2xl bg-secondary/60 border-border"
                  placeholder="Premium wholesale deals"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Brand colour</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color" value={color} onChange={(e) => setColor(e.target.value)}
                    className="h-11 w-16 cursor-pointer rounded-2xl border border-border bg-secondary/60"
                  />
                  <span className="text-sm text-muted-foreground">{color}</span>
                </div>
              </div>
              <Button onClick={saveStorefront} disabled={savingSf} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                {savingSf ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Create Storefront <ArrowRight className="ml-1 h-4 w-4" /></>)}
              </Button>
            </div>
          )}

          {/* STEP 2 — Fulfilled tier only */}
          {step === 2 && isFulfilled && (
            <div className="mt-6 space-y-4">
              <h1 className="font-display text-2xl flex items-center gap-2">
                <Truck className="h-5 w-5 text-accent" /> Confirm your fulfilment zone
              </h1>
              <p className="text-sm text-muted-foreground">You're in <span className="text-foreground">{config.country_name}</span></p>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fulfilment zone</Label>
                <Input
                  value={zone} onChange={(e) => setZone(e.target.value)}
                  className="h-11 rounded-2xl bg-secondary/60 border-border"
                  placeholder="Johannesburg"
                />
              </div>
              <Button onClick={fetchEstimate} disabled={estLoading} variant="outline" className="w-full rounded-2xl">
                {estLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate Roboost rate"}
              </Button>
              {estimate && (
                <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm space-y-2">
                  <p className="font-display text-lg text-gradient-gold">
                    R{Number(estimate.total_per_unit).toFixed(2)}/unit
                  </p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    {estimate.fallback ? "Estimated (Roboost unreachable)" : "Roboost calculated"}
                  </p>
                  <div className="text-xs space-y-1 mt-2">
                    {estimate.base_rate != null && <p>Base rate: R{Number(estimate.base_rate).toFixed(2)}</p>}
                    {estimate.weight_surcharge != null && <p>Weight surcharge: R{Number(estimate.weight_surcharge).toFixed(2)}</p>}
                    {estimate.handling_fee != null && <p>Handling: R{Number(estimate.handling_fee).toFixed(2)}</p>}
                  </div>
                  <div className="mt-3 rounded-xl bg-background/40 p-3 text-[11px] leading-relaxed">
                    <p className="uppercase tracking-wider text-accent text-[10px] mb-1">Profit breakdown</p>
                    <p>You buy: R45 · You sell: R180</p>
                    <p>UMOJA takes: 30% (R54, incl. R{Number(estimate.total_per_unit).toFixed(0)} shipping)</p>
                    <p>You keep: 70% (R126) · Profit: R81/unit</p>
                    <p className="mt-1 text-foreground/90">50 units = ~R4,050 profit — we handle shipping & returns.</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={saveFulfillment} disabled={!estimate} className="flex-1 h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                  Confirm Location <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <Button onClick={() => setStep(3)} variant="outline" className="h-12 rounded-2xl">Adjust Later</Button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="mt-6 space-y-4">
              <h1 className="font-display text-2xl flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-accent" /> Configure AI Marketing
              </h1>
              <p className="text-sm text-muted-foreground">We'll promote your products 24/7.</p>
              <ul className="rounded-2xl glass p-4 space-y-3 text-sm">
                {[
                  ["auto_generate_listings", "Auto-generate product listings"],
                  ["auto_social_posts", "Auto-create social posts (WhatsApp, Instagram, TikTok)"],
                  ["auto_email_campaigns", "Auto-send email campaigns"],
                  ["auto_optimize_pricing", "Auto-optimise pricing"],
                ].map(([key, label]) => (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span>{label}</span>
                    <Switch
                      checked={prefs[key as keyof typeof prefs]}
                      onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                    />
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button onClick={savePrefs} disabled={savingPrefs} className="flex-1 h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                  {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable Marketing"}
                </Button>
                <Button onClick={() => setStep(4)} variant="outline" className="h-12 rounded-2xl">Configure Later</Button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="mt-6 space-y-4 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-gold text-primary-foreground">
                <Check className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl">Your Spark Trade Storefront is Ready 🎉</h1>
              <p className="text-sm text-muted-foreground break-all">
                Storefront URL: <span className="text-accent">https://sparktrade.com/store/{slug}</span>
              </p>
              <div className="rounded-2xl glass p-4 text-left text-sm space-y-2">
                <p className="uppercase tracking-wider text-[10px] text-accent">Next steps</p>
                <ul className="space-y-1 text-foreground/90 text-xs">
                  <li>• Buy products from Buyers Club</li>
                  <li>• They auto-appear on your storefront</li>
                  <li>• AI handles marketing</li>
                  <li>• Customers buy from your store</li>
                  <li>• You get paid every Friday</li>
                </ul>
                <p className="text-xs text-muted-foreground pt-2">
                  {isFulfilled
                    ? "UMOJA ships everything. You focus on sales."
                    : "You ship directly. AI handles marketing."}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => nav("/dashboard")} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                  Go to Dashboard
                </Button>
                <Button onClick={copyUrl} variant="outline" className="w-full h-11 rounded-2xl">
                  <Copy className="h-4 w-4 mr-1" /> Share Storefront URL
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
