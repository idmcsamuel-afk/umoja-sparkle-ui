import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

export interface CostBreakdown {
  product_cost_cny: number;
  exchange_rate: number;
  quantity: number;
  measure_type: "weight" | "volume";
  weight_kg?: number;
  volume_m3?: number;
  shipping_cost: number;
  clearing_cost: number;
  landing_cost: number;
  handling_fee: number;
  storage_fee: number;
  total_cost_zar: number;
  cost_per_unit: number;
  target_margin_percent: number;
  bronze_sell_price: number;
  bronze_profit: number;
  silver_sell_price: number;
  silver_profit: number;
  gold_sell_price: number;
  gold_profit: number;
  calculated_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string | null;
  productName: string;
  initial?: Partial<CostBreakdown> | null;
  defaultRate?: number;
  onSaved?: () => void;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function SparkTradeCostCalculator({ open, onOpenChange, productId, productName, initial, defaultRate = 2.45, onSaved }: Props) {
  const [productCost, setProductCost] = useState(0);
  const [moq, setMoq] = useState(100);
  const [measure, setMeasure] = useState<"weight" | "volume">("weight");
  const [weight, setWeight] = useState(0);
  const [volume, setVolume] = useState(0);
  const [rate, setRate] = useState(defaultRate);
  const [margin, setMargin] = useState(40);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductCost(Number(initial?.product_cost_cny ?? 0));
    setMoq(Number(initial?.quantity ?? 100));
    setMeasure((initial?.measure_type as any) ?? "weight");
    setWeight(Number(initial?.weight_kg ?? 0));
    setVolume(Number(initial?.volume_m3 ?? 0));
    setRate(Number(initial?.exchange_rate ?? defaultRate));
    setMargin(Number(initial?.target_margin_percent ?? 40));
  }, [open, initial, defaultRate]);

  const calc = useMemo(() => {
    const qty = Math.max(0, moq);
    const baseProduct = productCost * rate * qty;
    const shipping = measure === "weight" ? 25 * weight : 500 * volume;
    const clearing = 0.15 * (productCost * rate);
    const landing = (baseProduct + shipping + clearing) * 1.05;
    const handling = 5 * qty;
    const storage = 3 * qty;
    const total = landing + handling + storage;
    const perUnit = qty > 0 ? total / qty : 0;
    const bronzePrice = margin < 100 ? perUnit / (1 - margin / 100) : perUnit;
    const bronzeProfit = bronzePrice - perUnit;
    const silverPrice = bronzePrice * 1.05;
    const silverProfit = bronzeProfit * 1.05;
    const goldPrice = bronzePrice * 1.10;
    const goldProfit = bronzeProfit * 1.10;
    return {
      shipping: r2(shipping),
      clearing: r2(clearing),
      landing: r2(landing),
      handling: r2(handling),
      storage: r2(storage),
      total: r2(total),
      perUnit: r2(perUnit),
      bronzePrice: r2(bronzePrice),
      bronzeProfit: r2(bronzeProfit),
      silverPrice: r2(silverPrice),
      silverProfit: r2(silverProfit),
      goldPrice: r2(goldPrice),
      goldProfit: r2(goldProfit),
    };
  }, [productCost, rate, moq, measure, weight, volume, margin]);

  const validate = (): string | null => {
    if (productCost <= 0) return "Product cost must be greater than 0";
    if (moq <= 0) return "MOQ must be greater than 0";
    if (measure === "weight" && weight <= 0) return "Weight must be greater than 0";
    if (measure === "volume" && volume <= 0) return "Volume must be greater than 0";
    if (margin < 10 || margin > 60) return "Target margin must be between 10% and 60%";
    return null;
  };

  const save = async () => {
    if (!productId) return;
    const err = validate();
    if (err) return toast.error(err);
    setSaving(true);
    const breakdown: CostBreakdown = {
      product_cost_cny: productCost,
      exchange_rate: rate,
      quantity: moq,
      measure_type: measure,
      weight_kg: measure === "weight" ? weight : undefined,
      volume_m3: measure === "volume" ? volume : undefined,
      shipping_cost: calc.shipping,
      clearing_cost: calc.clearing,
      landing_cost: calc.landing,
      handling_fee: calc.handling,
      storage_fee: calc.storage,
      total_cost_zar: calc.total,
      cost_per_unit: calc.perUnit,
      target_margin_percent: margin,
      bronze_sell_price: calc.bronzePrice,
      bronze_profit: calc.bronzeProfit,
      silver_sell_price: calc.silverPrice,
      silver_profit: calc.silverProfit,
      gold_sell_price: calc.goldPrice,
      gold_profit: calc.goldProfit,
      calculated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("spark_trade_shortlist")
      .update({
        cost_breakdown: breakdown as any,
        cost_updated_at: new Date().toISOString(),
        sale_price: calc.bronzePrice,
        cost_price: calc.perUnit,
        estimated_margin: calc.bronzeProfit,
        margin_pct: margin,
        moq,
      })
      .eq("id", productId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Costs saved");
    onSaved?.();
    onOpenChange(false);
  };

  const lowMargin = margin < 20;
  const highMargin = margin > 50;

  const TierCol = ({ label, price, profit, accent }: { label: string; price: number; profit: number; accent: string }) => {
    const m = price > 0 ? Math.round((profit / price) * 100) : 0;
    return (
      <div className={`rounded-2xl border ${accent} p-3`}>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-lg">R{price.toFixed(2)}</p>
        <p className="text-[11px] text-muted-foreground">Cost R{calc.perUnit.toFixed(2)}</p>
        <p className="text-[11px] text-emerald-400">Profit R{profit.toFixed(2)}</p>
        <p className="text-[11px]">{m}% margin</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Product Costing: {productName}</DialogTitle>
          <DialogDescription>Real-time landed-cost calculator with tier-adjusted pricing.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Product cost (CNY)</Label>
              <Input type="number" step="0.01" value={productCost || ""} onChange={(e) => setProductCost(Number(e.target.value))} />
            </div>
            <div>
              <Label>MOQ quantity</Label>
              <Input type="number" value={moq || ""} onChange={(e) => setMoq(Number(e.target.value))} />
            </div>
            <div>
              <Label>Exchange rate (CNY → ZAR)</Label>
              <Input type="number" step="0.01" value={rate || ""} onChange={(e) => setRate(Number(e.target.value))} />
            </div>
            <div>
              <Label>Measure by</Label>
              <RadioGroup value={measure} onValueChange={(v) => setMeasure(v as any)} className="flex gap-3 mt-2">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="weight" /> Weight</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="volume" /> Volume</label>
              </RadioGroup>
            </div>
            {measure === "weight" ? (
              <div>
                <Label>Weight (kg)</Label>
                <Input type="number" step="0.01" value={weight || ""} onChange={(e) => setWeight(Number(e.target.value))} />
              </div>
            ) : (
              <div>
                <Label>Volume (m³)</Label>
                <Input type="number" step="0.01" value={volume || ""} onChange={(e) => setVolume(Number(e.target.value))} />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm grid grid-cols-2 gap-y-1.5">
            <span className="text-muted-foreground">Shipping</span><span className="text-right">R{calc.shipping.toFixed(2)}</span>
            <span className="text-muted-foreground">Clearing (15%)</span><span className="text-right">R{calc.clearing.toFixed(2)}</span>
            <span className="text-muted-foreground">Landing (×1.05)</span><span className="text-right">R{calc.landing.toFixed(2)}</span>
            <span className="text-muted-foreground">Handling (R5/unit)</span><span className="text-right">R{calc.handling.toFixed(2)}</span>
            <span className="text-muted-foreground">Storage (R3/unit/mo)</span><span className="text-right">R{calc.storage.toFixed(2)}</span>
            <span className="font-display pt-2 border-t border-border col-span-2 flex justify-between">
              <span>Total cost</span><span>R{calc.total.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground">Cost per unit</span><span className="text-right text-accent">R{calc.perUnit.toFixed(2)}</span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Target margin: {margin}%</Label>
              <span className="text-xs text-muted-foreground">Base sell R{calc.bronzePrice.toFixed(2)}</span>
            </div>
            <Slider min={10} max={60} step={1} value={[margin]} onValueChange={(v) => setMargin(v[0])} className="mt-2" />
            {(lowMargin || highMargin) && (
              <p className={`mt-2 text-xs inline-flex items-center gap-1 ${lowMargin ? "text-amber-400" : "text-amber-400"}`}>
                <AlertTriangle className="h-3 w-3" />
                {lowMargin ? "Low margin — verify costs" : "High margin — may be uncompetitive"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <TierCol label="Bronze" price={calc.bronzePrice} profit={calc.bronzeProfit} accent="border-orange-700/40 bg-orange-900/10" />
            <TierCol label="Silver +5%" price={calc.silverPrice} profit={calc.silverProfit} accent="border-zinc-500/40 bg-zinc-700/10" />
            <TierCol label="Gold +10%" price={calc.goldPrice} profit={calc.goldProfit} accent="border-accent/40 bg-accent/10" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Costs
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
