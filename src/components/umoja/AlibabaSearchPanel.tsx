import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, Search, ImageOff, AlertTriangle, Star, Check } from "lucide-react";

export interface AlibabaCandidate {
  id: string;
  name: string;
  url: string;
  image: string | null;
  price_from: number | null;
  price_to: number | null;
  price_currency: string;
  price_label: string;
  moq: number | null;
  moq_unit: string | null;
  moq_found: boolean;
  supplier_name: string | null;
  supplier_url: string | null;
  supplier_rating: number | null;
  supplier_review_count: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialQuery: string;
  onSelect: (c: AlibabaCandidate) => void;
}

export function AlibabaSearchPanel({ open, onOpenChange, initialQuery, onSelect }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<AlibabaCandidate[] | null>(null);
  const [attempted, setAttempted] = useState<{ slug: string; status: number; found: number }[]>([]);

  const run = async (q: string) => {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setCandidates(null);
    setAttempted([]);
    const { data, error } = await supabase.functions.invoke("alibaba-search", { body: { query: term } });
    setLoading(false);
    if (error) {
      toast({ title: "Alibaba search failed", description: error.message, variant: "destructive" });
      return;
    }
    setCandidates(data?.candidates ?? []);
    setAttempted(data?.attempted ?? []);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v && candidates === null) run(initialQuery); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find on Alibaba</DialogTitle>
          <DialogDescription>
            1 Web Unlocker request per search · MOQ is best-effort — always open the Alibaba link to verify · Select the correct match manually.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product name or shorter search term" />
          <Button onClick={() => run(query)} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            Search
          </Button>
        </div>

        {attempted.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Tried: {attempted.map(a => `${a.slug} (HTTP ${a.status}, ${a.found} found)`).join(" · ")}
          </p>
        )}

        {loading && <p className="text-sm text-muted-foreground">Searching Alibaba…</p>}

        {!loading && candidates && candidates.length === 0 && (
          <div className="rounded border p-3 text-sm">
            <p className="font-medium">No results.</p>
            <p className="text-muted-foreground mt-1">Try a shorter, more generic search term (e.g. "crew neck tee" instead of full title).</p>
          </div>
        )}

        {!loading && candidates && candidates.length > 0 && (
          <div className="space-y-3">
            {candidates.map((c) => (
              <div key={c.id} className="rounded border p-3 flex gap-3">
                <div className="w-24 h-24 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {c.image ? <img src={c.image} alt="" className="w-full h-full object-contain" /> : <ImageOff className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm font-medium line-clamp-2">{c.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{c.price_label}</Badge>
                    {c.moq_found ? (
                      <Badge className="bg-green-600 text-white">MOQ {c.moq!.toLocaleString()}{c.moq_unit ? ` ${c.moq_unit}` : ""}</Badge>
                    ) : (
                      <Badge className="bg-amber-500 text-white inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> MOQ not found — check on Alibaba
                      </Badge>
                    )}
                    {c.supplier_name && <Badge variant="secondary">🏭 {c.supplier_name}</Badge>}
                    {c.supplier_rating != null && (
                      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {c.supplier_rating.toFixed(1)}
                        {c.supplier_review_count != null ? ` (${c.supplier_review_count.toLocaleString()})` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline">
                      <a href={c.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open on Alibaba
                      </a>
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { onSelect(c); onOpenChange(false); }}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Select this match
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
