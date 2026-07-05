import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Store, Shuffle } from "lucide-react";
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

// Curated brand palette — UMOJA gold first, then tasteful anchors.
const COLOR_PRESETS: { hex: string; label: string }[] = [
  { hex: "#C99A3B", label: "UMOJA Gold" },
  { hex: "#0F766E", label: "Emerald" },
  { hex: "#1E3A8A", label: "Deep Navy" },
  { hex: "#B91C1C", label: "Crimson" },
  { hex: "#7C3AED", label: "Royal Purple" },
  { hex: "#EA580C", label: "Sunset" },
];
const DEFAULT_BANNER = "#C99A3B";
const DEFAULT_ACCENT = "#0F766E";

type Product = {
  name: string;
  category?: string | null;
  moq: number;
  unit_cost_zar: number;
  suggested_selling_price_zar?: number;
};

type StoreState = {
  template: string;
  storeName: string;
  tagline: string;
  bannerColor: string;
  accentColor: string;
  featuredProducts: Product[];
};

// ---------- suggestion helpers (template-based, no LLM) ----------

const CATEGORY_WORD: Record<string, string> = {
  pet: "Pet",
  pets: "Pet",
  beauty: "Beauty",
  cosmetics: "Beauty",
  home: "Home",
  kitchen: "Kitchen",
  fashion: "Style",
  clothing: "Style",
  apparel: "Style",
  tech: "Tech",
  electronics: "Tech",
  gadgets: "Tech",
  baby: "Baby",
  kids: "Kids",
  toys: "Toy",
  fitness: "Fit",
  sports: "Sport",
  wellness: "Wellness",
  health: "Wellness",
  food: "Pantry",
  grocery: "Pantry",
  office: "Desk",
  stationery: "Desk",
  auto: "Auto",
  garden: "Garden",
  tools: "Tool",
};

const CATEGORY_TAGLINE: Record<string, string> = {
  Pet: "Quality pet essentials, delivered.",
  Beauty: "Beauty picks you'll love.",
  Home: "Everyday home upgrades.",
  Kitchen: "Kitchen finds that just work.",
  Style: "Style staples for every day.",
  Tech: "Smart tech at fair prices.",
  Baby: "Little essentials, big love.",
  Kids: "Bright picks for busy kids.",
  Toy: "Playtime, sorted.",
  Fit: "Move better, feel better.",
  Sport: "Gear up. Go further.",
  Wellness: "Everyday wellness, simplified.",
  Pantry: "Pantry picks, delivered.",
  Desk: "A tidier desk starts here.",
  Auto: "Drive-ready essentials.",
  Garden: "Grow it. Love it.",
  Tool: "Tools that get it done.",
};

const normCategory = (raw?: string | null): string | null => {
  if (!raw) return null;
  const s = raw.toLowerCase();
  for (const key of Object.keys(CATEGORY_WORD)) {
    if (s.includes(key)) return CATEGORY_WORD[key];
  }
  return null;
};

