import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calculator as CalcIcon, Loader2, TrendingUp, Sparkles, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface Tier {
  tier: string;
  min_entry: number;
  max_entry: number;
  growth_rate: number;
  vault_days: number;
  is_active: boolean | null;
}

const fmtR = (n: number) =>
  "R" + Math.round(n).toLocaleString("en-ZA");

const PLATFORM_FEE = 0.02;
const UBUNTU_CUT = 0.03;

export default function Calculator() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierKey, setTierKey] = useState<string>("");
  const [amount, setAmount] = useState<number>(500);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("circle_tiers")
        .select("*")
        .eq("is_active", true)
        .order("min_entry");
      const list = (data ?? []) as Tier[];
      setTiers(list);
      if (list[0]) {
        setTierKey(list[0].tier);
        setAmount(Math.round(Number(list[0].min_entry)));
      }
      setLoading(false);
    })();
  }, []);

  const tier = useMemo(
    () => tiers.find((t) => t.tier === tierKey) ?? null,
    [tiers, tierKey]
  );

  const result = useMemo(() => {
    if (!tier) return null;
    const platform_fee = +(amount * PLATFORM_FEE).toFixed(2);
    const ubuntu_cut = +(amount * UBUNTU_CUT).toFixed(2);
    const net = +(amount - platform_fee - ubuntu_cut).toFixed(2);
    const growth = +(net * Number(tier.growth_rate)).toFixed(2);
    const payout = +(net + growth).toFixed(2);
    return { platform_fee, ubuntu_cut, net, growth, payout };
  }, [amount, tier]);

  const min = tier ? Number(tier.min_entry) : 50;
  const max = tier ? Number(tier.max_entry) : 500_000;

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Calculator</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Project your<br />
            <span className="text-gradient-gold italic font-[450]">payout.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Pick a circle, set your contribution, see your projected return after fees.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tiers.length === 0 ? (
        <section className="mx-auto mt-8 max-w-md px-5">
          <div className="rounded-3xl glass p-6 text-center text-sm text-muted-foreground">
            No active circles right now. Check back soon.
          </div>
        </section>
      ) : (
        <>
          {/* Tier selector */}
          <section className="px-5 pt-8">
            <div className="mx-auto max-w-md">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Choose circle</p>
              <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 scrollbar-none">
                {tiers.map((t) => {
                  const active = t.tier === tierKey;
                  return (
                    <button
                      key={t.tier}
                      onClick={() => {
                        setTierKey(t.tier);
                        setAmount((a) => Math.min(Math.max(a, Number(t.min_entry)), Number(t.max_entry)));
                      }}
                      className={`shrink-0 px-4 h-11 rounded-2xl border text-sm capitalize transition-smooth ${
                        active
                          ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                          : "bg-secondary/60 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.tier} · +{Math.round(Number(t.growth_rate) * 100)}%
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Amount */}
          <section className="px-5 pt-8">
            <div className="mx-auto max-w-md rounded-3xl glass p-6 animate-slide-up">
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Contribution</p>
                <p className="text-[11px] text-muted-foreground">{fmtR(min)} – {fmtR(max)}</p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="font-display text-3xl text-gradient-gold">R</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  min={min}
                  max={max}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setAmount(Math.min(Math.max(v, min), max));
                  }}
                  className="h-14 flex-1 rounded-2xl border-border bg-secondary/40 font-display text-3xl"
                />
              </div>
              <div className="mt-5">
                <Slider
                  value={[amount]}
                  min={min}
                  max={max}
                  step={Math.max(50, Math.round((max - min) / 200))}
                  onValueChange={(v) => setAmount(v[0])}
                />
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>{fmtR(min)}</span>
                  <span>{fmtR(max)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Result */}
          {result && tier && (
            <section className="px-5 pt-6">
              <div className="mx-auto max-w-md rounded-3xl border border-accent/30 bg-gradient-card p-6 shadow-soft animate-fade-in">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-accent">Projected payout</p>
                    <p className="mt-2 font-display text-5xl tracking-tight text-gradient-gold">
                      {fmtR(result.payout)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      after {tier.vault_days}d vault · +{Math.round(Number(tier.growth_rate) * 100)}% on net
                    </p>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                </div>

                <ul className="mt-6 space-y-2.5 text-sm">
                  <Row label="Contribution" value={fmtR(amount)} />
                  <Row label="Platform fee (2%)" value={`− ${fmtR(result.platform_fee)}`} muted />
                  <Row label="Ubuntu fund (3%)" value={`− ${fmtR(result.ubuntu_cut)}`} muted icon={<ShieldCheck className="h-3 w-3 text-accent" />} />
                  <div className="my-2 h-px bg-border" />
                  <Row label="Net into vault" value={fmtR(result.net)} />
                  <Row label="Growth bonus" value={`+ ${fmtR(result.growth)}`} accent />
                </ul>

                <Link
                  to="/circle"
                  className="mt-6 h-12 w-full rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-2 transition-smooth hover:scale-[1.01]"
                >
                  <Sparkles className="h-4 w-4" /> Enter {tier.tier} circle
                </Link>
              </div>

              <p className="mx-auto mt-4 max-w-md text-center text-[11px] text-muted-foreground">
                <CalcIcon className="inline h-3 w-3 mr-1 -mt-0.5" />
                Estimates only. Final payouts depend on circle health & match queue.
              </p>
            </section>
          )}
        </>
      )}

      <BottomNav />
    </main>
  );
}

function Row({ label, value, muted, accent, icon }: { label: string; value: string; muted?: boolean; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between">
      <span className={`inline-flex items-center gap-1.5 ${muted ? "text-muted-foreground" : ""}`}>
        {icon}{label}
      </span>
      <span className={`font-medium ${accent ? "text-accent-soft" : muted ? "text-muted-foreground" : ""}`}>
        {value}
      </span>
    </li>
  );
}
