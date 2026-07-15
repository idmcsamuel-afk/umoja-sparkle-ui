import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, Search, ImageOff, AlertTriangle, Star, Check, Sparkles } from "lucide-react";

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
  matched_query?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialQuery: string;
  originalImage?: string | null;
  originalName?: string | null;
  originalPriceLabel?: string | null;
  onSelect: (c: AlibabaCandidate) => void;
}

const absUrl = (u: string) => {
  if (!u) return u;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return "https://www.alibaba.com" + u;
  return u;
};

// Words that don't help identify a product on Alibaba — strip them.
// NOTE: "set", "kit", "pack" are KEPT — they're core product nouns
// ("luggage set", "tool kit", "6-pack").
const STOPWORDS = new Set<string>([
  "the","a","an","and","or","of","for","with","in","on","to","from","by","at","this","that",
  "vintage","professional","premium","deluxe","luxury","new","hot","sale","top","best","quality","high",
  "super","ultra","mini","portable","household","home","house","use","using","waterproof","wireless",
  "rechargeable","usb","powered","power","english","cordless","corded","smart","auto","automatic","manual",
  "men","mens","women","womens","kids","boys","girls","unisex","adult","adults","baby","child","children",
  "piece","pieces","pcs","pc","model","style","series","size","large","small","medium","xl",
  "color","colour","black","white","red","blue","green","pink","gold","silver","gray","grey","brown",
  "buy","cheap","free","shipping","brand","genuine","original","official","case","cover","accessory","accessories",
  "type","edition","version","gen",
  "hard","soft","outer","inner",
]);

// e.g. "IPX6", "IP67", "2000mah", "5g", "16gb"
const RE_MODEL_TOKEN = /^(ipx?\d+|ip\d{2,}|\d+[a-z]{1,4}|[a-z]{1,3}\d+[a-z]*)$/i;

function pluralize(word: string): string {
  if (/(s|x|z|ch|sh)$/.test(word)) return word + "es";
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
  if (!word.endsWith("s")) return word + "s";
  return word;
}

function extractSmartKeywords(title: string): { primary: string; variants: string[] } {
  if (!title) return { primary: "", variants: [] };
  const cleaned = title
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-zA-Z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const rawWords = cleaned.split(" ");
  const words: string[] = [];
  for (const w of rawWords) {
    const lw = w.toLowerCase();
    if (!lw) continue;
    if (STOPWORDS.has(lw)) continue;
    if (RE_MODEL_TOKEN.test(lw)) continue;
    if (lw.length <= 1) continue;
    words.push(lw);
  }
  // primary = last 2 meaningful words (product noun tends to be at the end,
  // e.g. "luggage set", "hair clipper").
  const last2 = words.slice(-2).join(" ");
  const last1 = words[words.length - 1] || "";
  const primary = last2 || last1 || words[0] || title;

  const variants: string[] = [];
  const add = (s: string) => {
    const t = s.trim();
    if (t && t !== primary && !variants.includes(t) && t.split(" ").length <= 4) variants.push(t);
  };
  // pluralized primary ("luggage set" -> "luggage sets") — often the canonical slug
  const parts = primary.split(" ").filter(Boolean);
  if (parts.length) add([...parts.slice(0, -1), pluralize(parts[parts.length - 1])].join(" "));
  add(last1);
  return { primary, variants: variants.slice(0, 3) };
}

