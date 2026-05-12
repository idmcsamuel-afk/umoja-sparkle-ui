import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Building2, Boxes } from "lucide-react";
import { toast } from "sonner";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function AdminProperties() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Common
  const [kind, setKind] = useState<"traditional" | "modular_project">("modular_project");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState("Residential");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [unitPrice, setUnitPrice] = useState("100");
  const [expectedRental, setExpectedRental] = useState("");
  const [fundingDeadline, setFundingDeadline] = useState("");

  // Land
  const [plotSize, setPlotSize] = useState("");
  const [titleDeed, setTitleDeed] = useState("");
  const [landCost, setLandCost] = useState("");

  // Modular
  const [supplier, setSupplier] = useState("Shenzhen ModuHome Co.");
  const [model, setModel] = useState("3-Bed Family");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("2");
  const [sizeSqm, setSizeSqm] = useState("120");
  const [homeCost, setHomeCost] = useState("");

  // Traditional target
  const [targetAmount, setTargetAmount] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("properties").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const calc = useMemo(() => {
    const land = Number(landCost) || 0;
    const home = Number(homeCost) || 0;
    const sp = home * 0.03;
    const asm = home * 0.10;
    const conn = 20000;
    const subtotal = land + home + sp + asm + conn;
    const cont = subtotal * 0.05;
    const total = subtotal + cont;
    const unitsTotal = Math.round(total / Math.max(1, Number(unitPrice) || 100));
    const monthly = Number(expectedRental) || 0;
    const yieldPct = total > 0 ? (monthly * 12 / total) * 100 : 0;
    return { land, home, sp, asm, conn, cont, total, unitsTotal, yieldPct };
  }, [landCost, homeCost, unitPrice, expectedRental]);

  const reset = () => {
    setName(""); setLocation(""); setDescription(""); setImageUrl("");
    setLandCost(""); setHomeCost(""); setExpectedRental(""); setTargetAmount("");
    setPlotSize(""); setTitleDeed(""); setFundingDeadline("");
  };

  const submit = async () => {
    if (!name || !location) return toast.error("Name and location required");
    setBusy(true);
    const isModular = kind === "modular_project";
    const target = isModular ? calc.total : Number(targetAmount) || 0;
    const yieldPct = isModular ? calc.yieldPct : (Number(expectedRental) * 12 / Math.max(1, target)) * 100;

    const payload: any = {
      name, location,
      property_type: isModular ? "Modular Home" : propertyType,
      property_kind: kind,
      description: description || null,
      image_url: imageUrl || null,
      target_amount: target,
      unit_price: Number(unitPrice) || 100,
      expected_monthly_rental: Number(expectedRental) || null,
      projected_return_pct: yieldPct ? +yieldPct.toFixed(2) : null,
      funding_deadline: fundingDeadline || null,
      status: "open",
      project_stage: isModular ? "funding" : null,
    };
    if (isModular) {
      Object.assign(payload, {
        modular_supplier: supplier,
        modular_model: model,
        bedrooms: Number(bedrooms) || null,
        bathrooms: Number(bathrooms) || null,
        size_sqm: Number(sizeSqm) || null,
        plot_size_sqm: Number(plotSize) || null,
        title_deed_number: titleDeed || null,
        land_cost: calc.land, home_cost: calc.home,
        site_prep_cost: calc.sp, assembly_cost: calc.asm,
        connection_cost: calc.conn, contingency_cost: calc.cont,
      });
    }

    const { error } = await supabase.from("properties").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Project created");
    setOpen(false); reset(); load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Properties</h1>
          <p className="text-sm text-muted-foreground">Manage traditional + modular projects</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-2xl bg-gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add project
        </Button>
      </div>

      <div className="rounded-3xl glass p-4">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No properties yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left p-2">Name</th><th className="text-left p-2">Kind</th><th className="text-left p-2">Location</th><th className="text-right p-2">Target</th><th className="text-right p-2">Raised</th><th className="text-left p-2">Stage</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 flex items-center gap-2">{r.property_kind === "modular_project" ? <Boxes className="h-3.5 w-3.5 text-accent" /> : <Building2 className="h-3.5 w-3.5 text-accent" />}{r.name}</td>
                  <td className="p-2 text-xs">{r.property_kind ?? "traditional"}</td>
                  <td className="p-2">{r.location}</td>
                  <td className="p-2 text-right">{fmtR(Number(r.target_amount))}</td>
                  <td className="p-2 text-right">{fmtR(Number(r.raised_amount ?? 0))}</td>
                  <td className="p-2 text-xs">{r.project_stage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="rounded-3xl bg-gradient-card max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">New property project</DialogTitle>
            <DialogDescription>Add a traditional property or land + modular home package.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Project type</Label>
              <RadioGroup value={kind} onValueChange={(v) => setKind(v as any)} className="mt-2 grid grid-cols-2 gap-2">
                <label className={`rounded-2xl border p-3 cursor-pointer flex items-center gap-2 ${kind === "traditional" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="traditional" /> <Building2 className="h-4 w-4" /> Traditional
                </label>
                <label className={`rounded-2xl border p-3 cursor-pointer flex items-center gap-2 ${kind === "modular_project" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="modular_project" /> <Boxes className="h-4 w-4" /> Land + Modular
                </label>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
            </div>
            <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></Field>
            <Field label="Image URL (optional)"><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Unit price (R)"><Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} /></Field>
              <Field label="Expected rent / month"><Input type="number" value={expectedRental} onChange={(e) => setExpectedRental(e.target.value)} /></Field>
              <Field label="Funding deadline"><Input type="date" value={fundingDeadline} onChange={(e) => setFundingDeadline(e.target.value)} /></Field>
            </div>

            {kind === "traditional" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Property type"><Input value={propertyType} onChange={(e) => setPropertyType(e.target.value)} /></Field>
                <Field label="Target amount (R)"><Input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} /></Field>
              </div>
            )}

            {kind === "modular_project" && (
              <>
                <div className="rounded-2xl border border-border p-4 space-y-3">
                  <p className="font-medium text-sm">Land</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Plot size (m²)"><Input type="number" value={plotSize} onChange={(e) => setPlotSize(e.target.value)} /></Field>
                    <Field label="Title deed #"><Input value={titleDeed} onChange={(e) => setTitleDeed(e.target.value)} /></Field>
                    <Field label="Land cost (R)"><Input type="number" value={landCost} onChange={(e) => setLandCost(e.target.value)} /></Field>
                  </div>
                </div>

                <div className="rounded-2xl border border-border p-4 space-y-3">
                  <p className="font-medium text-sm">Modular home</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Supplier">
                      <Select value={supplier} onValueChange={setSupplier}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Shenzhen ModuHome Co.">Shenzhen ModuHome Co.</SelectItem>
                          <SelectItem value="Guangzhou PrefabPro">Guangzhou PrefabPro</SelectItem>
                          <SelectItem value="Beijing Modular Group">Beijing Modular Group</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Model">
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2-Bed Starter">2-Bed Starter</SelectItem>
                          <SelectItem value="3-Bed Family">3-Bed Family</SelectItem>
                          <SelectItem value="4-Bed Executive">4-Bed Executive</SelectItem>
                          <SelectItem value="Granny Flat">Granny Flat</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <Field label="Bedrooms"><Input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} /></Field>
                    <Field label="Bathrooms"><Input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} /></Field>
                    <Field label="Size (m²)"><Input type="number" value={sizeSqm} onChange={(e) => setSizeSqm(e.target.value)} /></Field>
                    <Field label="Home cost (R)"><Input type="number" value={homeCost} onChange={(e) => setHomeCost(e.target.value)} /></Field>
                  </div>
                </div>

                <div className="rounded-2xl bg-secondary/40 border border-border p-4 text-sm space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Auto-calculated total</p>
                  <Row k="Land" v={calc.land} />
                  <Row k="Home" v={calc.home} />
                  <Row k="Site prep (3% of home)" v={calc.sp} />
                  <Row k="Assembly (10% of home)" v={calc.asm} />
                  <Row k="Connection fees" v={calc.conn} />
                  <Row k="Contingency (5%)" v={calc.cont} />
                  <div className="h-px bg-border my-1" />
                  <div className="flex justify-between font-medium"><span>Total project</span><span className="text-gradient-gold font-display">{fmtR(calc.total)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Total units @ {fmtR(Number(unitPrice) || 100)}</span><span>{calc.unitsTotal.toLocaleString("en-ZA")}</span></div>
                  {calc.yieldPct > 0 && <div className="flex justify-between text-xs text-accent"><span>Projected yield</span><span>{calc.yieldPct.toFixed(2)}% p.a.</span></div>}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy} className="rounded-2xl bg-gradient-primary text-primary-foreground min-w-[140px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between text-xs"><span className="text-muted-foreground">{k}</span><span>{fmtR(v)}</span></div>;
}
