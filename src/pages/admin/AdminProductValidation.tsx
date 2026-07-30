import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Check, X, ExternalLink, Star, RefreshCw, ImageOff, Trash2, Radar, Loader2, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { computeMemberMoq, useSparkTradeFloors } from "@/lib/sparkTradeMoq";
import { AlibabaSearchPanel, type AlibabaCandidate } from "@/components/umoja/AlibabaSearchPanel";

type ValidationStatus = "pending_review" | "approved_to_queue" | "rejected" | "demand_validated";

interface ProductRow {
  id: string;
  title: string | null;
  asin: string | null;
  category: string | null;
  rating: number | null;
  review_count: number | null;
  price_usd: number | null;
  price_zar: number | null;
  marketplace: string | null;
  product_url: string | null;
  image_url: string | null;
  validation_status: ValidationStatus | null;
  reviewed_at: string | null;
  created_at: string;
  sales_rank: number | null;
  sales_rank_category: string | null;
  seller_count: number | null;
  seller_count_verified: boolean | null;
  buybox_price: number | null;
  buybox_currency: string | null;
  days_seen: number | null;
  times_seen: number | null;
  brand: string | null;
  is_branded: boolean | null;
  alibaba_url?: string | null;
  alibaba_price?: string | null;
  alibaba_moq?: number | null;
  alibaba_supplier?: string | null;
}

type StatusFilter = "all" | "pending_review" | "approved_to_queue" | "demand_validated" | "rejected" | "has_alibaba";
type MarketFilter = "all" | "amazon_us" | "amazon_sa" | "walmart_us" | "takealot_sa";
type MinReviewsFilter = 0 | 100 | 500 | 1000;
type SortMode = "reviews_desc" | "newest";
type BrandFilter = "all" | "branded" | "generic";
/** Days of recency to load. 0 = no date limit. */
type RecencyFilter = 7 | 30 | 90 | 0;

const PAGE_SIZE = 5;
const MARKET_LABEL: Record<string, string> = {
  amazon_us: "Amazon US",
  amazon_sa: "Amazon SA",
  walmart_us: "Walmart US",
  takealot_sa: "Takealot SA",
  amazon_uk: "Amazon UK",
  amazon_de: "Amazon DE",
};
const SA_MARKETS = new Set(["amazon_sa", "takealot_sa"]);

const DEFAULTS = { buffer_pct: 10, commission_pct: 8, freight_rate_per_cbm: 8800, kg_per_cbm: 200 };

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground text-xs">No rating</span>;
  const v = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value.toFixed(1)}</span>
    </span>
  );
}

function DemandBadge({ reviews, marketplace, rank, rating, daysSeen }: { reviews: number | null; marketplace?: string | null; rank?: number | null; rating?: number | null; daysSeen?: number | null }) {
  // Reviews-first hierarchy (Takealot):
  //   HIGH   = reviews>=500  OR (reviews>=100 AND rank<=10)
  //   MEDIUM = reviews>=100  OR (rank<=10 AND daysSeen>=3)
  //   LOW    = otherwise
  if (marketplace === "takealot_sa") {
    const r = reviews ?? 0;
    const rk = rank ?? 999;
    const d = daysSeen ?? 0;

    // Reason — reviews take precedence in the label
    const reason =
      r >= 500 ? `${r.toLocaleString()} reviews`
      : r >= 100 && rk <= 10 ? `${r.toLocaleString()} reviews · #${rk}`
      : r >= 100 ? `${r.toLocaleString()} reviews`
      : rk <= 10 && d >= 3 ? `#${rk} · ${d}d in top 10`
      : rk <= 10 ? `#${rk}`
      : d >= 3 ? `${d}d in top 10`
      : rk <= 25 ? `#${rk}`
      : "low signal";

    if (r >= 500 || (r >= 100 && rk <= 10)) return <Badge className="bg-green-600 text-white">HIGH — {reason}</Badge>;
    if (r >= 100 || (rk <= 10 && d >= 3)) return <Badge className="bg-amber-500 text-white">MEDIUM — {reason}</Badge>;
    return <Badge className="bg-red-600 text-white">LOW — {reason}</Badge>;
  }
  if (reviews == null) return <Badge variant="outline">NO REVIEWS</Badge>;
  if (reviews >= 5000) return <Badge className="bg-green-600 text-white">HIGH DEMAND</Badge>;
  if (reviews >= 1000) return <Badge className="bg-amber-500 text-white">MEDIUM DEMAND</Badge>;
  return <Badge className="bg-red-600 text-white">LOW DEMAND</Badge>;
}

interface PriceForm {
  alibaba_cost_zar: string;
  weight_kg: string;
  buffer_pct: string;
  commission_pct: string;
  moq: string;
  member_min_buyin_zar: string;   // optional per-product override of global R400
  supplier_name: string;
  freight_override_zar: string;   // sea override (legacy key retained)
  freight_air_zar: string;        // air override (blank = air unavailable)
  sa_selling_price_zar: string;   // required for US/Walmart rows (no price_zar); optional override for SA rows
}