const dominantCategory = (prods: Product[]): string | null => {
  const counts: Record<string, number> = {};
  for (const p of prods) {
    const c = normCategory(p.category) ?? normCategory(p.name);
    if (c) counts[c] = (counts[c] ?? 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
};

const titleize = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();

const buildNameCandidates = (opts: {
  firstName: string | null;
  category: string | null;
  businessType: string | null;
  fallback: string;
}): string[] => {
  const { firstName, category, businessType, fallback } = opts;
  const cat = category ?? "Trade";
  const bt = businessType ? titleize(businessType.replace(/[-_]/g, " ")) : null;
  const first = firstName ? titleize(firstName.split(/\s+/)[0]) : null;

  const pool: string[] = [];
  if (first) pool.push(`${first}'s ${cat} Co`);
  pool.push(`${cat} Hub`);
  pool.push(`${cat} Essentials`);
  pool.push(`${cat} Corner`);
  pool.push(`The ${cat} Edit`);
  if (bt) pool.push(`The ${bt} Store`);
  if (first) pool.push(`${first} ${cat} Trade Co`);
  pool.push(`${cat} & Co`);
  pool.push(`Everyday ${cat}`);
  if (fallback) pool.push(fallback);

  // dedupe, keep order
  const seen = new Set<string>();
  return pool.filter((n) => (n && !seen.has(n) ? (seen.add(n), true) : false));
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "my-store";

// ---------- component ----------

export default function SparkTradeStoreCreation() {
  const nav = useNavigate();
  const { user, member, loading } = useAuth();
  const [blueprintId, setBlueprintId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [fallbackName, setFallbackName] = useState<string>("");
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [store, setStore] = useState<StoreState>({
    template: "modern-marketplace",
    storeName: "",
    tagline: "",
    bannerColor: DEFAULT_BANNER,
    accentColor: DEFAULT_ACCENT,
    featuredProducts: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBlueprint = async (uid: string) => {
    const { data } = await supabase
      .from("spark_trade_blueprints" as any)
      .select("id, recommended_products, recommended_business_name, blueprint_json")
      .eq("member_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as any | null;
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      let bp = await fetchBlueprint(user.id);

      if (!bp) {
        try {
          const { error: fnError } = await supabase.functions.invoke(
            "generate-spark-trade-blueprint",
            { body: { memberId: user.id } }
          );
          if (fnError) throw fnError;
          bp = await fetchBlueprint(user.id);
        } catch (err: any) {
          console.error("[StoreCreation] blueprint bootstrap failed", err);
          setErrors({
            form:
              "We couldn't load your AI blueprint. Go back to the AI Business Blueprint step and try again.",
          });
        }
      }

      // pull business type from members
      const { data: memRow } = await supabase
        .from("members")
        .select("spark_trade_business_type")
        .eq("id", user.id)
        .maybeSingle();
      setBusinessType((memRow as any)?.spark_trade_business_type ?? null);

      if (bp) {
        setBlueprintId(bp.id);
        // products may live on recommended_products or inside blueprint_json.basket.products
        const bpJson = bp.blueprint_json ?? {};
        const prods: Product[] =
          (bp.recommended_products as Product[]) ??
          (bpJson?.basket?.products as Product[]) ??
          [];
        setProducts(prods);
        setFallbackName(bp.recommended_business_name || "");
        setStore((s) => ({
          ...s,
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
          storeName: (existing as any).store_name ?? "",
          tagline: (existing as any).store_description ?? "",
          bannerColor: (existing as any).banner_color ?? s.bannerColor,
          accentColor: (existing as any).accent_color ?? s.accentColor,
          featuredProducts:
            ((existing as any).featured_products as Product[]) ?? s.featuredProducts,
        }));
      }
    })();
  }, [user]);

  const category = useMemo(() => dominantCategory(products), [products]);

  const nameCandidates = useMemo(
    () =>
      buildNameCandidates({
        firstName: member?.full_name ?? null,
        category,
        businessType,
        fallback: fallbackName,
      }),
    [member?.full_name, category, businessType, fallbackName],
  );

  // rotate the visible chip window based on shuffleSeed
  const visibleNames = useMemo(() => {
    if (nameCandidates.length === 0) return [];
    const start = (shuffleSeed * 4) % nameCandidates.length;
    const out: string[] = [];
    for (let i = 0; i < Math.min(4, nameCandidates.length); i++) {
      out.push(nameCandidates[(start + i) % nameCandidates.length]);
    }
    return out;
  }, [nameCandidates, shuffleSeed]);

  const suggestedTagline = useMemo(() => {
    if (category && CATEGORY_TAGLINE[category]) return CATEGORY_TAGLINE[category];
    return "Handpicked essentials, delivered.";
  }, [category]);

  // apply smart defaults once suggestions are known (only if fields empty)
  useEffect(() => {
    setStore((s) => {
      const next = { ...s };
      if (!next.storeName && nameCandidates.length > 0) next.storeName = nameCandidates[0];
      if (!next.tagline) next.tagline = suggestedTagline;
      return next;
    });
  }, [nameCandidates, suggestedTagline]);

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
    const name = store.storeName.trim() || nameCandidates[0] || "My Store";
    if (!blueprintId) {
      setErrors({
        form:
          "Your AI blueprint hasn't been generated yet. Go back one step and complete the AI Business Blueprint before creating your store.",
      });
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
            store_name: name,
            store_description: store.tagline.trim() || null,
            store_template: store.template,
            banner_color: store.bannerColor,
            accent_color: store.accentColor,
            featured_products: store.featuredProducts,
          },
          { onConflict: "member_id" }
        );
      if (error) throw error;
      toast.success("Storefront saved");
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

  const slug = slugify(store.storeName || nameCandidates[0] || "my-store");

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
            We've pre-filled smart suggestions — tweak or accept and go.
          </p>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            You can change any of this later.
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
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Store name</Label>
                  <button
                    type="button"
                    onClick={() => setShuffleSeed((n) => n + 1)}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Shuffle className="h-3 w-3" /> More ideas
                  </button>
                </div>
                <Input
                  maxLength={50}
                  value={store.storeName}
                  onChange={(e) => setStore({ ...store, storeName: e.target.value })}
                  className="mt-2 h-11 rounded-xl"
                  placeholder={nameCandidates[0] ?? "My Awesome Store"}
                />
                {visibleNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {visibleNames.map((n) => {
                      const selected = store.storeName === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setStore({ ...store, storeName: n })}
                          className={[
                            "text-xs rounded-full border px-3 py-1.5 transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:border-primary/50",
                          ].join(" ")}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  URL: <span className="font-mono">sparktrade.com/store/{slug}</span>
                </p>
                {errors.storeName && (
                  <p className="text-destructive text-xs mt-1">{errors.storeName}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-semibold">
                  Tagline <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  maxLength={80}
                  value={store.tagline}
                  onChange={(e) => setStore({ ...store, tagline: e.target.value })}
                  className="mt-2 h-11 rounded-xl"
                  placeholder={suggestedTagline}
                />
                <button
                  type="button"
                  onClick={() => setStore((s) => ({ ...s, tagline: suggestedTagline }))}
                  className="mt-1 text-xs text-primary hover:underline"
                >
                  Use suggestion: "{suggestedTagline}"
                </button>
              </div>

              <div>
                <Label className="text-sm font-semibold">Brand colour</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((c) => {
                    const selected = store.bannerColor === c.hex;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setStore({ ...store, bannerColor: c.hex })}
                        title={c.label}
                        aria-label={c.label}
                        className={[
                          "h-10 w-10 rounded-full border-2 transition-transform",
                          selected ? "border-foreground scale-110" : "border-transparent",
                        ].join(" ")}
                        style={{ backgroundColor: c.hex }}
                      />
                    );
                  })}
                  <label
                    className="h-10 w-10 rounded-full border-2 border-dashed border-border grid place-items-center cursor-pointer overflow-hidden"
                    title="Custom colour"
                  >
                    <input
                      type="color"
                      value={store.bannerColor}
                      onChange={(e) => setStore({ ...store, bannerColor: e.target.value })}
                      className="opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                </div>
              </div>

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
                disabled={isSubmitting}
                className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  "Create Storefront →"
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                You can change any of this later.
              </p>
            </div>

            {/* RIGHT — PREVIEW */}
            <div className="md:sticky md:top-6 self-start">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Live preview
              </p>
              <StorePreviewCard store={store} slug={slug} />
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
        {COLOR_PRESETS.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            className={[
              "h-9 w-9 rounded-full border-2 transition-transform",
              value === c.hex ? "border-foreground scale-110" : "border-transparent",
            ].join(" ")}
            style={{ backgroundColor: c.hex }}
            aria-label={c.label}
            title={c.label}
          />
        ))}
      </div>
    </div>
  );
}

function StorePreviewCard({ store, slug }: { store: StoreState; slug: string }) {
  return (
    <div
      className="w-full max-w-sm mx-auto rounded-2xl bg-white shadow-lg overflow-hidden border"
      style={{ borderTopWidth: 4, borderTopColor: store.bannerColor }}
    >
      <div
        style={{ backgroundColor: store.bannerColor }}
        className="px-4 py-5 flex flex-col items-center justify-center text-center"
      >
        <span className="text-white font-bold text-lg drop-shadow">
          {store.storeName || "Your Store"}
        </span>
        {store.tagline && (
          <span className="mt-1 text-white/90 text-xs drop-shadow">
            {store.tagline}
          </span>
        )}
      </div>
      <div className="px-4 py-2 text-[10px] text-gray-500 font-mono border-b border-gray-100">
        sparktrade.com/store/{slug}
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
