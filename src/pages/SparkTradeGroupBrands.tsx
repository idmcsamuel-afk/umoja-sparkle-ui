import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users, Plus, Package, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { usePaystack, buildReference } from "@/hooks/usePaystack";

type Brand = {
  id: string;
  name: string;
  category: string;
  product_name: string;
  description: string | null;
  oem_supplier_name: string | null;
  unit_cost_usd: number | null;
  retail_price_zar: number | null;
  minimum_investment: number;
  target_total_capital: number;
  current_total_capital: number;
  status: string;
  founder_user_id: string;
  product_image_url: string | null;
};

const CATEGORIES = ["Electronics", "Fashion", "Food", "Home", "Beauty", "Other"];

type Mode = "choose" | "join" | "create";

export default function SparkTradeGroupBrands() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const { pay } = usePaystack();
  const [mode, setMode] = useState<Mode>("choose");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [investBrand, setInvestBrand] = useState<Brand | null>(null);
  const [investAmount, setInvestAmount] = useState<number>(50000);
  const [investing, setInvesting] = useState(false);

  // New brand form
  const [form, setForm] = useState({
    name: "",
    category: "Electronics",
    product_name: "",
    oem_supplier_name: "",
    description: "",
    initial_investment: 50000,
    target_investor_count: 5,
    target_total_capital: 250000,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== "join") return;
    setLoadingBrands(true);
    (async () => {
      const { data, error } = await (supabase.from("spark_trade_group_brands") as any)
        .select("*")
        .in("status", ["accepting_investors", "at_capacity", "in_production"])
        .order("created_at", { ascending: false });
      if (error) {
        console.error(error);
        toast.error("Failed to load brands");
      } else {
        setBrands((data ?? []) as Brand[]);
      }
      setLoadingBrands(false);
    })();
  }, [mode]);

  const stake = useMemo(() => {
    if (!investBrand) return 0;
    const total = Number(investBrand.target_total_capital) || 1;
    return (investAmount / total) * 100;
  }, [investBrand, investAmount]);

  const handleInvest = async () => {
    if (!user || !investBrand) return;
    if (investAmount < Number(investBrand.minimum_investment)) {
      toast.error(`Minimum investment is R${Number(investBrand.minimum_investment).toLocaleString()}`);
      return;
    }
    setInvesting(true);
    try {
      const email = user.email ?? "";
      const memberCode = (user.id ?? "x").slice(0, 8);
      const reference = buildReference("ST", investBrand.id, memberCode);

      // Create pending investor row first so we have a record to verify later
      const { error: insertErr } = await (supabase.from("spark_trade_group_brand_investors") as any)
        .insert({
          group_brand_id: investBrand.id,
          investor_user_id: user.id,
          investment_amount: investAmount,
          ownership_stake: Number(stake.toFixed(3)),
          payment_reference: reference,
          payment_status: "pending",
          status: "active",
        });
      if (insertErr) throw insertErr;

      const result = await pay({
        email,
        amountZar: investAmount,
        reference,
        metadata: {
          purpose: "group_brand_investment",
          group_brand_id: investBrand.id,
          investor_user_id: user.id,
          investment_amount: investAmount,
          ownership_stake: Number(stake.toFixed(3)),
        },
      });

      if (result.ok) {
        toast.success("Investment recorded — pending verification");
        setInvestBrand(null);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Could not start payment");
    } finally {
      setInvesting(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!form.name.trim() || !form.product_name.trim()) {
      toast.error("Brand name and product are required");
      return;
    }
    if (form.initial_investment < 50000) {
      toast.error("Minimum founder investment is R50,000");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase.from("spark_trade_group_brands") as any).insert({
        name: form.name.trim(),
        category: form.category,
        product_name: form.product_name.trim(),
        description: form.description.trim() || null,
        oem_supplier_name: form.oem_supplier_name.trim() || null,
        minimum_investment: 50000,
        target_total_capital: form.target_total_capital,
        founder_user_id: user.id,
        status: "pending_approval",
      });
      if (error) throw error;
      toast.success("Brand proposal submitted for review");
      setMode("choose");
      setForm({
        name: "",
        category: "Electronics",
        product_name: "",
        oem_supplier_name: "",
        description: "",
        initial_investment: 50000,
        target_investor_count: 5,
        target_total_capital: 250000,
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to submit proposal");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl md:text-3xl font-bold">Group Owned Brands</h1>
          <Button variant="ghost" size="sm" onClick={() => nav("/spark-trade/onboarding/income-goal")}>
            ← Back
          </Button>
        </div>

        {mode === "choose" && (
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("join")}
              className="text-left rounded-2xl border border-border bg-card p-6 hover:border-primary/60 hover:shadow-md transition"
            >
              <Users className="h-7 w-7 text-primary mb-3" />
              <div className="font-bold text-lg">Join an existing brand</div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>✓ Already vetted product + suppliers</li>
                <li>✓ Other investors already committed</li>
                <li>✓ Start selling immediately</li>
              </ul>
            </button>
            <button
              type="button"
              onClick={() => setMode("create")}
              className="text-left rounded-2xl border border-border bg-card p-6 hover:border-primary/60 hover:shadow-md transition"
            >
              <Plus className="h-7 w-7 text-primary mb-3" />
              <div className="font-bold text-lg">Start a new brand</div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>✓ Choose product category</li>
                <li>✓ Recruit co-investors</li>
                <li>✓ More control, more responsibility</li>
              </ul>
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>← Back</Button>
            {loadingBrands ? (
              <div className="grid place-items-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : brands.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="font-semibold">No brands available yet</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Be the first — start a new brand and recruit co-investors.
                </p>
                <Button className="mt-4" onClick={() => setMode("create")}>Start a new brand</Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {brands.map((b) => {
                  const progress = Math.min(100, (Number(b.current_total_capital) / Number(b.target_total_capital)) * 100);
                  return (
                    <div key={b.id} className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-lg">{b.name}</div>
                          <div className="text-sm text-muted-foreground">{b.product_name} · {b.category}</div>
                        </div>
                        <Badge variant={b.status === "accepting_investors" ? "default" : "secondary"}>
                          {b.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {b.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{b.description}</p>
                      )}
                      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="text-muted-foreground text-xs">Min investment</dt>
                          <dd className="font-semibold">R{Number(b.minimum_investment).toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Target capital</dt>
                          <dd className="font-semibold">R{Number(b.target_total_capital).toLocaleString()}</dd>
                        </div>
                        {b.unit_cost_usd != null && (
                          <div>
                            <dt className="text-muted-foreground text-xs">Unit cost</dt>
                            <dd className="font-semibold">${Number(b.unit_cost_usd).toFixed(2)}</dd>
                          </div>
                        )}
                        {b.retail_price_zar != null && (
                          <div>
                            <dt className="text-muted-foreground text-xs">Retail</dt>
                            <dd className="font-semibold">R{Number(b.retail_price_zar).toLocaleString()}</dd>
                          </div>
                        )}
                      </dl>
                      <div className="mt-3">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          R{Number(b.current_total_capital).toLocaleString()} / R{Number(b.target_total_capital).toLocaleString()} raised
                        </div>
                      </div>
                      <Button
                        className="mt-4 w-full"
                        disabled={b.status !== "accepting_investors"}
                        onClick={() => {
                          setInvestBrand(b);
                          setInvestAmount(Number(b.minimum_investment));
                        }}
                      >
                        Invest Now
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === "create" && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>← Back</Button>
            <div>
              <Label>Brand name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="UMOJA Premium Electronics" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Product</Label>
                <Input value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} placeholder="Wireless Earbuds" />
              </div>
            </div>
            <div>
              <Label>OEM supplier (optional)</Label>
              <Input value={form.oem_supplier_name} onChange={(e) => setForm((f) => ({ ...f, oem_supplier_name: e.target.value }))} placeholder="Shenzhen Acme Co." />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Your initial investment (R)</Label>
                <Input type="number" min={50000} value={form.initial_investment} onChange={(e) => setForm((f) => ({ ...f, initial_investment: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Target co-investors</Label>
                <Input type="number" min={1} value={form.target_investor_count} onChange={(e) => setForm((f) => ({ ...f, target_investor_count: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Target total capital (R)</Label>
                <Input type="number" min={50000} value={form.target_total_capital} onChange={(e) => setForm((f) => ({ ...f, target_total_capital: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label>Brief description (for recruitment)</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Why this product, target market, why this OEM..." />
            </div>
            <Button onClick={handleCreate} disabled={submitting} className="w-full">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : "Submit Brand Proposal"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Proposals are reviewed before going live. You'll be notified once approved.
            </p>
          </div>
        )}
      </div>

      <Dialog open={!!investBrand} onOpenChange={(o) => !o && setInvestBrand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invest in {investBrand?.name}</DialogTitle>
            <DialogDescription>
              Investment agreement: capital is committed to producing inventory at OEM cost. Revenue is shared by ownership stake.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Investment amount (R)</Label>
              <Input
                type="number"
                min={Number(investBrand?.minimum_investment ?? 50000)}
                value={investAmount}
                onChange={(e) => setInvestAmount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum R{Number(investBrand?.minimum_investment ?? 50000).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Your ownership stake: <span className="font-semibold">{stake.toFixed(2)}%</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvestBrand(null)}>Cancel</Button>
            <Button onClick={handleInvest} disabled={investing}>
              {investing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening payment…</> : "Confirm & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
