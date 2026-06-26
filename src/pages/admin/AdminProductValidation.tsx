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
import { Check, X, ExternalLink, Star, RefreshCw, ImageOff } from "lucide-react";

type ValidationStatus = "pending_review" | "urls_verified" | "approved_to_queue" | "rejected";

interface ProductRow {
  id: number;
  product_name: string;
  amazon_product_url: string | null;
  amazon_rating: number | null;
  amazon_reviews_count: number | null;
  data_validation_status: ValidationStatus | null;
  validation_notes: string | null;
  source: string | null;
}

type StatusFilter = "all" | "pending_review" | "approved_to_queue";
type RatingFilter = "all" | "4.5" | "4.0";

const PAGE_SIZE = 5;

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground text-xs">No rating</span>;
  const v = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value.toFixed(1)}</span>
    </span>
  );
}

type NotesShape = {
  product_image_url?: string;
  supplier_name?: string;
  monthly_sales_count?: number | null;
  [k: string]: unknown;
};

function parseNotes(notes: string | null): NotesShape {
  if (!notes) return {};
  try {
    const obj = JSON.parse(notes);
    if (obj && typeof obj === "object") return obj as NotesShape;
  } catch {
    // not JSON
  }
  return {};
}

function DemandBadge({ count }: { count: number | null | undefined }) {
  if (count == null || Number.isNaN(count)) {
    return <Badge variant="outline" className="bg-muted text-muted-foreground">PENDING DATA</Badge>;
  }
  if (count >= 1000) {
    return <Badge className="bg-green-600 hover:bg-green-700 text-white">HIGH DEMAND</Badge>;
  }
  if (count >= 500) {
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">MEDIUM DEMAND</Badge>;
  }
  return <Badge className="bg-red-600 hover:bg-red-700 text-white">LOW DEMAND</Badge>;
}

