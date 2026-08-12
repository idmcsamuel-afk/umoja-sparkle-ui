import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Building2, Clock, CalendarClock, ExternalLink, Loader2, Flame, Lock, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import SparkBalanceChip from "@/components/umoja/SparkBalanceChip";

import {
  type TenderRow, displayTitle, closingLabel, isUrgent, isClosed,
  formatDate, formatTenderValue, PROVINCES, ETENDERS_HOME,
} from "@/lib/tenders";

const PAGE_SIZE = 25;

export default function Tenders() {
  const [rows, setRows] = useState<TenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("all");
  const [openOnly, setOpenOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [intentCounts, setIntentCounts] = useState<
    Record<string, { pursuing: number; open: number }>
  >({});

  // debounce the free-text search
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("tenders")
        .select(
          "id, ocid, title, description, buyer_name, province, delivery_location, category, procurement_method, status, value_amount, value_currency, published_at, closing_at, source_url",
          { count: "exact" },
        );

      if (province !== "all") q = q.eq("province", province);
      if (openOnly) q = q.gte("closing_at", new Date().toISOString());
      if (query) {
        const like = `%${query}%`;
        q = q.or(
          `description.ilike.${like},title.ilike.${like},buyer_name.ilike.${like},delivery_location.ilike.${like},category.ilike.${like}`,
        );
      }

      const { data, count, error } = await q
        .order("closing_at", { ascending: true, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (cancelled) return;
      if (error) console.error("tenders query failed:", error.message);
      setRows((data as TenderRow[]) ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [query, province, openOnly, page]);

  // community "pursuing" signal for the visible page (counts only, no identities)
  useEffect(() => {
    if (rows.length === 0) { setIntentCounts({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("tender_intent_counts", {
        p_tender_ids: rows.map((r) => r.id),
      });
      if (cancelled) return;
      const map: Record<string, { pursuing: number; open: number }> = {};
      for (const c of (data as { tender_id: string; pursuing_count: number; open_to_partner_count: number }[] | null) ?? []) {
        map[c.tender_id] = { pursuing: c.pursuing_count, open: c.open_to_partner_count };
      }
      setIntentCounts(map);
    })();
    return () => { cancelled = true; };
  }, [rows]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const urgentCount = useMemo(() => rows.filter((r) => isUrgent(r.closing_at)).length, [rows]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl md:text-3xl">UMOJA Tenders</h1>
          <SparkBalanceChip />
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Live South African government tenders from the National Treasury eTenders feed. Browse for
          free — bid numbers, contacts and bid packs unlock inside each tender.
        </p>
      </header>


      <Card className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenders, buyers or delivery location…"
            className="pl-9"
            aria-label="Search tenders"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={province} onValueChange={(v) => { setProvince(v); setPage(0); }}>
            <SelectTrigger className="w-[190px]" aria-label="Filter by province">
              <SelectValue placeholder="All provinces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All provinces</SelectItem>
              {PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={openOnly ? "default" : "outline"}
            onClick={() => { setOpenOnly((v) => !v); setPage(0); }}
          >
            {openOnly ? "Open tenders only" : "Including closed"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${total} tender${total === 1 ? "" : "s"} · sorted by soonest closing`}
          {urgentCount > 0 && !loading && ` · ${urgentCount} closing within 3 days`}
        </p>
      </Card>

      {loading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No tenders match your search. Try a broader keyword or clear the province filter.
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((t) => {
            const urgent = isUrgent(t.closing_at);
            const closed = isClosed(t.closing_at);
            const value = formatTenderValue(t.value_amount, t.value_currency);
            return (
              <li key={t.id}>
                <Card
                  className={`p-4 transition-smooth hover:shadow-soft ${
                    urgent ? "border-destructive/60 bg-destructive/5" : ""
                  }`}
                >
                  <Link to={`/tenders/${t.id}`} className="block space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-medium leading-snug">
                        {displayTitle(t.description ?? t.title)}
                      </h2>
                      <Badge variant={urgent ? "destructive" : closed ? "secondary" : "outline"} className="shrink-0 gap-1">
                        {urgent && <Flame className="h-3 w-3" />}
                        {closingLabel(t.closing_at)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {t.buyer_name && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{t.buyer_name}
                        </span>
                      )}
                      {t.province && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{t.province}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />Closes {formatDate(t.closing_at)}
                      </span>
                      {value && <span className="text-foreground font-medium">{value}</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {t.category && <Badge variant="secondary">{t.category}</Badge>}
                      {t.procurement_method && <Badge variant="outline">{t.procurement_method}</Badge>}
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Lock className="h-3 w-3" />Bid number & bid pack inside
                      </span>
                      {(intentCounts[t.id]?.pursuing ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {intentCounts[t.id].pursuing} pursuing · {intentCounts[t.id].open} open to partner
                        </span>
                      )}
                    </div>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {pages}</span>
          <Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Data sourced from the National Treasury eTenders OCDS feed.{" "}
        <a href={ETENDERS_HOME} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline">
          Verify on etenders.gov.za <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