function computeMargins(input: {
  alibaba_cost_zar: number;
  weight_kg: number;
  buffer_pct: number;
  commission_pct: number;
  price_zar: number;
  freight_sea_override?: number | null;
  freight_air_override?: number | null;
}) {
  const adjusted_cost = input.alibaba_cost_zar * (1 + input.buffer_pct / 100);

  const hasSea = input.freight_sea_override != null && !isNaN(input.freight_sea_override as number) && (input.freight_sea_override as number) >= 0;
  const freight_sea_zar = hasSea
    ? (input.freight_sea_override as number)
    : (input.weight_kg / DEFAULTS.kg_per_cbm) * DEFAULTS.freight_rate_per_cbm;
  const commission_sea = (adjusted_cost + freight_sea_zar) * (input.commission_pct / 100);
  const landed_sea = adjusted_cost + freight_sea_zar + commission_sea;
  const margin_sea = input.price_zar - landed_sea;
  const margin_sea_pct = input.price_zar > 0 ? (margin_sea / input.price_zar) * 100 : 0;

  const hasAir = input.freight_air_override != null && !isNaN(input.freight_air_override as number) && (input.freight_air_override as number) > 0;
  const freight_air_zar = hasAir ? (input.freight_air_override as number) : 0;
  const commission_air = (adjusted_cost + freight_air_zar) * (input.commission_pct / 100);
  const landed_air = adjusted_cost + freight_air_zar + commission_air;
  const margin_air = input.price_zar - landed_air;
  const margin_air_pct = input.price_zar > 0 ? (margin_air / input.price_zar) * 100 : 0;

  return {
    adjusted_cost,
    // sea (also legacy)
    freight_cost_zar: freight_sea_zar,
    freight_is_override: hasSea,
    umoja_commission_zar: commission_sea,
    landed_cost_zar: landed_sea,
    gross_margin_zar: margin_sea,
    expected_margin_percentage: margin_sea_pct,
    // dual
    freight_sea_zar,
    landed_cost_sea_zar: landed_sea,
    gross_margin_sea_zar: margin_sea,
    margin_sea_pct,
    air_available: hasAir,
    freight_air_zar,
    landed_cost_air_zar: hasAir ? landed_air : 0,
    gross_margin_air_zar: hasAir ? margin_air : 0,
    margin_air_pct: hasAir ? margin_air_pct : 0,
  };
}

const SS_KEY = "adminProductValidation:uiState:v1";
type PersistedUi = {
  statusFilter: StatusFilter;
  marketFilter: MarketFilter;
  minReviewsFilter: MinReviewsFilter;
  sortMode: SortMode;
  brandFilter: BrandFilter;
  recencyFilter: RecencyFilter;
  showImageless: boolean;
  page: number;
  openForm: string | null;
  alibabaFor: { id: string; title: string; image: string | null; priceLabel: string | null } | null;
  scrollY: number;
};
const readPersisted = (): Partial<PersistedUi> => {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedUi>) : {};
  } catch { return {}; }
};