export default function AdminProductValidation() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_review");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<number | null>(null);
  const [salesDrafts, setSalesDrafts] = useState<Record<number, string>>({});
  const [counts, setCounts] = useState({ pending: 0, approved: 0, withSales: 0 });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_discovery")
      .select("*")
      .eq("source", "china_api")
      .limit(500);
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
    }
    const all = (data ?? []) as unknown as ProductRow[];

    // Sort by monthly_sales_count DESC, NULL last
    const sorted = [...all].sort((a, b) => {
      const aSales = parseNotes(a.validation_notes).monthly_sales_count;
      const bSales = parseNotes(b.validation_notes).monthly_sales_count;
      const aVal = typeof aSales === "number" ? aSales : null;
      const bVal = typeof bSales === "number" ? bSales : null;
      if (aVal == null && bVal == null) return (b.amazon_rating ?? 0) - (a.amazon_rating ?? 0);
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return bVal - aVal;
    });
    setRows(sorted);

    const pending = all.filter((r) => (r.data_validation_status ?? "pending_review") === "pending_review").length;
    const approved = all.filter((r) => r.data_validation_status === "approved_to_queue").length;
    const withSales = all.filter((r) => typeof parseNotes(r.validation_notes).monthly_sales_count === "number").length;
    setCounts({ pending, approved, withSales });

    // Seed drafts from notes
    const drafts: Record<number, string> = {};
    for (const r of all) {
      const s = parseNotes(r.validation_notes).monthly_sales_count;
      if (typeof s === "number") drafts[r.id] = String(s);
    }
    setSalesDrafts(drafts);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, ratingFilter]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((r) => (r.data_validation_status ?? "pending_review") === statusFilter);
    }
    if (ratingFilter !== "all") {
      const min = parseFloat(ratingFilter);
      list = list.filter((r) => (r.amazon_rating ?? 0) >= min);
    }
    return list;
  }, [rows, statusFilter, ratingFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalValidated = counts.pending + counts.approved;
  const approvedPct = totalValidated > 0 ? Math.round((counts.approved / totalValidated) * 100) : 0;

  const updateStatus = async (id: number, status: ValidationStatus) => {
    setSaving(id);
    const { error } = await supabase
      .from("product_discovery")
      .update({ data_validation_status: status })
      .eq("id", id);
    setSaving(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, data_validation_status: status } : r)));
    setCounts((prev) => {
      const next = { ...prev };
      const before = rows.find((r) => r.id === id)?.data_validation_status ?? "pending_review";
      if (before === "pending_review") next.pending = Math.max(0, next.pending - 1);
      if (before === "approved_to_queue") next.approved = Math.max(0, next.approved - 1);
      if (status === "pending_review") next.pending += 1;
      if (status === "approved_to_queue") next.approved += 1;
      return next;
    });
    toast({
      title: status === "approved_to_queue" ? "Product approved" : status === "rejected" ? "Product rejected" : "Updated",
    });
  };

  const saveMonthlySales = async (row: ProductRow) => {
    const raw = salesDrafts[row.id]?.trim() ?? "";
    const existing = parseNotes(row.validation_notes);
    const existingVal = existing.monthly_sales_count;

    let newVal: number | null = null;
    if (raw === "") {
      newVal = null;
    } else {
      const parsed = Number(raw.replace(/[, ]/g, ""));
      if (Number.isNaN(parsed) || parsed < 0) {
        toast({ title: "Invalid number", description: "Enter a positive number.", variant: "destructive" });
        return;
      }
      newVal = Math.floor(parsed);
    }

    // No-op if unchanged
    const prevVal = typeof existingVal === "number" ? existingVal : null;
    if (prevVal === newVal) return;

    const nextNotes: NotesShape = { ...existing, monthly_sales_count: newVal };
    const { error } = await supabase
      .from("product_discovery")
      .update({ validation_notes: JSON.stringify(nextNotes) })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, validation_notes: JSON.stringify(nextNotes) } : r)),
    );
    setCounts((prev) => {
      const hadSales = typeof prevVal === "number";
      const hasSales = typeof newVal === "number";
      let withSales = prev.withSales;
      if (!hadSales && hasSales) withSales += 1;
      if (hadSales && !hasSales) withSales = Math.max(0, withSales - 1);
      return { ...prev, withSales };
    });
    toast({ title: "Monthly sales saved" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Product Validation — Amazon</h1>
          <p className="text-sm text-muted-foreground">
            Review Amazon products discovered for queueing.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Total pending</p>
            <p className="text-2xl font-semibold">{counts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Total approved</p>
            <p className="text-2xl font-semibold">{counts.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Approved %</p>
            <p className="text-2xl font-semibold">{approvedPct}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">With sales data</p>
            <p className="text-2xl font-semibold">{counts.withSales}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Status:</span>
        {([
          ["all", "All"],
          ["pending_review", "Pending"],
          ["approved_to_queue", "Approved"],
        ] as [StatusFilter, string][]).map(([f, label]) => (
          <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"} onClick={() => setStatusFilter(f)}>
            {label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">Rating:</span>
        {([
          ["all", "All"],
          ["4.5", "4.5+"],
          ["4.0", "4.0+"],
        ] as [RatingFilter, string][]).map(([f, label]) => (
          <Button key={f} size="sm" variant={ratingFilter === f ? "default" : "outline"} onClick={() => setRatingFilter(f)}>
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pageRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products match these filters.</p>
      ) : (
        <div className="space-y-4">
          {pageRows.map((r) => {
            const status = (r.data_validation_status ?? "pending_review") as ValidationStatus;
            const notes = parseNotes(r.validation_notes);
            const image = notes.product_image_url;
            const supplier = notes.supplier_name ?? "Amazon";
            const salesVal = typeof notes.monthly_sales_count === "number" ? notes.monthly_sales_count : null;
            const cardTone =
              status === "approved_to_queue"
                ? "border-green-500/40 bg-green-500/5"
                : status === "rejected"
                ? "border-destructive/40 bg-destructive/5"
                : "";
            return (
              <Card key={r.id} className={cardTone}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="text-lg">{r.product_name}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <DemandBadge count={salesVal} />
                      <Badge
                        variant={
                          status === "approved_to_queue"
                            ? "default"
                            : status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {status === "approved_to_queue"
                          ? "✅ Approved"
                          : status === "rejected"
                          ? "❌ Rejected"
                          : "⏳ Pending"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4 flex-wrap">
                    <div className="w-32 h-32 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {image ? (
                        <img src={image} alt={r.product_name} className="w-full h-full object-contain" />
                      ) : (
                        <ImageOff className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2 flex-1 min-w-[220px]">
                      <Stars value={r.amazon_rating} />
                      {r.amazon_reviews_count != null && (
                        <p className="text-xs text-muted-foreground">
                          {r.amazon_reviews_count.toLocaleString()} reviews
                        </p>
                      )}
                      <p className="text-sm">
                        <span className="text-muted-foreground">Supplier:</span> {supplier}
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Monthly sales:</span>{" "}
                        {salesVal != null ? `${salesVal.toLocaleString()}/month` : "—"}
                      </p>
                      {r.amazon_product_url && (
                        <a
                          href={r.amazon_product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> 🔗 View on Amazon
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="max-w-xs">
                    <Label htmlFor={`sales-${r.id}`} className="text-xs">
                      Monthly Sales/Month
                    </Label>
                    <Input
                      id={`sales-${r.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="e.g., 15000"
                      value={salesDrafts[r.id] ?? ""}
                      onChange={(e) =>
                        setSalesDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      onBlur={() => saveMonthlySales(r)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => updateStatus(r.id, "approved_to_queue")}
                      disabled={saving === r.id}
                    >
                      <Check className="h-4 w-4 mr-1" /> ✅ Approve & Queue
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => updateStatus(r.id, "rejected")}
                      disabled={saving === r.id}
                    >
                      <X className="h-4 w-4 mr-1" /> ❌ Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                  className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
