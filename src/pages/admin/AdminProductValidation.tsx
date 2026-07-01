import { useEffect, useMemo, useState } from "react";
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
import { Check, X, ExternalLink, Star, RefreshCw, ImageOff, Trash2, Radar, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
}

type StatusFilter = "all" | "pending_review" | "approved_to_queue";
type MarketFilter = "all" | "amazon_us" | "amazon_sa" | "walmart_us";

const PAGE_SIZE = 5;
const MARKET_LABEL: Record<string, string> = {
  amazon_us: "Amazon US",
  amazon_sa: "Amazon SA",
  walmart_us: "Walmart US",
  amazon_uk: "Amazon UK",
  amazon_de: "Amazon DE",
};

const DEFAULTS = { buffer_pct: 10, commission_pct: 8, freight_rate_per_cbm: 8800, kg_per_cbm: 167 };

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

function DemandBadge({ reviews }: { reviews: number | null }) {
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
  supplier_name: string;
  freight_override_zar: string;   // sea override (legacy key retained)
  freight_air_zar: string;        // air override (blank = air unavailable)
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

export default function AdminProductValidation() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_review");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [showImageless, setShowImageless] = useState(false);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, PriceForm>>({});
  const [draftLoaded, setDraftLoaded] = useState<Record<string, boolean>>({});
  const [restoredNote, setRestoredNote] = useState<Record<string, boolean>>({});
  const [enriching, setEnriching] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("products" as any)
      .select("*")
      .gte("created_at", since)
      .order("review_count", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows(((data ?? []) as unknown) as ProductRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [statusFilter, marketFilter, showImageless]);

  const hasImage = (r: ProductRow) => typeof r.image_url === "string" && /^https?:\/\//i.test(r.image_url);

  const counts = useMemo(() => {
    const pending = rows.filter((r) => (r.validation_status ?? "pending_review") === "pending_review").length;
    const approved = rows.filter((r) => r.validation_status === "approved_to_queue").length;
    const rejected = rows.filter((r) => r.validation_status === "rejected").length;
    const total = pending + approved + rejected;
    return { pending, approved, rejected, approvedPct: total > 0 ? Math.round((approved / total) * 100) : 0 };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (!showImageless) list = list.filter(hasImage);
    if (statusFilter !== "all") list = list.filter((r) => (r.validation_status ?? "pending_review") === statusFilter);
    if (marketFilter !== "all") list = list.filter((r) => (r.marketplace ?? "amazon_us") === marketFilter);
    return list;
  }, [rows, statusFilter, marketFilter, showImageless]);

  const hiddenImagelessCount = useMemo(() => rows.filter((r) => !hasImage(r)).length, [rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const blankForm = (): PriceForm => ({ alibaba_cost_zar: "", weight_kg: "", buffer_pct: String(DEFAULTS.buffer_pct), commission_pct: String(DEFAULTS.commission_pct), moq: "100", supplier_name: "", freight_override_zar: "" });
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
          buffer_pct: d.buffer_pct ?? String(DEFAULTS.buffer_pct),
          commission_pct: d.commission_pct ?? String(DEFAULTS.commission_pct),
          moq: d.moq ?? "100",
          supplier_name: d.supplier_name ?? "",
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
      && f.buffer_pct === String(DEFAULTS.buffer_pct) && f.commission_pct === String(DEFAULTS.commission_pct) && f.moq === "100";
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
    const moq = parseInt(f.moq) || 100;
    if (!alibaba || alibaba <= 0) { toast({ title: "Alibaba unit cost (ZAR) is required", variant: "destructive" }); return; }
    if (!weight || weight <= 0) { toast({ title: "Weight (kg) is required", variant: "destructive" }); return; }
    if (!r.price_zar || r.price_zar <= 0) { toast({ title: "Missing SA selling price (price_zar) on source row", variant: "destructive" }); return; }

    const freightOverrideRaw = f.freight_override_zar.trim();
    const freightOverride = freightOverrideRaw === "" ? null : parseFloat(freightOverrideRaw);
    if (freightOverride != null && (isNaN(freightOverride) || freightOverride < 0)) {
      toast({ title: "Freight override must be a non-negative number", variant: "destructive" }); return;
    }
    const m = computeMargins({ alibaba_cost_zar: alibaba, weight_kg: weight, buffer_pct: buffer, commission_pct: commission, price_zar: Number(r.price_zar), freight_override_zar: freightOverride });

    setSaving(r.id);

    const row = {
      product_name: r.title,
      category: r.category,
      product_image_url: r.image_url,
      suggested_selling_price_zar: Number(r.price_zar),
      unit_cost_zar: Math.round(m.landed_cost_zar * 100) / 100,
      alibaba_cost_zar: alibaba,
      buffer_pct: buffer,
      freight_cost_zar: Math.round(m.freight_cost_zar * 100) / 100,
      freight_is_override: m.freight_is_override,
      umoja_commission_zar: Math.round(m.umoja_commission_zar * 100) / 100,
      commission_pct: commission,
      landed_cost_zar: Math.round(m.landed_cost_zar * 100) / 100,
      gross_margin_zar: Math.round(m.gross_margin_zar * 100) / 100,
      expected_margin_percentage: Math.round(m.expected_margin_percentage * 100) / 100,
      weight_kg: weight,
      moq_required: moq,
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
          <h1 className="text-2xl font-semibold">Product Validation — Amazon (Live)</h1>
          <p className="text-sm text-muted-foreground">Approve Amazon SA products with Alibaba cost + weight to publish to Browse. US/Walmart are demand signals only.</p>
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
        {([["all","All"],["pending_review","Pending"],["approved_to_queue","Approved"]] as [StatusFilter,string][]).map(([f,l])=>(
          <Button key={f} size="sm" variant={statusFilter===f?"default":"outline"} onClick={()=>setStatusFilter(f)}>{l}</Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">Marketplace:</span>
        {([["all","All"],["amazon_us","Amazon US"],["amazon_sa","Amazon SA"],["walmart_us","Walmart US"]] as [MarketFilter,string][]).map(([f,l])=>(
          <Button key={f} size="sm" variant={marketFilter===f?"default":"outline"} onClick={()=>setMarketFilter(f)}>{l}</Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">Images:</span>
        <Button size="sm" variant={showImageless?"default":"outline"} onClick={()=>setShowImageless((v)=>!v)}>
          {showImageless ? `Showing items without images (${hiddenImagelessCount})` : `Hide items without images${hiddenImagelessCount?` (${hiddenImagelessCount} hidden)`:""}`}
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
      : pageRows.length === 0 ? <p className="text-sm text-muted-foreground">No products match these filters.</p>
      : (
        <div className="space-y-4">
          {pageRows.map((r) => {
            const status = (r.validation_status ?? "pending_review") as ValidationStatus;
            const market = r.marketplace ?? "amazon_us";
            const isSA = market === "amazon_sa";
            const cardTone =
              status === "approved_to_queue" ? "border-green-500/40 bg-green-500/5"
              : status === "rejected" ? "border-destructive/40 bg-destructive/5"
              : status === "demand_validated" ? "border-blue-500/40 bg-blue-500/5" : "";
            const f = getForm(r.id);
            const live = isSA && r.price_zar && parseFloat(f.alibaba_cost_zar) > 0 && parseFloat(f.weight_kg) > 0
              ? computeMargins({
                  alibaba_cost_zar: parseFloat(f.alibaba_cost_zar),
                  weight_kg: parseFloat(f.weight_kg),
                  buffer_pct: parseFloat(f.buffer_pct) || 0,
                  commission_pct: parseFloat(f.commission_pct) || 0,
                  price_zar: Number(r.price_zar),
                  freight_override_zar: f.freight_override_zar.trim() === "" ? null : parseFloat(f.freight_override_zar),
                })
              : null;

            return (
              <Card key={r.id} className={cardTone}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="text-lg">{r.title ?? "(no title)"}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{MARKET_LABEL[market] ?? market}</Badge>
                      <DemandBadge reviews={r.review_count} />
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
                            {r.buybox_currency === "ZAR" || r.marketplace === "amazon_sa" ? "R" : "$"}{Number(r.buybox_price).toFixed(2)}
                          </>
                        )}
                      </p>
                      {r.product_url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={r.product_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> View on {market === "walmart_us" ? "Walmart" : "Amazon"}</a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {!isSA && status === "pending_review" && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">Demand signal only — needs SA selling price to publish.</p>
                  )}

                  {isSA && openForm === r.id && (
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
                        <div><Label className="text-xs">MOQ</Label><Input type="number" value={f.moq} onChange={(e) => setFormField(r.id, "moq", e.target.value)} /></div>
                        <div><Label className="text-xs">Supplier / manufacturer</Label><Input value={f.supplier_name} onChange={(e) => setFormField(r.id, "supplier_name", e.target.value)} placeholder="optional" /></div>
                      </div>
                      <div>
                        <Label className="text-xs">Freight cost per unit (ZAR) — override</Label>
                        <Input type="number" step="0.01" min="0" value={f.freight_override_zar} onChange={(e) => setFormField(r.id, "freight_override_zar", e.target.value)} placeholder="Leave blank to auto-estimate from weight" />
                        <p className="text-[11px] text-muted-foreground mt-1">Leave blank to auto-estimate from weight. Enter the real per-unit freight (e.g. Accio DDP/air-freight quote) for batteries/hazmat or any product with a known shipping cost.</p>
                      </div>
                      {live && (
                        <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t">
                          <div><span className="text-muted-foreground">Freight{live.freight_is_override ? " (override)" : ""}: </span>R{live.freight_cost_zar.toFixed(2)}</div>
                          <div><span className="text-muted-foreground">Commission: </span>R{live.umoja_commission_zar.toFixed(2)}</div>
                          <div><span className="text-muted-foreground">Landed: </span>R{live.landed_cost_zar.toFixed(2)}</div>
                          <div className={live.gross_margin_zar > 0 ? "text-green-600" : "text-destructive"}>
                            <span className="text-muted-foreground">Margin: </span>R{live.gross_margin_zar.toFixed(2)} ({live.expected_margin_percentage.toFixed(1)}%)
                          </div>
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
                    {isSA ? (
                      openForm !== r.id && status !== "approved_to_queue" && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setOpenForm(r.id)}>
                          <Check className="h-4 w-4 mr-1" /> Approve & Price
                        </Button>
                      )
                    ) : (
                      status !== "demand_validated" && status !== "approved_to_queue" && (
                        <Button size="sm" variant="secondary" onClick={() => updateStatusOnly(r.id, "demand_validated")} disabled={saving===r.id}>
                          📊 Mark as demand signal
                        </Button>
                      )
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
                  </div>
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
    </div>
  );
}