export default function AdminProductValidation() {
  const { user } = useAuth();
  const persisted = useMemo(readPersisted, []);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(persisted.statusFilter ?? "pending_review");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>(persisted.marketFilter ?? "all");
  const [minReviewsFilter, setMinReviewsFilter] = useState<MinReviewsFilter>(persisted.minReviewsFilter ?? 0);
  const [sortMode, setSortMode] = useState<SortMode>(persisted.sortMode ?? "reviews_desc");
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(persisted.brandFilter ?? "all");
  // Default 90 days: Amazon/Walmart rows refresh in place (upsert) so their
  // created_at can be older than a week — a 7-day window hid them entirely.
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>(persisted.recencyFilter ?? 90);
  const [showImageless, setShowImageless] = useState(persisted.showImageless ?? false);
  const [page, setPage] = useState(persisted.page ?? 1);
  const [saving, setSaving] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<string | null>(persisted.openForm ?? null);
  const [forms, setForms] = useState<Record<string, PriceForm>>({});
  const [draftLoaded, setDraftLoaded] = useState<Record<string, boolean>>({});
  const [restoredNote, setRestoredNote] = useState<Record<string, boolean>>({});
  const [enriching, setEnriching] = useState<string | null>(null);
  const [alibabaFor, setAlibabaFor] = useState<{ id: string; title: string; image: string | null; priceLabel: string | null } | null>(persisted.alibabaFor ?? null);
  const floors = useSparkTradeFloors();

  // Persist UI state so navigating away (e.g. opening Alibaba in a new tab and
  // returning, or the component remounting on tab focus) keeps page / filters /
  // open panel intact.
  useEffect(() => {
    const payload: PersistedUi = {
      statusFilter, marketFilter, minReviewsFilter, sortMode, brandFilter, recencyFilter,
      showImageless, page, openForm, alibabaFor,
      scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    };
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
  }, [statusFilter, marketFilter, minReviewsFilter, sortMode, brandFilter, recencyFilter, showImageless, page, openForm, alibabaFor]);

  // Save scroll position continuously so restore is accurate.
  useEffect(() => {
    const onScroll = () => {
      try {
        const raw = sessionStorage.getItem(SS_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        obj.scrollY = window.scrollY;
        sessionStorage.setItem(SS_KEY, JSON.stringify(obj));
      } catch { /* ignore */ }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Restore scroll once rows have loaded and the DOM has rendered.
  useEffect(() => {
    if (loading) return;
    const y = persisted.scrollY ?? 0;
    if (y > 0) {
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
    // Only run once after first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const USD_TO_ZAR = 18.5;

  const handleAlibabaSelect = async (rowId: string, c: AlibabaCandidate) => {
    setForms((prev) => {
      const cur = prev[rowId] ?? blankForm();
      const costZar = c.price_from != null ? (c.price_from * USD_TO_ZAR).toFixed(2) : cur.alibaba_cost_zar;
      return {
        ...prev,
        [rowId]: {
          ...cur,
          alibaba_cost_zar: costZar,
          moq: c.moq_found && c.moq ? String(c.moq) : "",
          supplier_name: c.supplier_name ?? cur.supplier_name,
        },
      };
    });
    setOpenForm(rowId);
    const { data: updated, error } = await supabase.from("products" as any).update({
      alibaba_url: c.url,
      alibaba_price: c.price_label,
      alibaba_moq: c.moq_found ? c.moq : null,
      alibaba_supplier: c.supplier_name,
    }).eq("id", rowId).select("id, alibaba_url, alibaba_price, alibaba_moq, alibaba_supplier");
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    if (!updated || updated.length === 0) {
      toast({ title: "Save blocked", description: "No row updated — you may not have permission on this row.", variant: "destructive" });
      return;
    }
    const saved = updated[0] as any;
    setRows((prev) => prev.map((x) => x.id === rowId ? { ...x, alibaba_url: saved.alibaba_url, alibaba_price: saved.alibaba_price, alibaba_moq: saved.alibaba_moq, alibaba_supplier: saved.alibaba_supplier } as any : x));
    toast({
      title: "Alibaba match saved",
      description: c.moq_found ? `MOQ ${c.moq!.toLocaleString()} · ${c.price_label}` : "⚠️ MOQ not found — enter it manually before approving.",
    });
  };

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("products" as any)
      .select("*");
    // Recency window is configurable — marketplace scrapers upsert in place, so
    // a freshly-refreshed row can still have an old created_at.
    if (recencyFilter > 0) {
      const since = new Date(Date.now() - recencyFilter * 24 * 60 * 60 * 1000).toISOString();
      q = q.gte("created_at", since);
    }
    if (marketFilter !== "all") q = q.eq("marketplace", marketFilter);
    // Order by review_count desc (Amazon/Walmart), then created_at desc so rows without
    // review_count (Takealot) still appear.
    const { data, error } = await q
      .order("review_count", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows(((data ?? []) as unknown) as ProductRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [marketFilter, recencyFilter]);

  // Reset page when filters change — but skip the first render so a restored
  // page number from sessionStorage isn't wiped on mount.
  const filtersMountedRef = useRef(false);
  useEffect(() => {
    if (!filtersMountedRef.current) { filtersMountedRef.current = true; return; }
    setPage(1);
  }, [statusFilter, marketFilter, showImageless, minReviewsFilter, sortMode, brandFilter, recencyFilter]);

  const hasImage = (r: ProductRow) => typeof r.image_url === "string" && /^https?:\/\//i.test(r.image_url);

  const counts = useMemo(() => {
    const pending = rows.filter((r) => (r.validation_status ?? "pending_review") === "pending_review").length;
    const approved = rows.filter((r) => r.validation_status === "approved_to_queue").length;
    const rejected = rows.filter((r) => r.validation_status === "rejected").length;
    const demand = rows.filter((r) => r.validation_status === "demand_validated").length;
    const withAlibaba = rows.filter((r) => !!r.alibaba_url).length;
    const total = pending + approved + rejected;
    return { pending, approved, rejected, demand, withAlibaba, approvedPct: total > 0 ? Math.round((approved / total) * 100) : 0 };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (!showImageless) list = list.filter(hasImage);
    if (statusFilter === "has_alibaba") {
      list = list.filter((r) => !!r.alibaba_url);
    } else if (statusFilter !== "all") {
      list = list.filter((r) => (r.validation_status ?? "pending_review") === statusFilter);
    }
    if (marketFilter !== "all") list = list.filter((r) => (r.marketplace ?? "amazon_us") === marketFilter);
    if (minReviewsFilter > 0) list = list.filter((r) => (r.review_count ?? 0) >= minReviewsFilter);
    if (brandFilter === "branded") list = list.filter((r) => !!r.is_branded);
    else if (brandFilter === "generic") list = list.filter((r) => !r.is_branded);
    if (sortMode === "reviews_desc") {
      list = [...list].sort((a, b) => (b.review_count ?? -1) - (a.review_count ?? -1));
    } else {
      list = [...list].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    }
    return list;
  }, [rows, statusFilter, marketFilter, showImageless, minReviewsFilter, sortMode, brandFilter]);

  // Category demand aggregation — branded products count too (they prove category demand).
  const provenCategories = useMemo(() => {
    const map = new Map<string, { category: string; totalReviews: number; products: number; brandedProducts: number }>();
    for (const r of rows) {
      const cat = r.category ?? "uncategorised";
      const entry = map.get(cat) ?? { category: cat, totalReviews: 0, products: 0, brandedProducts: 0 };
      entry.totalReviews += r.review_count ?? 0;
      entry.products += 1;
      if (r.is_branded) entry.brandedProducts += 1;
      map.set(cat, entry);
    }
    return Array.from(map.values())
      .filter((e) => e.totalReviews > 0)
      .sort((a, b) => b.totalReviews - a.totalReviews)
      .slice(0, 15);
  }, [rows]);

  const hiddenImagelessCount = useMemo(() => rows.filter((r) => !hasImage(r)).length, [rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const blankForm = (): PriceForm => ({ alibaba_cost_zar: "", weight_kg: "", buffer_pct: String(DEFAULTS.buffer_pct), commission_pct: String(DEFAULTS.commission_pct), moq: "", member_min_buyin_zar: "", supplier_name: "", freight_override_zar: "", freight_air_zar: "", sa_selling_price_zar: "" });
  const setFormField = (id: string, k: keyof PriceForm, v: string) => {
    setForms((p) => ({ ...p, [id]: { ...(p[id] ?? blankForm()), [k]: v } }));
  };
  const getForm = (id: string): PriceForm => forms[id] ?? blankForm();

  // Load draft when form opens
  useEffect(() => {
    if (!openForm || !user?.id || draftLoaded[openForm]) return;
    (async () => {
      const { data } = await supabase
        .from("product_pricing_drafts" as any)
        .select("*")
        .eq("product_id", openForm)
        .eq("admin_user_id", user.id)
        .maybeSingle();
      if (data) {
        const d = data as any;
        const restored: PriceForm = {
          alibaba_cost_zar: d.alibaba_cost_zar ?? "",
          weight_kg: d.weight_kg ?? "",
          freight_override_zar: d.freight_override_zar ?? "",
          freight_air_zar: d.freight_air_zar ?? "",
          buffer_pct: d.buffer_pct ?? String(DEFAULTS.buffer_pct),
          commission_pct: d.commission_pct ?? String(DEFAULTS.commission_pct),
          moq: d.moq ?? "",
          member_min_buyin_zar: d.member_min_buyin_zar ?? "",
          supplier_name: d.supplier_name ?? "",
          sa_selling_price_zar: d.sa_selling_price_zar ?? "",
        };
        setForms((p) => ({ ...p, [openForm]: restored }));
        setRestoredNote((p) => ({ ...p, [openForm]: true }));
      }
      setDraftLoaded((p) => ({ ...p, [openForm]: true }));
    })();
  }, [openForm, user?.id]);

  // Debounced auto-save of form to draft
  useEffect(() => {
    if (!openForm || !user?.id || !draftLoaded[openForm]) return;
    const f = forms[openForm];
    if (!f) return;
    const isEmpty = !f.alibaba_cost_zar && !f.weight_kg && !f.freight_override_zar && !f.supplier_name
      && f.buffer_pct === String(DEFAULTS.buffer_pct) && f.commission_pct === String(DEFAULTS.commission_pct) && !f.moq && !f.member_min_buyin_zar;
    if (isEmpty) return;
    const t = setTimeout(() => {
      supabase.from("product_pricing_drafts" as any).upsert({
        product_id: openForm,
        admin_user_id: user.id,
        alibaba_cost_zar: f.alibaba_cost_zar || null,
        weight_kg: f.weight_kg || null,
        freight_override_zar: f.freight_override_zar || null,
        buffer_pct: f.buffer_pct || null,
        commission_pct: f.commission_pct || null,
        moq: f.moq || null,
        member_min_buyin_zar: f.member_min_buyin_zar || null,
        supplier_name: f.supplier_name || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "product_id,admin_user_id" }).then(({ error }) => {
        if (error) console.warn("draft save failed", error);
      });
    }, 600);
    return () => clearTimeout(t);
  }, [forms, openForm, user?.id, draftLoaded]);

  const deleteDraft = async (productId: string) => {
    if (!user?.id) return;
    await supabase.from("product_pricing_drafts" as any)
      .delete().eq("product_id", productId).eq("admin_user_id", user.id);
  };

  const clearDraft = async (productId: string) => {
    await deleteDraft(productId);
    setForms((p) => ({ ...p, [productId]: blankForm() }));
    setRestoredNote((p) => ({ ...p, [productId]: false }));
    toast({ title: "Draft cleared" });
  };

  const updateStatusOnly = async (id: string, status: ValidationStatus) => {
    setSaving(id);
    const { error } = await supabase.from("products" as any)
      .update({ validation_status: status, reviewed_at: new Date().toISOString() }).eq("id", id);
    setSaving(null);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, validation_status: status, reviewed_at: new Date().toISOString() } : r)));
    toast({ title: status === "rejected" ? "Rejected" : status === "demand_validated" ? "Marked as demand signal" : "Updated" });
  };

  const fetchCompetition = async (r: ProductRow) => {
    if (!r.asin) { toast({ title: "No ASIN on this row", variant: "destructive" }); return; }
    setEnriching(r.id);
    const { data, error } = await supabase.functions.invoke("enrich-product-rank", { body: { product_id: r.id } });
    setEnriching(null);
    if (error) { toast({ title: "Fetch failed", description: (error as any).message ?? String(error), variant: "destructive" }); return; }
    const res = Array.isArray((data as any)?.results) ? (data as any).results[0] : null;
    if (!res) { toast({ title: "No data returned", variant: "destructive" }); return; }
    setRows((prev) => prev.map((x) => x.id === r.id ? {
      ...x,
      sales_rank: res.sales_rank ?? x.sales_rank,
      sales_rank_category: res.sales_rank_category ?? x.sales_rank_category,
      seller_count: typeof res.seller_count === "number" ? res.seller_count : x.seller_count,
      seller_count_verified: typeof res.seller_count === "number" ? true : x.seller_count_verified,
      buybox_price: typeof res.buybox_price === "number" ? res.buybox_price : x.buybox_price,
      buybox_currency: res.buybox_currency ?? x.buybox_currency,
      image_url: res.image_url ?? x.image_url,
    } : x));
    const bits: string[] = [];
    if (res.sales_rank) bits.push(`BSR #${Number(res.sales_rank).toLocaleString()}`);
    if (typeof res.seller_count === "number") bits.push(`Sellers: ${res.seller_count}`);
    toast({ title: "Competition data fetched", description: bits.join(" • ") || "No BSR/sellers on listing" });
  };

  const publishAmazonSA = async (r: ProductRow) => {
    const f = getForm(r.id);
    const alibaba = parseFloat(f.alibaba_cost_zar);
    const weight = parseFloat(f.weight_kg);
    const buffer = parseFloat(f.buffer_pct);
    const commission = parseFloat(f.commission_pct);
    const moq = parseInt(f.moq);
    const memberMinBuyinRaw = f.member_min_buyin_zar.trim();
    const memberMinBuyin = memberMinBuyinRaw === "" ? null : parseFloat(memberMinBuyinRaw);

    // SA selling price: prefer explicit form value, then row.price_zar (SA rows), else required.
    const overrideSaRaw = f.sa_selling_price_zar.trim();
    const overrideSa = overrideSaRaw === "" ? null : parseFloat(overrideSaRaw);
    const saPrice = overrideSa != null && !isNaN(overrideSa) ? overrideSa : (r.price_zar != null ? Number(r.price_zar) : null);

    if (!alibaba || alibaba <= 0) { toast({ title: "Alibaba unit cost (ZAR) is required", variant: "destructive" }); return; }
    if (!weight || weight <= 0) { toast({ title: "Weight (kg) is required", variant: "destructive" }); return; }
    if (!moq || moq <= 0) { toast({ title: "Factory MOQ (units) is required", description: "Enter the real MOQ your factory requires (100, 500, 10000…).", variant: "destructive" }); return; }
    if (memberMinBuyin != null && (isNaN(memberMinBuyin) || memberMinBuyin < 0)) { toast({ title: "Member min buy-in must be a non-negative number", variant: "destructive" }); return; }
    if (saPrice == null || isNaN(saPrice) || saPrice <= 0) { toast({ title: "SA selling price (ZAR) is required", description: "Enter the target SA retail price for this product.", variant: "destructive" }); return; }

    const freightOverrideRaw = f.freight_override_zar.trim();
    const freightSeaOverride = freightOverrideRaw === "" ? null : parseFloat(freightOverrideRaw);
    if (freightSeaOverride != null && (isNaN(freightSeaOverride) || freightSeaOverride < 0)) {
      toast({ title: "Sea freight override must be a non-negative number", variant: "destructive" }); return;
    }
    const freightAirRaw = f.freight_air_zar.trim();
    const freightAirOverride = freightAirRaw === "" ? null : parseFloat(freightAirRaw);
    if (freightAirOverride != null && (isNaN(freightAirOverride) || freightAirOverride < 0)) {
      toast({ title: "Air freight must be a non-negative number", variant: "destructive" }); return;
    }
    const m = computeMargins({
      alibaba_cost_zar: alibaba, weight_kg: weight, buffer_pct: buffer, commission_pct: commission,
      price_zar: saPrice,
      freight_sea_override: freightSeaOverride,
      freight_air_override: freightAirOverride,
    });

    setSaving(r.id);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const row = {
      product_name: r.title,
      category: r.category,
      product_image_url: r.image_url,
      suggested_selling_price_zar: saPrice,
      unit_cost_zar: r2(m.landed_cost_zar),
      alibaba_cost_zar: alibaba,
      buffer_pct: buffer,
      // Legacy single-mode (mirror of sea)
      freight_cost_zar: r2(m.freight_cost_zar),
      freight_is_override: m.freight_is_override,
      umoja_commission_zar: r2(m.umoja_commission_zar),
      commission_pct: commission,
      landed_cost_zar: r2(m.landed_cost_zar),
      gross_margin_zar: r2(m.gross_margin_zar),
      expected_margin_percentage: r2(m.expected_margin_percentage),
      // Dual freight
      freight_sea_zar: r2(m.freight_sea_zar),
      landed_cost_sea_zar: r2(m.landed_cost_sea_zar),
      gross_margin_sea_zar: r2(m.gross_margin_sea_zar),
      margin_sea_pct: r2(m.margin_sea_pct),
      air_available: m.air_available,
      freight_air_zar: r2(m.freight_air_zar),
      landed_cost_air_zar: r2(m.landed_cost_air_zar),
      gross_margin_air_zar: r2(m.gross_margin_air_zar),
      margin_air_pct: r2(m.margin_air_pct),
      weight_kg: weight,
      moq_required: moq,
      member_min_buyin_zar: memberMinBuyin,
      supplier_name: f.supplier_name || "china_supplier",
      supplier_country: "CN",
      marketplace: "amazon_sa",
      source_product_url: r.product_url,
      is_spotlight: true,
      spotlight_title: `New: ${r.title ?? "Product"}`,
      group_buy_status: "open",
      stock_quantity: 99999,
      stock_available: 99999,
      is_approved_for_ai_recommendation: true,
    };

    const { data: pubData, error: insErr } = await supabase.functions.invoke("admin-publish-opportunity", { body: { row } });
    if (insErr || (pubData as any)?.error) {
      setSaving(null);
      const msg = (insErr as any)?.message || (pubData as any)?.error || "Publish failed";
      toast({ title: "Publish failed", description: msg, variant: "destructive" });
      return;
    }

    const { error: updErr } = await supabase.from("products" as any)
      .update({ validation_status: "approved_to_queue", reviewed_at: new Date().toISOString() }).eq("id", r.id);
    setSaving(null);
    if (updErr) { toast({ title: "Status update failed", description: updErr.message, variant: "destructive" }); return; }

    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, validation_status: "approved_to_queue", reviewed_at: new Date().toISOString() } : x)));
    await deleteDraft(r.id);
    setForms((p) => ({ ...p, [r.id]: blankForm() }));
    setRestoredNote((p) => ({ ...p, [r.id]: false }));
    setOpenForm(null);
    toast({ title: "Published to Browse", description: `Margin ${m.expected_margin_percentage.toFixed(1)}% • R${m.gross_margin_zar.toFixed(2)}/unit` });

    if (r.asin) {
      supabase.functions.invoke("enrich-product-rank", { body: { asin: r.asin } }).catch((e) => console.warn("enrich-product-rank failed", e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Product Validation — Marketplaces (Live)</h1>
          <p className="text-sm text-muted-foreground">All marketplaces (Amazon US, Amazon SA, Walmart US, Takealot SA) are approvable — add Alibaba cost + weight (+ SA selling price for non-SA rows) to publish to Browse. Gaps in the SA market are sourcing opportunities.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-semibold">{counts.pending}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Approved</p><p className="text-2xl font-semibold">{counts.approved}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Rejected</p><p className="text-2xl font-semibold">{counts.rejected}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Approved %</p><p className="text-2xl font-semibold">{counts.approvedPct}%</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Status:</span>
        {([
          ["all","All"],
          ["pending_review",`⏳ Pending (${counts.pending})`],
          ["approved_to_queue",`✅ Approved (${counts.approved})`],
          ["demand_validated",`📊 Demand signal (${counts.demand})`],
          ["has_alibaba",`🏭 Has Alibaba source (${counts.withAlibaba})`],
          ["rejected",`❌ Rejected (${counts.rejected})`],
        ] as [StatusFilter,string][]).map(([f,l])=>(
          <Button key={f} size="sm" variant={statusFilter===f?"default":"outline"} onClick={()=>setStatusFilter(f)}>{l}</Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">Marketplace:</span>
        {([["all","All"],["amazon_us","Amazon US"],["amazon_sa","Amazon SA"],["walmart_us","Walmart US"],["takealot_sa","Takealot SA"]] as [MarketFilter,string][]).map(([f,l])=>(
          <Button key={f} size="sm" variant={marketFilter===f?"default":"outline"} onClick={()=>setMarketFilter(f)}>{l}</Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">Min reviews:</span>
        {([[0,"All"],[100,"100+"],[500,"500+"],[1000,"1000+"]] as [MinReviewsFilter,string][]).map(([v,l])=>(
          <Button key={v} size="sm" variant={minReviewsFilter===v?"default":"outline"} onClick={()=>setMinReviewsFilter(v)}>{l}</Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">Brand:</span>
        {([["all","All"],["generic","Generic (sourceable)"],["branded","Branded (demand signal)"]] as [BrandFilter,string][]).map(([v,l])=>(
          <Button key={v} size="sm" variant={brandFilter===v?"default":"outline"} onClick={()=>setBrandFilter(v)}>{l}</Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">First seen:</span>
        {([[7,"7 days"],[30,"30 days"],[90,"90 days"],[0,"All time"]] as [RecencyFilter,string][]).map(([v,l])=>(
          <Button key={v} size="sm" variant={recencyFilter===v?"default":"outline"} onClick={()=>setRecencyFilter(v)}>{l}</Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">Sort:</span>
        {([["reviews_desc","Most reviews"],["newest","Newest"]] as [SortMode,string][]).map(([v,l])=>(
          <Button key={v} size="sm" variant={sortMode===v?"default":"outline"} onClick={()=>setSortMode(v)}>{l}</Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">Images:</span>
        <Button size="sm" variant={showImageless?"default":"outline"} onClick={()=>setShowImageless((v)=>!v)}>
          {showImageless ? `Showing items without images (${hiddenImagelessCount})` : `Hide items without images${hiddenImagelessCount?` (${hiddenImagelessCount} hidden)`:""}`}
        </Button>
      </div>

      {provenCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Proven categories — real SA demand (branded + generic reviews)</CardTitle>
            <p className="text-xs text-muted-foreground">Use this to decide which categories to source generic / private-label products into. Branded rows prove demand; source generic equivalents.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {provenCategories.map((c) => (
                <div key={c.category} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <span className="font-medium truncate mr-2">{c.category}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    <b>{c.totalReviews.toLocaleString()}</b> reviews · {c.products} products
                    {c.brandedProducts > 0 && <> · {c.brandedProducts} branded</>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
      : pageRows.length === 0 ? <p className="text-sm text-muted-foreground">No products match these filters.</p>
      : (
        <div className="space-y-4">
          {pageRows.map((r) => {
            const status = (r.validation_status ?? "pending_review") as ValidationStatus;
            const market = r.marketplace ?? "amazon_us";
            const isSA = SA_MARKETS.has(market);
            const cardTone =
              status === "approved_to_queue" ? "border-green-500/40 bg-green-500/5"
              : status === "rejected" ? "border-destructive/40 bg-destructive/5"
              : status === "demand_validated" ? "border-blue-500/40 bg-blue-500/5" : "";
            const f = getForm(r.id);
            const overrideSa = f.sa_selling_price_zar.trim() === "" ? null : parseFloat(f.sa_selling_price_zar);
            const effectiveSa = overrideSa != null && !isNaN(overrideSa) && overrideSa > 0
              ? overrideSa
              : (r.price_zar != null ? Number(r.price_zar) : null);
            const live = effectiveSa && parseFloat(f.alibaba_cost_zar) > 0 && parseFloat(f.weight_kg) > 0
              ? computeMargins({
                  alibaba_cost_zar: parseFloat(f.alibaba_cost_zar),
                  weight_kg: parseFloat(f.weight_kg),
                  buffer_pct: parseFloat(f.buffer_pct) || 0,
                  commission_pct: parseFloat(f.commission_pct) || 0,
                  price_zar: effectiveSa,
                  freight_sea_override: f.freight_override_zar.trim() === "" ? null : parseFloat(f.freight_override_zar),
                  freight_air_override: f.freight_air_zar.trim() === "" ? null : parseFloat(f.freight_air_zar),
                })
              : null;

            return (
              <Card key={r.id} className={cardTone}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="text-lg">{r.title ?? "(no title)"}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{MARKET_LABEL[market] ?? market}</Badge>
                      <DemandBadge reviews={r.review_count} marketplace={market} rank={r.sales_rank} rating={r.rating} daysSeen={r.days_seen} />
                      {r.is_branded && (
                        <Badge variant="outline" className="border-purple-400 text-purple-700 dark:text-purple-300">
                          🏷 {r.brand ?? "Branded"} — not sourceable
                        </Badge>
                      )}
                      <Badge variant={status==="approved_to_queue"?"default":status==="rejected"?"destructive":"secondary"}>
                        {status==="approved_to_queue"?"✅ Published":status==="rejected"?"❌ Rejected":status==="demand_validated"?"📊 Demand signal":"⏳ Pending"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4 flex-wrap">
                    <div className="w-32 h-32 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {r.image_url ? <img src={r.image_url} alt={r.title ?? ""} className="w-full h-full object-contain" /> : <ImageOff className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="space-y-2 flex-1 min-w-[220px]">
                      <Stars value={r.rating} />
                      {isSA
                        ? <p className="text-sm"><span className="text-muted-foreground">SA Price:</span> {r.price_zar != null ? `R${Number(r.price_zar).toFixed(2)}` : "—"}</p>
                        : <p className="text-sm"><span className="text-muted-foreground">Price (USD):</span> {r.price_usd != null ? `$${Number(r.price_usd).toFixed(2)}` : "—"}</p>}
                      {market === "takealot_sa" ? (
                        <>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Demand proxy (search rank):</span>{" "}
                            {r.sales_rank ? `#${r.sales_rank} in ${r.sales_rank_category ?? r.category ?? "category"}` : "—"}
                          </p>
                          <p className="text-sm"><span className="text-muted-foreground">Category:</span> {r.category ?? "—"}</p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Consistency:</span>{" "}
                            {r.days_seen != null && r.days_seen > 0
                              ? <><b>{r.days_seen}</b> day{r.days_seen === 1 ? "" : "s"} in top 10 · {r.times_seen ?? r.days_seen} scrape{(r.times_seen ?? 1) === 1 ? "" : "s"}</>
                              : "—"}
                          </p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Reviews (demand):</span>{" "}
                            {r.review_count != null && r.review_count > 0
                              ? <><b>{r.review_count.toLocaleString()}</b> review{r.review_count === 1 ? "" : "s"}</>
                              : "—"}
                          </p>
                          <p className="text-sm text-muted-foreground italic">Reviews / BSR / seller count: — (not provided by Takealot)</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm"><span className="text-muted-foreground">Reviews — demand proxy:</span> {r.review_count?.toLocaleString() ?? "—"}</p>
                          <p className="text-sm"><span className="text-muted-foreground">Category:</span> {r.category ?? "—"}</p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">BSR:</span>{" "}
                            {r.sales_rank ? `#${r.sales_rank.toLocaleString()}${r.sales_rank_category ? ` in ${r.sales_rank_category}` : ""}` : "—"}
                            <span className="text-muted-foreground ml-3">Sellers:</span>{" "}
                            {r.seller_count_verified && typeof r.seller_count === "number" ? r.seller_count.toLocaleString() : "—"}
                            {r.buybox_price != null && (
                              <>
                                <span className="text-muted-foreground ml-3">Buy-box:</span>{" "}
                                {r.buybox_currency === "ZAR" || isSA ? "R" : "$"}{Number(r.buybox_price).toFixed(2)}
                              </>
                            )}
                          </p>
                        </>
                      )}
                      {r.product_url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={r.product_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> View on {MARKET_LABEL[market]?.split(" ")[0] ?? "source"}</a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {!isSA && status === "pending_review" && r.price_zar == null && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">Non-SA source — enter an SA selling price in the form to publish as a sourcing opportunity.</p>
                  )}

                  {openForm === r.id && (
                    <div className="rounded border p-3 space-y-3 bg-muted/30">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium">Pricing & margin (Alibaba → landed cost)</p>
                        {restoredNote[r.id] && (
                          <span className="text-[11px] text-blue-600 dark:text-blue-400">Draft restored</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div><Label className="text-xs">Alibaba unit cost (ZAR) *</Label><Input type="number" step="0.01" value={f.alibaba_cost_zar} onChange={(e) => setFormField(r.id, "alibaba_cost_zar", e.target.value)} placeholder="e.g. 85" /></div>
                        <div><Label className="text-xs">Weight (kg) *</Label><Input type="number" step="0.01" value={f.weight_kg} onChange={(e) => setFormField(r.id, "weight_kg", e.target.value)} placeholder="e.g. 0.5" /></div>
                        <div><Label className="text-xs">Buffer %</Label><Input type="number" step="0.1" value={f.buffer_pct} onChange={(e) => setFormField(r.id, "buffer_pct", e.target.value)} /></div>
                        <div><Label className="text-xs">Commission %</Label><Input type="number" step="0.1" value={f.commission_pct} onChange={(e) => setFormField(r.id, "commission_pct", e.target.value)} /></div>
                        <div>
                          <Label className="text-xs">Factory MOQ (units) *</Label>
                          <Input type="number" min="1" value={f.moq} onChange={(e) => setFormField(r.id, "moq", e.target.value)} placeholder="Real factory MOQ (100, 500, 10000…)" />
                        </div>
                        <div>
                          <Label className="text-xs">Member min buy-in (ZAR)</Label>
                          <Input type="number" step="0.01" min="0" value={f.member_min_buyin_zar} onChange={(e) => setFormField(r.id, "member_min_buyin_zar", e.target.value)} placeholder={`Blank = global R${floors.minItemBuyinZar}`} />
                        </div>
                        <div className="md:col-span-2"><Label className="text-xs">Supplier / manufacturer</Label><Input value={f.supplier_name} onChange={(e) => setFormField(r.id, "supplier_name", e.target.value)} placeholder="optional" /></div>
                        <div className="md:col-span-3">
                          <Label className="text-xs">SA selling price (ZAR) {r.price_zar == null ? "*" : "— override"}</Label>
                          <Input
                            type="number" step="0.01" min="0"
                            value={f.sa_selling_price_zar}
                            onChange={(e) => setFormField(r.id, "sa_selling_price_zar", e.target.value)}
                            placeholder={r.price_zar != null ? `Blank = source R${Number(r.price_zar).toFixed(2)}` : "Required — target SA retail price"}
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {r.price_zar != null
                              ? "Blank = use the source SA price above. Override to set a different Browse price."
                              : "This is a non-SA source (sourcing opportunity) — enter the SA retail price you'll list at."}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">🚢 Sea freight per unit (ZAR) — override</Label>
                          <Input type="number" step="0.01" min="0" value={f.freight_override_zar} onChange={(e) => setFormField(r.id, "freight_override_zar", e.target.value)} placeholder="Blank = auto: (weight ÷ 200) × R8,800/CBM ≈ R44/kg. Enter a value to override." />
                          <p className="text-[11px] text-muted-foreground mt-1">Blank = volumetric estimate from weight (~4–6 weeks).</p>
                        </div>
                        <div>
                          <Label className="text-xs">✈️ Air freight per unit (ZAR)</Label>
                          <Input type="number" step="0.01" min="0" value={f.freight_air_zar} onChange={(e) => setFormField(r.id, "freight_air_zar", e.target.value)} placeholder="Blank = air not available" />
                          <p className="text-[11px] text-muted-foreground mt-1">Enter the real air-freight quote (~5–10 days). Blank means members only see sea.</p>
                        </div>
                      </div>
                      {live && (
                        <div className="text-xs pt-2 border-t space-y-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div><span className="text-muted-foreground">🚢 Sea freight{live.freight_is_override ? " (override)" : " (est.)"}: </span>R{live.freight_sea_zar.toFixed(2)}</div>
                            <div><span className="text-muted-foreground">Landed (sea): </span>R{live.landed_cost_sea_zar.toFixed(2)}</div>
                            <div className={live.gross_margin_sea_zar > 0 ? "text-green-600" : "text-destructive"}>
                              <span className="text-muted-foreground">Margin (sea): </span>R{live.gross_margin_sea_zar.toFixed(2)} ({live.margin_sea_pct.toFixed(1)}%)
                            </div>
                            <div className="text-muted-foreground">Commission (hidden): R{live.umoja_commission_zar.toFixed(2)}</div>
                          </div>
                          {live.air_available ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div><span className="text-muted-foreground">✈️ Air freight: </span>R{live.freight_air_zar.toFixed(2)}</div>
                              <div><span className="text-muted-foreground">Landed (air): </span>R{live.landed_cost_air_zar.toFixed(2)}</div>
                              <div className={live.gross_margin_air_zar > 0 ? "text-green-600" : "text-destructive"}>
                                <span className="text-muted-foreground">Margin (air): </span>R{live.gross_margin_air_zar.toFixed(2)} ({live.margin_air_pct.toFixed(1)}%)
                              </div>
                              <div></div>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">✈️ Air option hidden — members will only see Sea.</p>
                          )}
                          {(() => {
                            const factory = parseInt(f.moq);
                            if (!factory || factory <= 0) {
                              return <p className="text-amber-600 dark:text-amber-500 pt-1">Enter Factory MOQ to see viability (member units + members needed).</p>;
                            }
                            const memberMinRaw = f.member_min_buyin_zar.trim();
                            const memberMin = memberMinRaw === "" ? null : parseFloat(memberMinRaw);
                            const moqCalc = computeMemberMoq({
                              landedCostZar: live.landed_cost_sea_zar,
                              memberMinBuyinZar: memberMin,
                              factoryMoq: factory,
                              globalMinItem: floors.minItemBuyinZar,
                            });
                            return (
                              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 mt-1">
                                <p className="font-medium text-foreground">Viability preview</p>
                                <p className="text-muted-foreground mt-0.5">
                                  Each member buys min <span className="font-semibold text-foreground">{moqCalc.memberMoqUnits} units</span> (R{moqCalc.effectiveMinItem}).{" "}
                                  <span className="font-semibold text-foreground">{moqCalc.membersNeeded} members</span> needed to fill the factory order of {factory.toLocaleString()}.
                                </p>
                                {moqCalc.membersNeeded > 100 && (
                                  <p className="text-amber-600 dark:text-amber-500 mt-1">⚠️ High member count — consider raising the per-item floor to reduce members needed.</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => publishAmazonSA(r)} disabled={saving===r.id}>
                          <Check className="h-4 w-4 mr-1" /> Publish to Browse
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => clearDraft(r.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Clear draft
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setOpenForm(null)}>Close</Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {openForm !== r.id && status !== "approved_to_queue" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setOpenForm(r.id)}>
                        <Check className="h-4 w-4 mr-1" /> Approve & Price
                      </Button>
                    )}
                    {!isSA && status !== "demand_validated" && status !== "approved_to_queue" && openForm !== r.id && (
                      <Button size="sm" variant="secondary" onClick={() => updateStatusOnly(r.id, "demand_validated")} disabled={saving===r.id}>
                        📊 Mark as demand signal
                      </Button>
                    )}
                    {status !== "rejected" && (
                      <Button variant="destructive" size="sm" onClick={() => updateStatusOnly(r.id, "rejected")} disabled={saving===r.id}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    )}
                    {r.asin && (
                      <Button size="sm" variant="outline" onClick={() => fetchCompetition(r)} disabled={enriching===r.id} title="Rainforest type=product call (~$0.0035)">
                        {enriching===r.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Radar className="h-4 w-4 mr-1" />}
                        Fetch competition data
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setAlibabaFor({ id: r.id, title: r.title ?? "", image: r.image_url ?? null, priceLabel: isSA ? (r.price_zar != null ? `R${Number(r.price_zar).toFixed(2)}` : null) : (r.price_usd != null ? `$${Number(r.price_usd).toFixed(2)}` : null) })} title="1 Web Unlocker request">
                      <Search className="h-4 w-4 mr-1" /> Find on Alibaba
                    </Button>
                  </div>
                  {(r.alibaba_url || r.alibaba_moq != null || r.alibaba_supplier || r.alibaba_price) && (
                    <div className="rounded-lg border-2 border-green-500/40 bg-green-500/5 p-3 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                          🏭 Chosen Alibaba supplier
                          <Badge className="bg-green-600 text-white text-[10px]">SAVED</Badge>
                        </p>
                        {r.alibaba_url && (
                          <a
                            href={r.alibaba_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center h-8 px-3 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> View chosen supplier on Alibaba
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {r.alibaba_supplier && <Badge variant="secondary">🏭 {r.alibaba_supplier}</Badge>}
                        {r.alibaba_price && <Badge variant="outline">💵 {r.alibaba_price}</Badge>}
                        {r.alibaba_moq != null
                          ? <Badge variant="outline">📦 MOQ {r.alibaba_moq.toLocaleString()}</Badge>
                          : <Badge className="bg-amber-500 text-white">MOQ not captured — verify on link</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Click the button above to reopen the exact Alibaba listing you selected when it's time to place the order.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious onClick={(e)=>{e.preventDefault();setPage((p)=>Math.max(1,p-1));}} className={currentPage<=1?"pointer-events-none opacity-50":"cursor-pointer"} /></PaginationItem>
              <PaginationItem><span className="px-3 text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span></PaginationItem>
              <PaginationItem><PaginationNext onClick={(e)=>{e.preventDefault();setPage((p)=>Math.min(totalPages,p+1));}} className={currentPage>=totalPages?"pointer-events-none opacity-50":"cursor-pointer"} /></PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {alibabaFor && (
        <AlibabaSearchPanel
          open={!!alibabaFor}
          onOpenChange={(v) => !v && setAlibabaFor(null)}
          initialQuery={alibabaFor.title}
          originalImage={alibabaFor.image}
          originalName={alibabaFor.title}
          originalPriceLabel={alibabaFor.priceLabel}
          onSelect={(c) => handleAlibabaSelect(alibabaFor.id, c)}
        />
      )}
    </div>
  );
}
