import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Prefs = {
  businessType: string;
  serviceArea: string;
  stockPreference: string;
  marketplaceExperience: string;
  purchasedFrom: string[];
  capital: number | null;
};

const BUSINESS_TYPES = [
  "Electronics",
  "Fashion",
  "Home & Garden",
  "Food & Beverages",
  "Services",
];

const SERVICE_AREAS = [
  { value: "City", desc: "Urban, high foot traffic" },
  { value: "Suburb", desc: "Residential, mixed traffic" },
  { value: "Village", desc: "Rural, community-based" },
  { value: "Online Only", desc: "No physical presence" },
];

const STOCK_PREFS = [
  { value: "Bulk", desc: "Large quantities, lower margins" },
  { value: "Mixed", desc: "Variety of products, medium MOQ" },
  { value: "Premium", desc: "High-end, smaller batches" },
  { value: "Budget", desc: "Affordable, high turnover" },
];

const MARKETPLACE_EXPERIENCES = [
  "None (new seller)",
  "Takealot",
  "Jumia",
  "Makro",
  "Amazon",
  "Other",
];

const PURCHASED_FROM_OPTIONS = [
  "Takealot",
  "Jumia",
  "Makro",
  "Amazon",
  "None",
];

export default function SparkTradeBusinessPreference() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>({
    businessType: "",
    serviceArea: "",
    stockPreference: "",
    marketplaceExperience: "",
    purchasedFrom: [],
    capital: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select(
          "spark_trade_business_type, spark_trade_service_area, spark_trade_stock_preference, spark_trade_marketplace_experience, spark_trade_purchased_from, spark_trade_capital"
        )
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          businessType: (data as any).spark_trade_business_type ?? "",
          serviceArea: (data as any).spark_trade_service_area ?? "",
          stockPreference: (data as any).spark_trade_stock_preference ?? "",
          marketplaceExperience: (data as any).spark_trade_marketplace_experience ?? "",
          purchasedFrom: (data as any).spark_trade_purchased_from ?? [],
          capital: (data as any).spark_trade_capital ?? null,
        });
      }
    })();
  }, [user]);

  const isComplete =
    !!prefs.businessType &&
    !!prefs.serviceArea &&
    !!prefs.stockPreference &&
    !!prefs.marketplaceExperience &&
    prefs.purchasedFrom.length > 0 &&
    prefs.capital !== null &&
    prefs.capital >= 1000;

  const togglePurchasedFrom = (value: string) => {
    setPrefs((prev) => {
      const current = prev.purchasedFrom;
      if (current.includes(value)) {
        return { ...prev, purchasedFrom: current.filter((v) => v !== value) };
      }
      return { ...prev, purchasedFrom: [...current, value] };
    });
  };

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!prefs.businessType) e.businessType = "Required";
    if (!prefs.serviceArea) e.serviceArea = "Required";
    if (!prefs.stockPreference) e.stockPreference = "Required";
    if (!prefs.marketplaceExperience) e.marketplaceExperience = "Required";
    if (prefs.purchasedFrom.length === 0) e.purchasedFrom = "Select at least one";
    if (prefs.capital === null || prefs.capital < 1000) e.capital = "Minimum capital required is R1,000";
    setErrors(e);
    if (Object.keys(e).length > 0 || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("members")
        .update({
          spark_trade_business_type: prefs.businessType,
          spark_trade_service_area: prefs.serviceArea,
          spark_trade_stock_preference: prefs.stockPreference,
          spark_trade_marketplace_experience: prefs.marketplaceExperience,
          spark_trade_purchased_from: prefs.purchasedFrom,
          spark_trade_capital: prefs.capital,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Preferences saved");
      nav("/spark-trade/onboarding/ai-blueprint");
    } catch (err: any) {
      console.error("[BusinessPreference] save failed", err);
      setErrors({ form: err?.message ?? "Failed to save. Please try again." });
      setIsSubmitting(false);
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
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Step 2 of 10</span>
            <span>Spark Trade Launchpad</span>
          </div>
          <Progress value={20} className="h-1.5" />
        </div>

        <div className="rounded-3xl border border-border bg-card shadow-sm p-6 md:p-12">
          <div className="flex justify-center mb-6">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <ClipboardList className="h-7 w-7" />
            </div>
          </div>

          <h1 className="font-display text-2xl md:text-[28px] font-bold text-center text-foreground">
            Tell us about your business
          </h1>
          <p className="mt-2 text-center text-base text-muted-foreground">
            Answer 5 quick questions to get recommendations
          </p>

          <div className="mt-8 space-y-6">
            {/* Q1 */}
            <div>
              <Label className="text-sm font-semibold">Business Type</Label>
              <Select
                value={prefs.businessType}
                onValueChange={(v) => setPrefs({ ...prefs, businessType: v })}
              >
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.businessType && (
                <p className="text-destructive text-xs mt-1">{errors.businessType}</p>
              )}
            </div>

            {/* Q2 */}
            <div>
              <Label className="text-sm font-semibold">Service Area</Label>
              <Select
                value={prefs.serviceArea}
                onValueChange={(v) => setPrefs({ ...prefs, serviceArea: v })}
              >
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue placeholder="Where will you sell?" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_AREAS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.value} — {s.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.serviceArea && (
                <p className="text-destructive text-xs mt-1">{errors.serviceArea}</p>
              )}
            </div>

            {/* Q3 */}
            <div>
              <Label className="text-sm font-semibold">Stock Preference</Label>
              <Select
                value={prefs.stockPreference}
                onValueChange={(v) => setPrefs({ ...prefs, stockPreference: v })}
              >
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue placeholder="What kind of stock?" />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_PREFS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.value} — {s.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.stockPreference && (
                <p className="text-destructive text-xs mt-1">{errors.stockPreference}</p>
              )}
            </div>

            {/* Q4 - Marketplace Experience */}
            <div>
              <Label className="text-sm font-semibold">What marketplace experience do you have?</Label>
              <Select
                value={prefs.marketplaceExperience}
                onValueChange={(v) => setPrefs({ ...prefs, marketplaceExperience: v })}
              >
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue placeholder="Select your experience level" />
                </SelectTrigger>
                <SelectContent>
                  {MARKETPLACE_EXPERIENCES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.marketplaceExperience && (
                <p className="text-destructive text-xs mt-1">{errors.marketplaceExperience}</p>
              )}
            </div>

            {/* Q5 - Purchased From (Multi-select) */}
            <div>
              <Label className="text-sm font-semibold">
                Which of these have you purchased from? (For product familiarity)
              </Label>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PURCHASED_FROM_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2 rounded-xl border border-border p-3 cursor-pointer hover:bg-accent/5 transition-colors"
                  >
                    <Checkbox
                      checked={prefs.purchasedFrom.includes(option)}
                      onCheckedChange={() => togglePurchasedFrom(option)}
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
              {errors.purchasedFrom && (
                <p className="text-destructive text-xs mt-2">{errors.purchasedFrom}</p>
              )}
            </div>

            {/* Q6 - Capital */}
            <div>
              <Label className="text-sm font-semibold">Capital Available (ZAR)</Label>
              <Input
                type="number"
                min={1000}
                placeholder="e.g., 2500"
                value={prefs.capital ?? ""}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    capital: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="mt-2 h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Initial capital available for first inventory (min R1,000)
              </p>
              {errors.capital && (
                <p className="text-destructive text-xs mt-1">{errors.capital}</p>
              )}
            </div>
          </div>

          {errors.form && (
            <p className="mt-4 text-sm text-destructive text-center" role="alert">
              {errors.form}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!isComplete || isSubmitting}
            className="mt-8 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              "Generate my Blueprint →"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
