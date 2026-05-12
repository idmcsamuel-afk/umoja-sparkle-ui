import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, MapPin, TrendingUp, ShieldCheck, Sparkles, Boxes, Home, BookOpen, Clock, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface Property {
  id: string;
  name: string;
  location: string;
  property_type: string;
  property_kind: string;
  status: string | null;
  target_amount: number;
  raised_amount: number | null;
  projected_return_pct: number | null;
  description: string | null;
  image_url: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  unit_price: number | null;
  expected_monthly_rental: number | null;
  project_stage: string | null;
  funding_deadline: string | null;
  delivery_date: string | null;
  assembly_complete_date: string | null;
  tenant_ready_date: string | null;
}

const STAGES = [
  { key: "land_secured", label: "Land secured" },
  { key: "funding", label: "Funding" },
  { key: "ordered", label: "Order home" },
  { key: "delivery", label: "Delivery" },
  { key: "assembly", label: "Assembly" },
  { key: "tenant_ready", label: "Tenant ready" },
];

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function PropertyPage() {
  const { user } = useAuth();
  const [props, setProps] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitsByProp, setUnitsByProp] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
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
    })();
  }, [user?.id]);

  const traditional = useMemo(() => props.filter(p => (p.property_kind ?? "traditional") === "traditional"), [props]);
  const modular = useMemo(() => props.filter(p => p.property_kind === "modular_project"), [props]);
  const mine = useMemo(() => props.filter(p => (unitsByProp[p.id] ?? 0) > 0), [props, unitsByProp]);

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-2xl animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Property Fund</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Invest in real estate<br />
            <span className="text-gradient-gold italic font-[450]">& modular homes.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Pool funds to buy properties — or back land + prefab home packages from China. Earn rental income and capital gains.
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link to="/property/modular-catalog" className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs hover-scale">
              <Boxes className="h-3 w-3 text-accent" /> Modular catalog
            </Link>
            <Link to="/property/how-it-works" className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs hover-scale">
              <BookOpen className="h-3 w-3 text-accent" /> How it works
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-2xl">
          <Tabs defaultValue="traditional">
            <TabsList className="grid grid-cols-3 w-full h-12 rounded-2xl bg-secondary/40">
              <TabsTrigger value="traditional" className="rounded-xl">Traditional</TabsTrigger>
              <TabsTrigger value="modular" className="rounded-xl">Modular</TabsTrigger>
              <TabsTrigger value="mine" className="rounded-xl">My investments</TabsTrigger>
            </TabsList>

            <TabsContent value="traditional" className="mt-5">
              <PropList items={traditional} loading={loading} unitsByProp={unitsByProp} kind="traditional" />
            </TabsContent>
            <TabsContent value="modular" className="mt-5">
              <PropList items={modular} loading={loading} unitsByProp={unitsByProp} kind="modular_project" />
            </TabsContent>
            <TabsContent value="mine" className="mt-5">
              {mine.length === 0 ? (
                <Empty message="You haven't invested yet. Browse the tabs above to get started." />
              ) : (
                <PropList items={mine} loading={false} unitsByProp={unitsByProp} kind="any" showUnits />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-3xl glass p-10 text-center animate-scale-in">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary/10 border border-primary/20">
        <Building2 className="h-6 w-6 text-primary" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{message}</p>
    </div>
  );
}

function PropList({
  items, loading, unitsByProp, kind, showUnits,
}: { items: Property[]; loading: boolean; unitsByProp: Record<string, number>; kind: string; showUnits?: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl glass p-5 animate-pulse">
            <div className="h-32 rounded-2xl bg-secondary/80" />
            <div className="mt-4 h-5 w-2/3 rounded bg-secondary/80" />
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <Empty message={kind === "modular_project" ? "No modular projects open right now. New projects launch monthly." : "No traditional properties open right now."} />;
  }
  return (
    <ul className="space-y-4">
      {items.map((p, i) => {
        const raised = Number(p.raised_amount ?? 0);
        const target = Number(p.target_amount);
        const pct = Math.min(100, target > 0 ? (raised / target) * 100 : 0);
        const myUnits = unitsByProp[p.id] ?? 0;
        const isModular = p.property_kind === "modular_project";
        const stageIdx = Math.max(0, STAGES.findIndex(s => s.key === (p.project_stage ?? "land_secured")));
        return (
          <li key={p.id} style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }} className="overflow-hidden rounded-3xl glass animate-slide-up">
            <Link to={`/property/${p.id}`} className="block">
              <div className="relative h-40 bg-secondary">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-primary/10">
                    {isModular ? <Boxes className="h-10 w-10 text-primary/60" /> : <Building2 className="h-10 w-10 text-primary/60" />}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-transparent" />
                <div className="absolute left-4 right-4 bottom-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
                    {isModular ? "Land + Modular Home" : p.property_type}
                  </p>
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
                {isModular && (
                  <div className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground overflow-x-auto">
                    {STAGES.map((s, idx) => (
                      <div key={s.key} className={`shrink-0 rounded-full px-2 py-0.5 border ${idx <= stageIdx ? "border-primary/40 text-primary bg-primary/10" : "border-border"}`}>
                        {idx <= stageIdx ? "✓ " : "⏳ "}{s.label}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Raised {fmtR(raised)}</span>
                  <span>{Math.round(pct)}%</span>
                </div>
                <Progress value={pct} className="h-2" />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <Stat label="Target" value={fmtR(target)} />
                  <Stat label="Unit" value={fmtR(Number(p.unit_price ?? 100))} />
                  <Stat label={showUnits ? "Your units" : "Yield"} value={showUnits ? String(myUnits) : (p.projected_return_pct != null ? `${Number(p.projected_return_pct).toFixed(1)}%` : "—")} highlight={showUnits && myUnits > 0} />
                </div>
                <Button className="mt-4 w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover-scale">
                  <Sparkles className="h-4 w-4 mr-1.5" /> View & invest
                </Button>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
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
