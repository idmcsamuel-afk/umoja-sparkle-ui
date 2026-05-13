import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, MapPin, TrendingUp, ShieldCheck, Sparkles, Boxes, Loader2, CheckCircle2, Clock, Truck, Hammer, Home as HomeIcon, FileText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PaymentBreakdown } from "@/components/umoja/PaymentBreakdown";
import { BankAccountInfo } from "@/components/umoja/BankAccountInfo";
import { toast } from "sonner";

const STAGES = [
  { key: "land_secured", label: "Land secured", icon: CheckCircle2 },
  { key: "funding", label: "Funding open", icon: Sparkles },
  { key: "ordered", label: "Home ordered", icon: FileText },
  { key: "delivery", label: "Delivery", icon: Truck },
  { key: "assembly", label: "Assembly", icon: Hammer },
  { key: "tenant_ready", label: "Tenant ready", icon: HomeIcon },
];

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

interface PropertyRow {
  id: string; name: string; location: string; property_type: string; property_kind: string;
  status: string | null; target_amount: number; raised_amount: number | null;
  projected_return_pct: number | null; description: string | null; image_url: string | null;
  modular_supplier: string | null; modular_model: string | null;
  bedrooms: number | null; bathrooms: number | null; size_sqm: number | null;
  plot_size_sqm: number | null; title_deed_number: string | null;
  land_cost: number | null; home_cost: number | null; site_prep_cost: number | null;
  assembly_cost: number | null; connection_cost: number | null; contingency_cost: number | null;
  unit_price: number | null; expected_monthly_rental: number | null;
  project_stage: string | null; funding_deadline: string | null;
  home_order_date: string | null; delivery_date: string | null;
  assembly_complete_date: string | null; tenant_ready_date: string | null;
  gallery_urls: any; supplier_info: any;
}

interface Milestone {
  id: string; stage: string; title: string; description: string | null; occurred_at: string; is_complete: boolean;
}

