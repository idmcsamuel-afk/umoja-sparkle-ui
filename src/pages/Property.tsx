import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Building2, MapPin, TrendingUp, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Property {
  id: string;
  name: string;
  location: string;
  property_type: string;
  status: string | null;
  target_amount: number;
  raised_amount: number | null;
  projected_return_pct: number | null;
  description: string | null;
  image_url: string | null;
}

const UNIT_PRICE = 100; // R100 per unit
const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function PropertyPage() {
  const { user } = useAuth();
  const [props, setProps] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitsByProp, setUnitsByProp] = useState<Record<string, number>>({});
  const [investing, setInvesting] = useState<Property | null>(null);
  const [units, setUnits] = useState("10");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [pRes, uRes] = await Promise.all([
      supabase.from("properties").select("*").order("created_at", { ascending: false }),
      user
        ? supabase.from("reit_units").select("property_id, units").eq("member_id", user.id)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    setProps((pRes.data ?? []) as Property[]);
    const map: Record<string, number> = {};
    for (const r of (uRes.data ?? []) as { property_id: string | null; units: number }[]) {
      if (!r.property_id) continue;
      map[r.property_id] = (map[r.property_id] ?? 0) + Number(r.units);
    }
    setUnitsByProp(map);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const myTotalUnits = useMemo(
    () => Object.values(unitsByProp).reduce((s, n) => s + n, 0),
    [unitsByProp]
  );

  const submitInvest = async () => {
    if (!user || !investing) return;
    const u = Number(units);
    if (!Number.isFinite(u) || u <= 0) return toast.error("Enter unit count");
    setBusy(true);
    const total = +(u * UNIT_PRICE).toFixed(2);
    const { error } = await supabase.from("reit_units").insert({
      member_id: user.id,
      property_id: investing.id,
      units: u,
      price_per_unit: UNIT_PRICE,
      total_paid: total,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Investment recorded ✨", { description: `${u} units in ${investing.name}` });
    setInvesting(null);
    setUnits("10");
    load();
  };

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
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Property Fund</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Own a piece<br />
            <span className="text-gradient-gold italic font-[450]">of the village.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Pool with the community to back income properties. Each unit is {fmtR(UNIT_PRICE)}.
          </p>
        </div>
      </section>

      {/* My holdings card */}
      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md grid grid-cols-2 gap-3">
          <div className="rounded-3xl glass p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Your units</p>
            <p className="mt-2 font-display text-2xl text-gradient-gold">{myTotalUnits}</p>
            <p className="text-xs text-muted-foreground">≈ {fmtR(myTotalUnits * UNIT_PRICE)}</p>
          </div>
          <div className="rounded-3xl glass p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Active deals</p>
            <p className="mt-2 font-display text-2xl">{props.length}</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-primary" /> REIT-backed
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          {loading ? (
            <div className="space-y-3">
              {[0,1].map((i) => (
                <div key={i} className="rounded-3xl glass p-5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="h-32 rounded-2xl bg-secondary/80" />
                  <div className="mt-4 h-5 w-2/3 rounded bg-secondary/80" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-secondary/60" />
                </div>
              ))}
            </div>
          ) : props.length === 0 ? (
            <div className="rounded-3xl glass p-10 text-center animate-scale-in">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary/10 border border-primary/20">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-display text-xl">No deals yet</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">New properties open up monthly. Stay tuned.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {props.map((p, i) => {
                const raised = Number(p.raised_amount ?? 0);
                const target = Number(p.target_amount);
                const pct = Math.min(100, target > 0 ? (raised / target) * 100 : 0);
                const myUnits = unitsByProp[p.id] ?? 0;
                const totalUnits = Math.round(target / UNIT_PRICE);
                return (
                  <li
                    key={p.id}
                    style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                    className="overflow-hidden rounded-3xl glass animate-slide-up"
                  >
                    <div className="relative h-40 bg-secondary">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-gradient-primary/10">
                          <Building2 className="h-10 w-10 text-primary/60" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-transparent" />
                      <div className="absolute left-4 right-4 bottom-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-accent">{p.property_type}</p>
                        <h3 className="mt-1 font-display text-xl leading-tight">{p.name}</h3>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {p.location}
                        </p>
                      </div>
                      {p.projected_return_pct != null && (
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-gold px-2.5 py-1 text-[11px] font-semibold text-background shadow-glow">
                          <TrendingUp className="h-3 w-3" /> {Number(p.projected_return_pct).toFixed(1)}% p.a.
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      {p.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{p.description}</p>
                      )}
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <Stat label="Unit" value={fmtR(UNIT_PRICE)} />
                        <Stat label="Total units" value={totalUnits.toLocaleString("en-ZA")} />
                        <Stat label="Your units" value={myUnits.toString()} highlight={myUnits > 0} />
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                          <span>Raised {fmtR(raised)}</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <p className="mt-1.5 text-[11px] text-muted-foreground">Target {fmtR(target)}</p>
                      </div>
                      <Button
                        onClick={() => { setUnits("10"); setInvesting(p); }}
                        className="mt-5 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover-scale"
                      >
                        <Sparkles className="h-4 w-4 mr-1.5" /> Invest in {p.name.split(" ")[0]}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Invest dialog */}
      <Dialog open={!!investing} onOpenChange={(v) => !v && !busy && setInvesting(null)}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Invest in {investing?.name}</DialogTitle>
            <DialogDescription>
              Each unit is {fmtR(UNIT_PRICE)}. Returns are paid out from rental income and capital gain.
            </DialogDescription>
          </DialogHeader>
          {investing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Units</Label>
                <Input
                  type="number"
                  min="1"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="mt-1 h-12 rounded-2xl bg-secondary/60 font-display text-xl"
                />
              </div>
              <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit price</span>
                  <span>{fmtR(UNIT_PRICE)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Units</span>
                  <span>{Number(units) || 0}</span>
                </div>
                {investing.projected_return_pct != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Projected return</span>
                    <span className="text-accent">{Number(investing.projected_return_pct).toFixed(1)}% p.a.</span>
                  </div>
                )}
                <div className="my-1 h-px bg-border" />
                <div className="flex justify-between font-medium">
                  <span>You pay</span>
                  <span className="text-gradient-gold font-display">{fmtR((Number(units) || 0) * UNIT_PRICE)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-2xl border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p>Units are held in the UMOJA Property REIT. Rental yields distributed quarterly.</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setInvesting(null)}>Cancel</Button>
            <Button
              onClick={submitInvest}
              disabled={busy || !Number(units)}
              className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover-scale min-w-[140px]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm invest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-secondary/40 border border-border p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-base ${highlight ? "text-gradient-gold" : ""}`}>{value}</p>
    </div>
  );
}
