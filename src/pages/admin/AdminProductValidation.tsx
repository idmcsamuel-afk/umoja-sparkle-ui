import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Check, X, ExternalLink, Star, RefreshCw, ImageOff } from "lucide-react";

type ValidationStatus = "pending_review" | "approved_to_queue" | "rejected";

interface ProductRow {
  id: string;
  title: string | null;
  asin: string | null;
  category: string | null;
  rating: number | null;
  review_count: number | null;
  price_usd: number | null;
  marketplace: string | null;
  product_url: string | null;
  image_url: string | null;
  validation_status: ValidationStatus | null;
  reviewed_at: string | null;
  created_at: string;
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

export default function AdminProductValidation() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_review");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [showImageless, setShowImageless] = useState(false);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("products" as any)
      .select("*")
      .gte("created_at", since)
      .order("review_count", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
    }
    setRows(((data ?? []) as unknown) as ProductRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [statusFilter, marketFilter]);

  const counts = useMemo(() => {
    const pending = rows.filter((r) => (r.validation_status ?? "pending_review") === "pending_review").length;
    const approved = rows.filter((r) => r.validation_status === "approved_to_queue").length;
    const rejected = rows.filter((r) => r.validation_status === "rejected").length;
    const total = pending + approved + rejected;
    return { pending, approved, rejected, approvedPct: total > 0 ? Math.round((approved / total) * 100) : 0 };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") list = list.filter((r) => (r.validation_status ?? "pending_review") === statusFilter);
    if (marketFilter !== "all") list = list.filter((r) => (r.marketplace ?? "amazon_us") === marketFilter);
    return list;
  }, [rows, statusFilter, marketFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateStatus = async (id: string, status: ValidationStatus) => {
    setSaving(id);
    const { error } = await supabase
      .from("products" as any)
      .update({ validation_status: status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, validation_status: status, reviewed_at: new Date().toISOString() } : r)));
    toast({ title: status === "approved_to_queue" ? "Approved" : status === "rejected" ? "Rejected" : "Updated" });

    // Auto-enrich sales_rank on approval (approved rows only).
    if (status === "approved_to_queue") {
      const row = rows.find((r) => r.id === id);
      if (row?.asin) {
        supabase.functions.invoke("enrich-product-rank", { body: { asin: row.asin } })
          .catch((e) => console.warn("enrich-product-rank failed", e));
      }
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Product Validation — Amazon (Live)</h1>
          <p className="text-sm text-muted-foreground">Real Amazon products discovered in the last 7 days.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
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
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pageRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products match these filters.</p>
      ) : (
        <div className="space-y-4">
          {pageRows.map((r) => {
            const status = (r.validation_status ?? "pending_review") as ValidationStatus;
            const market = r.marketplace ?? "amazon_us";
            const cardTone =
              status === "approved_to_queue" ? "border-green-500/40 bg-green-500/5"
              : status === "rejected" ? "border-destructive/40 bg-destructive/5" : "";
            return (
              <Card key={r.id} className={cardTone}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="text-lg">{r.title ?? "(no title)"}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{MARKET_LABEL[market] ?? market}</Badge>
                      <DemandBadge reviews={r.review_count} />
                      <Badge variant={status==="approved_to_queue"?"default":status==="rejected"?"destructive":"secondary"}>
                        {status==="approved_to_queue"?"✅ Approved":status==="rejected"?"❌ Rejected":"⏳ Pending"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4 flex-wrap">
                    <div className="w-32 h-32 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {r.image_url ? (
                        <img src={r.image_url} alt={r.title ?? ""} className="w-full h-full object-contain" />
                      ) : (
                        <ImageOff className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2 flex-1 min-w-[220px]">
                      <Stars value={r.rating} />
                      <p className="text-sm"><span className="text-muted-foreground">Price:</span> {r.price_usd != null ? `$${Number(r.price_usd).toFixed(2)}` : "—"}</p>
                      <p className="text-sm"><span className="text-muted-foreground">Reviews — demand proxy:</span> {r.review_count?.toLocaleString() ?? "—"}</p>
                      <p className="text-sm"><span className="text-muted-foreground">Category:</span> {r.category ?? "—"}</p>
                      {r.product_url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={r.product_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> View on {market === "walmart_us" ? "Walmart" : "Amazon"}
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => updateStatus(r.id, "approved_to_queue")} disabled={saving===r.id}>
                      <Check className="h-4 w-4 mr-1" /> Approve & Queue
                    </Button>
                    <Button variant="destructive" size="sm"
                      onClick={() => updateStatus(r.id, "rejected")} disabled={saving===r.id}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={(e)=>{e.preventDefault();setPage((p)=>Math.max(1,p-1));}}
                  className={currentPage<=1?"pointer-events-none opacity-50":"cursor-pointer"} />
              </PaginationItem>
              <PaginationItem><span className="px-3 text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span></PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={(e)=>{e.preventDefault();setPage((p)=>Math.min(totalPages,p+1));}}
                  className={currentPage>=totalPages?"pointer-events-none opacity-50":"cursor-pointer"} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
