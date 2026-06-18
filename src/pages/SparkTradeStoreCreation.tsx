import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const TEMPLATES = [
  { slug: "modern-marketplace", name: "Modern Marketplace", desc: "Blue, clean, grid" },
  { slug: "bold-colorful", name: "Bold & Colorful", desc: "Vibrant, high contrast" },
  { slug: "minimal-pro", name: "Minimal Professional", desc: "White, typography-focused" },
  { slug: "community-vibes", name: "Community Vibes", desc: "Warm, inviting" },
  { slug: "premium-luxury", name: "Premium Luxury", desc: "Dark, gold accents" },
];

const COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#EC4899",
  "#F97316", "#EF4444", "#14B8A6", "#6366F1",
];

type Product = {
  name: string;
  moq: number;
  unit_cost_zar: number;
  suggested_selling_price_zar?: number;
};

type StoreState = {
  template: string;
  storeName: string;
  bannerColor: string;
  accentColor: string;
  featuredProducts: Product[];
};

export default function SparkTradeStoreCreation() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [blueprintId, setBlueprintId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [store, setStore] = useState<StoreState>({
    template: "modern-marketplace",
    storeName: "",
    bannerColor: "#3B82F6",
    accentColor: "#10B981",
    featuredProducts: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: bp } = await supabase
        .from("spark_trade_blueprints" as any)
        .select("id, recommended_products, recommended_business_name")
        .eq("member_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (bp) {
        setBlueprintId((bp as any).id);
        const prods = ((bp as any).recommended_products as Product[]) ?? [];
        setProducts(prods);
        setStore((s) => ({
          ...s,
          storeName: s.storeName || (bp as any).recommended_business_name || "",
          featuredProducts: prods.slice(0, 3),
        }));
      }
      // Prefill existing store if any
      const { data: existing } = await supabase
        .from("spark_trade_stores" as any)
        .select("*")
        .eq("member_id", user.id)
        .maybeSingle();
      if (existing) {
        setStore((s) => ({
          template: (existing as any).store_template ?? s.template,
          storeName: (existing as any).store_name ?? s.storeName,
          bannerColor: (existing as any).banner_color ?? s.bannerColor,
          accentColor: (existing as any).accent_color ?? s.accentColor,
          featuredProducts: ((existing as any).featured_products as Product[]) ?? s.featuredProducts,
        }));
      }
    })();
  }, [user]);

  const toggleProduct = (p: Product) => {
    setStore((s) => {
      const exists = s.featuredProducts.some((x) => x.name === p.name);
      return {
        ...s,
        featuredProducts: exists
          ? s.featuredProducts.filter((x) => x.name !== p.name)
          : [...s.featuredProducts, p],
      };
    });
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!store.storeName.trim()) {
      setErrors({ storeName: "Store name required" });
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("spark_trade_stores" as any)
        .upsert(
          {
            member_id: user.id,
            blueprint_id: blueprintId,
            store_name: store.storeName.trim(),
            store_template: store.template,
            banner_color: store.bannerColor,
            accent_color: store.accentColor,
            featured_products: store.featuredProducts,
          },
          { onConflict: "member_id" }
        );
      if (error) throw error;
      toast.success("Store created");
      nav("/spark-trade/onboarding/subscription-recommendation");
    } catch (err: any) {
      console.error("[StoreCreation] save failed", err);
      setErrors({ form: err?.message ?? "Failed to save store. Try again." });
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
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Step 4 of 10</span>
            <span>Spark Trade Launchpad</span>
          </div>
          <Progress value={40} className="h-1.5" />
        </div>

        <div className="rounded-3xl border border-border bg-card shadow-sm p-6 md:p-10">
          <div className="flex justify-center mb-6">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Store className="h-7 w-7" />
            </div>
          </div>
          <h1 className="font-display text-2xl md:text-[28px] font-bold text-center text-foreground">
            Design your storefront
          </h1>
          <p className="mt-2 text-center text-base text-muted-foreground">
            Customise the look — preview updates live
          </p>

          <div className="mt-8 grid md:grid-cols-2 gap-8">
            {/* LEFT */}
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-semibold">Template</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => {
                    const selected = store.template === t.slug;
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => setStore({ ...store, template: t.slug })}
                        className={[
                          "text-left rounded-xl border p-3 transition-all",
                          selected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50",
                        ].join(" ")}
                      >
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Store name</Label>
                <Input
                  maxLength={50}
                  value={store.storeName}
                  onChange={(e) => setStore({ ...store, storeName: e.target.value })}
                  className="mt-2 h-11 rounded-xl"
                  placeholder="My Awesome Store"
                />
                {errors.storeName && (
                  <p className="text-destructive text-xs mt-1">{errors.storeName}</p>
                )}
              </div>

              <ColorRow
                label="Banner colour"
                value={store.bannerColor}
                onChange={(v) => setStore({ ...store, bannerColor: v })}
              />
              <ColorRow
                label="Accent colour"
                value={store.accentColor}
                onChange={(v) => setStore({ ...store, accentColor: v })}
              />

              {products.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Featured products</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    Tap to add/remove from your storefront
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {products.map((p) => {
                      const selected = store.featuredProducts.some((x) => x.name === p.name);
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => toggleProduct(p)}
                          className={[
                            "text-xs rounded-full border px-3 py-1.5 transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:border-primary/50",
                          ].join(" ")}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {errors.form && (
                <p className="text-sm text-destructive">{errors.form}</p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !store.storeName.trim()}
                className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  "Next: Recommended plan →"
                )}
              </Button>
            </div>

            {/* RIGHT — PREVIEW */}
            <div className="md:sticky md:top-6 self-start">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Live preview
              </p>
              <StorePreviewCard store={store} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={[
              "h-9 w-9 rounded-full border-2 transition-transform",
              value === c ? "border-foreground scale-110" : "border-transparent",
            ].join(" ")}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

function StorePreviewCard({ store }: { store: StoreState }) {
  return (
    <div
      className="w-full max-w-sm mx-auto rounded-2xl bg-white shadow-lg overflow-hidden border"
      style={{ borderTopWidth: 4, borderTopColor: store.bannerColor }}
    >
      <div
        style={{ backgroundColor: store.bannerColor }}
        className="h-24 flex items-end justify-center pb-3"
      >
        <span className="text-white font-bold text-lg drop-shadow">
          {store.storeName || "Your Store"}
        </span>
      </div>
      <div className="p-4 space-y-2">
        <h4 className="font-semibold text-sm text-gray-900">Featured Products</h4>
        {store.featuredProducts.length === 0 && (
          <p className="text-xs text-gray-500">No products selected yet</p>
        )}
        {store.featuredProducts.map((p) => (
          <div key={p.name} className="flex justify-between text-sm text-gray-700">
            <span>{p.name}</span>
            <span style={{ color: store.accentColor }} className="font-semibold">
              R{p.suggested_selling_price_zar ?? Math.round(p.unit_cost_zar * 2)}
            </span>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-gray-100">
        <button
          className="w-full py-2 rounded-lg text-sm font-semibold"
          style={{ color: store.accentColor }}
        >
          I already own this business!
        </button>
      </div>
    </div>
  );
}
