import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, MapPin, Clock, CalendarClock, ExternalLink, Loader2, Lock, Flame, Truck,
  CheckCircle2, FileText, Mail, Phone, User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import TenderIntentPanel from "@/components/umoja/TenderIntentPanel";
import TenderFitCheck from "@/components/umoja/TenderFitCheck";
import SparkBalanceChip from "@/components/umoja/SparkBalanceChip";
import { useSparkBalance } from "@/hooks/useSparkBalance";
import { closingLabel, isUrgent, formatDateTime, formatDate, formatTenderValue } from "@/lib/tenders";

const REVEAL_COST = 20;

type TenderDoc = { title?: string | null; url?: string | null; format?: string | null };

type TenderDetailPayload = {
  id: string;
  ocid: string;
  title: string | null;
  description: string | null;
  buyer_name: string | null;
  province: string | null;
  delivery_location: string | null;
  category: string | null;
  procurement_method: string | null;
  status: string | null;
  value_amount: number | null;
  value_currency: string | null;
  published_at: string | null;
  closing_at: string | null;
  source_url: string | null;
  unlocked: boolean;
  reference_number?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  briefing_at?: string | null;
  briefing_compulsory?: boolean | null;
  documents?: TenderDoc[] | null;
};

export default function TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tender, setTender] = useState<TenderDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const { balance, refresh: refreshBalance } = useSparkBalance();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.rpc("get_tender_detail", { p_tender_id: id });
    if (error) console.error("tender fetch failed:", error.message);
    setTender((data as unknown as TenderDetailPayload) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => { setLoading(true); load(); }, [load]);


  const handleUnlock = async () => {
    if (!id) return;
    setUnlocking(true);
    const { data, error } = await supabase.rpc("unlock_tender", {
      p_tender_id: id,
      p_unlock_type: "reveal",
    });
    setUnlocking(false);
    setConfirmOpen(false);

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("insufficient_sparks")) {
        toast.error(
          "Not enough Sparks — earn more in Spark Trade or Spark Pit, or subscribe for R199/month unlimited access.",
        );
      } else if (msg.includes("spark_payments_disabled")) {
        toast.error("Spark unlocks are temporarily disabled. Please try again later.");
      } else {
        toast.error(msg || "Unlock failed. Please try again.");
      }
      return;
    }

    const res = data as { already_unlocked?: boolean } | null;
    toast.success(res?.already_unlocked ? "Already unlocked" : "Unlocked — full bid details revealed");
    await Promise.all([load(), refreshBalance()]);
  };

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
  const docs = Array.isArray(tender.documents) ? tender.documents : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <Link to="/tenders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All tenders
        </Link>
        <SparkBalanceChip />
      </div>

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

      <TenderFitCheck tenderId={tender.id} />

      <TenderIntentPanel tenderId={tender.id} />

      {tender.unlocked ? (
        <Card className="p-5 space-y-4 border-primary/40">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-medium">Full bid details</h2>
              <p className="text-xs text-muted-foreground">Unlocked — yours permanently.</p>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Bid / reference number</dt>
              <dd className="font-medium break-words">{tender.reference_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground inline-flex items-center gap-1"><User className="h-3 w-3" />Contact person</dt>
              <dd>{tender.contact_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground inline-flex items-center gap-1"><Mail className="h-3 w-3" />Email</dt>
              <dd className="break-words">
                {tender.contact_email
                  ? <a className="underline" href={`mailto:${tender.contact_email}`}>{tender.contact_email}</a>
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground inline-flex items-center gap-1"><Phone className="h-3 w-3" />Phone</dt>
              <dd>{tender.contact_phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Briefing session</dt>
              <dd>
                {tender.briefing_at ? formatDateTime(tender.briefing_at) : "None stated"}
                {tender.briefing_compulsory ? " · Compulsory" : tender.briefing_at ? " · Optional" : ""}
              </dd>
            </div>
          </dl>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Bid pack documents</p>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents listed on the feed.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d, i) => (
                  <li key={`${d.url ?? i}`} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 underline break-all"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        {d.title || d.url}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" />{d.title || "Untitled document"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : (
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

          {user ? (
            <Button variant="spark" className="w-full" onClick={() => setConfirmOpen(true)} disabled={unlocking}>
              {unlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Unlock full details — {REVEAL_COST} Sparks (R{REVEAL_COST})
            </Button>
          ) : (
            <Button asChild variant="spark" className="w-full"><Link to="/login">Sign in to unlock</Link></Button>
          )}

          <Button variant="outline" className="w-full" disabled>
            Subscribe — R199/month unlimited (coming soon)
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            {balance !== null
              ? `Your balance: ${balance.toLocaleString()} Sparks. Browsing stays free.`
              : "Browsing stays free."}
          </p>
        </Card>
      )}

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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock full bid details?</AlertDialogTitle>
            <AlertDialogDescription>
              This costs {REVEAL_COST} Sparks (R{REVEAL_COST}).{" "}
              {balance !== null ? `You have ${balance.toLocaleString()} Sparks.` : ""} The bid number,
              contacts, briefing and bid pack stay unlocked for you permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleUnlock(); }} disabled={unlocking}>
              {unlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm — {REVEAL_COST} Sparks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
