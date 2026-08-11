import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, MapPin, Clock, CalendarClock, ExternalLink, Loader2, Lock, Flame, Truck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  type TenderRow, closingLabel, isUrgent, formatDateTime, formatDate, formatTenderValue,
} from "@/lib/tenders";

export default function TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<TenderRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tenders")
        .select(
          "id, ocid, reference_number, title, description, buyer_name, province, delivery_location, category, procurement_method, status, value_amount, value_currency, published_at, closing_at, briefing_at, briefing_compulsory, source_url, documents, contact_name, contact_email, contact_phone",
        )
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error("tender fetch failed:", error.message);
      setTender((data as TenderRow) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!tender) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground">This tender could not be found.</p>
        <Button asChild variant="outline"><Link to="/tenders">Back to tenders</Link></Button>
      </Card>
    );
  }

  const urgent = isUrgent(tender.closing_at);
  const value = formatTenderValue(tender.value_amount, tender.value_currency);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/tenders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All tenders
      </Link>

      <Card className={`p-5 space-y-4 ${urgent ? "border-destructive/60 bg-destructive/5" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={urgent ? "destructive" : "outline"} className="gap-1">
            {urgent && <Flame className="h-3 w-3" />}
            {closingLabel(tender.closing_at)}
          </Badge>
          {tender.status && <Badge variant="secondary">{tender.status}</Badge>}
          {tender.category && <Badge variant="secondary">{tender.category}</Badge>}
        </div>

        <h1 className="font-display text-xl md:text-2xl leading-snug">
          {tender.description || tender.title || "Untitled tender"}
        </h1>

        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground inline-flex items-center gap-1"><Building2 className="h-3 w-3" />Buyer</dt>
            <dd>{tender.buyer_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" />Province</dt>
            <dd>{tender.province ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground inline-flex items-center gap-1"><Truck className="h-3 w-3" />Delivery location</dt>
            <dd className="whitespace-pre-wrap">{tender.delivery_location ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" />Closing</dt>
            <dd>{formatDateTime(tender.closing_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />Published</dt>
            <dd>{formatDate(tender.published_at)}</dd>
          </div>
          {tender.procurement_method && (
            <div>
              <dt className="text-xs text-muted-foreground">Procurement method</dt>
              <dd>{tender.procurement_method}</dd>
            </div>
          )}
          {value && (
            <div>
              <dt className="text-xs text-muted-foreground">Estimated value</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Locked / premium panel — unlock wiring comes in the next build step */}
      <Card className="p-5 space-y-4 border-dashed">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Lock className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-medium">Full bid details</h2>
            <p className="text-xs text-muted-foreground">Unlock to see everything you need to submit.</p>
          </div>
        </div>

        <ul className="space-y-2 text-sm">
          {[
            "Official bid / reference number",
            "Buyer contact person, email and phone",
            "Briefing session date & whether it is compulsory",
            "Bid pack documents list and direct links",
          ].map((item) => (
            <li key={item} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
              <span className="text-muted-foreground">{item}</span>
              <span className="select-none text-xs text-muted-foreground blur-[3px]">••••••••</span>
            </li>
          ))}
        </ul>

        <Button className="w-full" disabled>Unlock — coming soon</Button>
        <p className="text-[11px] text-muted-foreground text-center">
          Spark unlocks and subscriptions go live shortly. Browsing stays free.
        </p>
      </Card>

      <Card className="p-4 space-y-2">
        <p className="text-sm">
          Everything on this page comes from the National Treasury eTenders feed. Always confirm the
          bid pack and closing time on the official portal before you submit.
        </p>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <a
            href={tender.source_url ?? "https://www.etenders.gov.za/Home/opportunities?id=1"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            Verify &amp; download official bid pack <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </Card>
    </div>
  );
}