export function AlibabaSearchPanel({ open, onOpenChange, initialQuery, originalImage, originalName, originalPriceLabel, onSelect }: Props) {
  const smart = useMemo(() => extractSmartKeywords(initialQuery), [initialQuery]);
  const [query, setQuery] = useState(smart.primary || initialQuery);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<AlibabaCandidate[] | null>(null);
  const [attempted, setAttempted] = useState<{ query: string; slug: string; page: number; status: number; found: number }[]>([]);
  const [unlockerRequests, setUnlockerRequests] = useState(0);
  const [usedQueries, setUsedQueries] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    setQuery(smart.primary || initialQuery);
    setCandidates(null);
    setAttempted([]);
    setUnlockerRequests(0);
    setUsedQueries([]);
    setHasSearched(false);
  }, [initialQuery, smart.primary]);


  const run = async (q: string, opts?: { includeVariants?: boolean }) => {
    const term = q.trim();
    if (!term) return;
    const queries = opts?.includeVariants
      ? [term, ...smart.variants.filter((v) => v && v !== term)]
      : [term];
    setLoading(true);
    setCandidates(null);
    setAttempted([]);
    setUnlockerRequests(0);
    setUsedQueries(queries);
    setHasSearched(true);
    const { data, error } = await supabase.functions.invoke("alibaba-search", {
      body: { queries, pages: 3, target: 40 },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Alibaba search failed", description: error.message, variant: "destructive" });
      return;
    }
    setCandidates(data?.candidates ?? []);
    setAttempted(data?.attempted ?? []);
    setUnlockerRequests(data?.unlocker_requests ?? 0);
  };

  // Auto-run search when the panel opens (parent mounts it with open=true,
  // so the Dialog's own onOpenChange never fires for the initial open).
  useEffect(() => {
    if (open && !hasSearched && !loading) {
      run(smart.primary || initialQuery, { includeVariants: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, smart.primary, initialQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find on Alibaba</DialogTitle>
          <DialogDescription>
            Searches up to 3 pages per keyword (≈1 Web Unlocker request per page). MOQ best-effort — verify via link. Select the correct match manually.
          </DialogDescription>
        </DialogHeader>

        {(originalImage || originalName) && (
          <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 flex gap-3 sticky top-0 z-10">
            <div className="w-24 h-24 rounded bg-background flex items-center justify-center overflow-hidden shrink-0 border">
              {originalImage ? <img src={originalImage} alt="" className="w-full h-full object-contain" /> : <ImageOff className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <Badge className="mb-1">Original product (Takealot)</Badge>
              <p className="text-sm font-medium line-clamp-2">{originalName}</p>
              {originalPriceLabel && <p className="text-xs text-muted-foreground mt-1">SA price: <span className="font-semibold text-foreground">{originalPriceLabel}</span></p>}
              <p className="text-[11px] text-muted-foreground mt-1">Compare each Alibaba candidate below against this image.</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Auto keyword: <span className="font-medium text-foreground">"{smart.primary}"</span></span>
            {smart.variants.length > 0 && (
              <span className="hidden sm:inline">· variants: {smart.variants.map(v => `"${v}"`).join(", ")}</span>
            )}
            <button
              type="button"
              className="ml-auto underline hover:text-foreground"
              onClick={() => setQuery(smart.primary)}
            >
              reset
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Type your own search e.g. "hair clipper"'
              onKeyDown={(e) => { if (e.key === "Enter") run(query, { includeVariants: false }); }}
            />
            <Button onClick={() => run(query, { includeVariants: false })} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Search
            </Button>
            {smart.variants.length > 0 && (
              <Button
                variant="outline"
                onClick={() => run(query, { includeVariants: true })}
                disabled={loading || !query.trim()}
                title="Search this term plus auto-generated variants and merge results"
              >
                + variants
              </Button>
            )}
          </div>
        </div>

        {(usedQueries.length > 0 || attempted.length > 0) && (
          <p className="text-[11px] text-muted-foreground">
            Searched: {usedQueries.map(q => `"${q}"`).join(", ")} · {unlockerRequests} Unlocker request{unlockerRequests === 1 ? "" : "s"} · {candidates?.length ?? 0} results
          </p>
        )}

        {loading && <p className="text-sm text-muted-foreground">Searching Alibaba (up to 3 pages per keyword)…</p>}

        {!loading && candidates && candidates.length === 0 && (
          <div className="rounded border p-3 text-sm">
            <p className="font-medium">No results.</p>
            <p className="text-muted-foreground mt-1">Try a shorter, more generic search term (e.g. "hair clipper" instead of the full title).</p>
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
                    {c.matched_query && <span className="text-muted-foreground">· via "{c.matched_query}"</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={absUrl(c.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open on Alibaba
                    </a>
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