export default function PropertyDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState<PropertyRow | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [units, setUnits] = useState("10");
  const [investing, setInvesting] = useState(false);
  const [step, setStep] = useState<"amount" | "pay">("amount");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    const [pr, mr] = await Promise.all([
      supabase.from("properties").select("*").eq("id", id).maybeSingle(),
      supabase.from("property_milestones").select("*").eq("property_id", id).order("occurred_at", { ascending: true }),
    ]);
    setP(pr.data as PropertyRow | null);
    setMilestones((mr.data ?? []) as Milestone[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const isModular = p?.property_kind === "modular_project";
  const unitPrice = Number(p?.unit_price ?? 100);
  const raised = Number(p?.raised_amount ?? 0);
  const target = Number(p?.target_amount ?? 0);
  const pct = Math.min(100, target > 0 ? (raised / target) * 100 : 0);
  const totalUnits = Math.round(target / Math.max(1, unitPrice));
  const stageIdx = useMemo(() => Math.max(0, STAGES.findIndex(s => s.key === (p?.project_stage ?? "land_secured"))), [p]);

  // Cost breakdown
  const breakdown = useMemo(() => {
    if (!p) return null;
    const land = Number(p.land_cost ?? 0);
    const home = Number(p.home_cost ?? 0);
    const sp = Number(p.site_prep_cost ?? 0);
    const asm = Number(p.assembly_cost ?? 0);
    const conn = Number(p.connection_cost ?? 0);
    const cont = Number(p.contingency_cost ?? 0);
    return { land, home, sp, asm, conn, cont, total: land + home + sp + asm + conn + cont };
  }, [p]);

  const rentalNet = useMemo(() => {
    const rent = Number(p?.expected_monthly_rental ?? 0);
    const mgmt = rent * 0.10;
    const reserve = 500;
    return { rent, mgmt, reserve, net: Math.max(0, rent - mgmt - reserve) };
  }, [p]);

  const u = Number(units);
  const subtotal = +(u * unitPrice).toFixed(2);
  const platformFee = +(subtotal * 0.02).toFixed(2);
  const total = +(subtotal + platformFee).toFixed(2);
  const payRef = useMemo(() => {
    if (!user || !p) return "";
    const memberShort = user.id.slice(0, 6).toUpperCase();
    const propShort = p.id.slice(0, 6).toUpperCase();
    return `PROP-${memberShort}-${propShort}`;
  }, [user, p]);

  const submitInvest = async () => {
    if (!user || !p) return;
    if (!Number.isFinite(u) || u <= 0) return toast.error("Enter unit count");
    if (!proofFile) return toast.error("Please upload proof of payment");
    setBusy(true);
    // Upload proof
    const ext = proofFile.name.split(".").pop() || "jpg";
    const path = `${user.id}/${p.id}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("property-payment-proofs").upload(path, proofFile, { upsert: false });
    if (up.error) { setBusy(false); return toast.error(up.error.message); }

    const { error } = await (supabase.from("reit_units") as any).insert({
      member_id: user.id,
      property_id: p.id,
      units: u,
      price_per_unit: unitPrice,
      total_paid: total,
      platform_fee: platformFee,
      payment_reference: payRef,
      proof_url: path,
      status: "payment_pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Investment submitted ✨", { description: "Admin will confirm your payment shortly." });
    setInvesting(false);
    setStep("amount");
    setProofFile(null);
    load();
  };

  const openInvest = () => { setStep("amount"); setProofFile(null); setInvesting(true); };

  if (!p) {
    return (
      <main className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/property" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-2xl animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            {isModular ? "Land + Modular Home" : p.property_type}
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight">{p.name}</h1>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {p.location}
          </p>
        </div>
      </section>

      {/* Hero image */}
      <section className="px-5 pt-5">
        <div className="mx-auto max-w-2xl rounded-3xl overflow-hidden glass relative h-56">
          {p.image_url ? (
            <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-primary/10">
              {isModular ? <Boxes className="h-12 w-12 text-primary/60" /> : <Building2 className="h-12 w-12 text-primary/60" />}
            </div>
          )}
          {p.projected_return_pct != null && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-gold px-3 py-1.5 text-xs font-semibold text-background shadow-glow">
              <TrendingUp className="h-3.5 w-3.5" /> {Number(p.projected_return_pct).toFixed(1)}% p.a.
            </span>
          )}
        </div>
      </section>

      {/* Funding progress */}
      <section className="px-5 pt-5">
        <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Raised {fmtR(raised)}</span>
            <span>{Math.round(pct)}% of {fmtR(target)}</span>
          </div>
          <Progress value={pct} className="h-2.5" />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <MiniStat label="Unit price" value={fmtR(unitPrice)} />
            <MiniStat label="Total units" value={totalUnits.toLocaleString("en-ZA")} />
            <MiniStat label="Min invest" value={fmtR(unitPrice * 10)} />
          </div>
          <Button onClick={() => setInvesting(true)} className="mt-4 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover-scale">
            <Sparkles className="h-4 w-4 mr-1.5" /> Invest now
          </Button>
        </div>
      </section>

      {/* Project stages (modular only) */}
      {isModular && (
        <section className="px-5 pt-6">
          <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
            <h3 className="font-display text-lg">Project stages</h3>
            <ol className="mt-4 space-y-3">
              {STAGES.map((s, idx) => {
                const Icon = s.icon;
                const done = idx <= stageIdx;
                const dateMap: Record<string, string | null | undefined> = {
                  ordered: p.home_order_date,
                  delivery: p.delivery_date,
                  assembly: p.assembly_complete_date,
                  tenant_ready: p.tenant_ready_date,
                };
                const d = dateMap[s.key];
                return (
                  <li key={s.key} className="flex items-start gap-3">
                    <div className={`mt-0.5 grid h-8 w-8 place-items-center rounded-full border ${done ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${done ? "" : "text-muted-foreground"}`}>{s.label}</p>
                      {d && <p className="text-[11px] text-muted-foreground">{new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</p>}
                    </div>
                    {done && <CheckCircle2 className="h-4 w-4 text-primary mt-1" />}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      {/* Land details */}
      {isModular && (
        <section className="px-5 pt-6">
          <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
            <h3 className="font-display text-lg">Land details</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Row label="Address" value={p.location} />
              <Row label="Plot size" value={p.plot_size_sqm ? `${p.plot_size_sqm} m²` : "—"} />
              <Row label="Title deed" value={p.title_deed_number ?? "Registered"} />
              <Row label="Land cost" value={fmtR(Number(p.land_cost ?? 0))} />
            </div>
          </div>
        </section>
      )}

      {/* Modular home specs */}
      {isModular && (
        <section className="px-5 pt-6">
          <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
            <h3 className="font-display text-lg">Modular home specs</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Row label="Supplier" value={p.modular_supplier ?? "—"} />
              <Row label="Model" value={p.modular_model ?? "—"} />
              <Row label="Bedrooms" value={p.bedrooms?.toString() ?? "—"} />
              <Row label="Bathrooms" value={p.bathrooms?.toString() ?? "—"} />
              <Row label="Size" value={p.size_sqm ? `${p.size_sqm} m²` : "—"} />
              <Row label="Home cost" value={fmtR(Number(p.home_cost ?? 0))} />
              <Row label="Delivery" value="6 weeks" />
              <Row label="Assembly" value="2 weeks" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {["40% cheaper than traditional build", "8 weeks total vs 6 months", "Modern, energy efficient", "10-year structural warranty"].map(adv => (
                <div key={adv} className="rounded-xl bg-primary/5 border border-primary/20 p-2 flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{adv}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cost breakdown */}
      {isModular && breakdown && breakdown.total > 0 && (
        <section className="px-5 pt-6">
          <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
            <h3 className="font-display text-lg">Total project cost</h3>
            <div className="mt-3 space-y-1.5 text-sm">
              <CostRow label="Land purchase" value={breakdown.land} />
              <CostRow label="Modular home" value={breakdown.home} />
              <CostRow label="Site preparation" value={breakdown.sp} />
              <CostRow label="Assembly labour" value={breakdown.asm} />
              <CostRow label="Connection fees" value={breakdown.conn} />
              <CostRow label="Contingency" value={breakdown.cont} />
              <div className="my-2 h-px bg-border" />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span className="text-gradient-gold font-display text-lg">{fmtR(breakdown.total)}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Rental projection */}
      {rentalNet.rent > 0 && (
        <section className="px-5 pt-6">
          <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
            <h3 className="font-display text-lg">Rental projection</h3>
            <div className="mt-3 space-y-1.5 text-sm">
              <CostRow label="Market rental" value={rentalNet.rent} />
              <CostRow label="Property management (10%)" value={-rentalNet.mgmt} />
              <CostRow label="Maintenance reserve" value={-rentalNet.reserve} />
              <div className="my-2 h-px bg-border" />
              <div className="flex justify-between">
                <span>Net monthly</span>
                <span className="text-gradient-gold font-display">{fmtR(rentalNet.net)}</span>
              </div>
              {p.projected_return_pct != null && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Annual yield</span>
                  <span>{Number(p.projected_return_pct).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Description */}
      {p.description && (
        <section className="px-5 pt-6">
          <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
            <h3 className="font-display text-lg">About this project</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{p.description}</p>
          </div>
        </section>
      )}

      {/* Live updates */}
      {milestones.length > 0 && (
        <section className="px-5 pt-6">
          <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
            <h3 className="font-display text-lg">Status updates</h3>
            <ol className="mt-3 space-y-3">
              {milestones.map(m => (
                <li key={m.id} className="flex items-start gap-3 text-sm">
                  <div className={`mt-1 h-2 w-2 rounded-full ${m.is_complete ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  <div className="flex-1">
                    <p className="font-medium">{m.title}</p>
                    {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(m.occurred_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Trust */}
      <section className="px-5 pt-6">
        <div className="mx-auto max-w-2xl rounded-3xl glass p-5 flex items-start gap-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <p>Units are held in the UMOJA Property REIT. Rental yields distributed quarterly. Modular structures carry a 10-year warranty from the manufacturer.</p>
        </div>
      </section>

      {/* Invest dialog */}
      <Dialog open={investing} onOpenChange={(v) => !v && !busy && setInvesting(false)}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Invest in {p.name}</DialogTitle>
            <DialogDescription>Each unit is {fmtR(unitPrice)}. Min 10 units.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Units</Label>
              <Input type="number" min="1" value={units} onChange={(e) => setUnits(e.target.value)} className="mt-1 h-12 rounded-2xl bg-secondary/60 font-display text-xl" />
            </div>
            <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Unit price</span><span>{fmtR(unitPrice)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Units</span><span>{Number(units) || 0}</span></div>
              <div className="my-1 h-px bg-border" />
              <div className="flex justify-between font-medium"><span>You pay</span><span className="text-gradient-gold font-display">{fmtR((Number(units) || 0) * unitPrice)}</span></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setInvesting(false)}>Cancel</Button>
            <Button onClick={submitInvest} disabled={busy || !Number(units)} className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover-scale min-w-[140px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm invest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 border border-border p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base">{value}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/30 border border-border p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={value < 0 ? "text-destructive" : ""}>{value < 0 ? "-" : ""}{fmtR(Math.abs(value))}</span>
    </div>
  );
}
