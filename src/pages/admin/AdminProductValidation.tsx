import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, X, Pause, ExternalLink, Copy, Star, RefreshCw } from "lucide-react";

type ValidationStatus = "pending_review" | "urls_verified" | "approved_to_queue" | "rejected";

interface ProductRow {
  id: number;
  product_name: string;
  category: string | null;
  estimated_margin_pct: number | null;
  demand_score: number | null;
  china_api_price_zar: number | null;
  alibaba_product_url: string | null;
  alibaba_supplier_name: string | null;
  alibaba_supplier_rating: number | null;
  amazon_price_zar: number | null;
  amazon_product_url: string | null;
  amazon_rating: number | null;
  amazon_reviews_count: number | null;
  takealot_price_zar: number | null;
  takealot_product_url: string | null;
  takealot_rating: number | null;
  takealot_reviews_count: number | null;
  data_validation_status: ValidationStatus | null;
  validation_notes: string | null;
  status: string | null;
}

type Filter = "all" | "pending_review" | "urls_verified" | "approved_to_queue";
type Sort = "newest" | "margin" | "reviews";

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground text-xs">n/a</span>;
  const v = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value.toFixed(1)}</span>
    </span>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied" });
  };
  if (!url) return <span className="text-xs text-muted-foreground">No {label} link</span>;
  return (
    <div className="flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <ExternalLink className="h-3 w-3" /> View on {label}
      </a>
      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copy}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function AdminProductValidation() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending_review");
  const [sort, setSort] = useState<Sort>("newest");
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_discovery")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
    }
    setRows((data ?? []) as unknown as ProductRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter !== "all") list = list.filter((r) => (r.data_validation_status ?? "pending_review") === filter);
    if (sort === "margin") list = [...list].sort((a, b) => (b.estimated_margin_pct ?? 0) - (a.estimated_margin_pct ?? 0));
    else if (sort === "reviews") list = [...list].sort((a, b) => (b.amazon_reviews_count ?? 0) - (a.amazon_reviews_count ?? 0));
    return list;
  }, [rows, filter, sort]);

  const counts = useMemo(() => {
    const c = { approved: 0, pending: 0, rejected: 0, verified: 0 };
    for (const r of rows) {
      const s = r.data_validation_status ?? "pending_review";
      if (s === "approved_to_queue") c.approved++;
      else if (s === "rejected") c.rejected++;
      else if (s === "urls_verified") c.verified++;
      else c.pending++;
    }
    return c;
  }, [rows]);

  const updateStatus = async (id: string, status: ValidationStatus, notes?: string) => {
    setSaving(id);
    const payload: { data_validation_status: string; validation_notes?: string } = {
      data_validation_status: status,
    };
    if (typeof notes === "string") payload.validation_notes = notes;
    const { error } = await supabase.from("product_discovery").update(payload).eq("id", id);
    setSaving(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...payload } as ProductRow) : r)));
    toast({ title: status === "approved_to_queue" ? "Approved & queued" : status === "rejected" ? "Rejected" : "Saved" });
  };

  const saveNotes = async (id: string) => {
    const notes = notesDraft[id] ?? "";
    await updateStatus(id, (rows.find((r) => r.id === id)?.data_validation_status ?? "pending_review") as ValidationStatus, notes);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Product Validation Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Validating {counts.approved + counts.verified} of {rows.length} products
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Filter:</span>
        {(["all", "pending_review", "urls_verified", "approved_to_queue"] as Filter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "pending_review" ? "Pending Review" : f === "urls_verified" ? "Verified" : "Approved"}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-4 mr-1">Sort:</span>
        {(["newest", "margin", "reviews"] as Sort[]).map((s) => (
          <Button key={s} size="sm" variant={sort === s ? "default" : "outline"} onClick={() => setSort(s)}>
            {s === "newest" ? "Newest" : s === "margin" ? "Highest Margin" : "Most Reviews"}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products match this filter.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const status = (r.data_validation_status ?? "pending_review") as ValidationStatus;
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
                    <div>
                      <CardTitle className="text-lg">{r.product_name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Category: {r.category ?? "—"} · Margin: {r.estimated_margin_pct ?? 0}% · Demand: {r.demand_score ?? 0}/10
                      </p>
                    </div>
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
                        : status === "urls_verified"
                        ? "🔗 Verified"
                        : "⏳ Pending"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      📊 Price Comparison
                    </p>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="rounded border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">Alibaba</p>
                        <p className="font-medium">R{Number(r.china_api_price_zar ?? 0).toFixed(2)}</p>
                        <p className="text-xs">
                          Supplier: {r.alibaba_supplier_name ?? "—"}
                        </p>
                        <Stars value={r.alibaba_supplier_rating} />
                        <LinkRow label="Alibaba" url={r.alibaba_product_url} />
                      </div>
                      <div className="rounded border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">Amazon</p>
                        <p className="font-medium">
                          {r.amazon_price_zar != null ? `R${Number(r.amazon_price_zar).toFixed(2)}` : "—"}
                        </p>
                        <Stars value={r.amazon_rating} />
                        <p className="text-xs text-muted-foreground">
                          {r.amazon_reviews_count?.toLocaleString() ?? 0} reviews
                        </p>
                        <LinkRow label="Amazon" url={r.amazon_product_url} />
                      </div>
                      <div className="rounded border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">Takealot</p>
                        <p className="font-medium">
                          {r.takealot_price_zar != null ? `R${Number(r.takealot_price_zar).toFixed(2)}` : "—"}
                        </p>
                        <Stars value={r.takealot_rating} />
                        <p className="text-xs text-muted-foreground">
                          {r.takealot_reviews_count?.toLocaleString() ?? 0} reviews
                        </p>
                        <LinkRow label="Takealot" url={r.takealot_product_url} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      📝 Validation Notes
                    </p>
                    <Textarea
                      placeholder="e.g. Prices match across all platforms. Strong demand signal."
                      defaultValue={r.validation_notes ?? ""}
                      onChange={(e) => setNotesDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                      rows={2}
                    />
                    <div className="mt-2">
                      <Button size="sm" variant="ghost" onClick={() => saveNotes(r.id)} disabled={saving === r.id}>
                        Save notes
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const reason = window.prompt("Why reject? (optional)") ?? undefined;
                        updateStatus(r.id, "rejected", reason);
                      }}
                      disabled={saving === r.id}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(r.id, "pending_review", notesDraft[r.id])}
                      disabled={saving === r.id}
                    >
                      <Pause className="h-4 w-4 mr-1" /> Skip For Later
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => updateStatus(r.id, "approved_to_queue", notesDraft[r.id])}
                      disabled={saving === r.id}
                    >
                      <Check className="h-4 w-4 mr-1" /> Approve & Queue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            ✅ {counts.approved} Approved · 🔗 {counts.verified} Verified · ⏳ {counts.pending} Pending · ❌ {counts.rejected} Rejected
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
