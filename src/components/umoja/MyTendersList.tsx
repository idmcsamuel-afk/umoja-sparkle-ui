import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2, Clock, Building2, MapPin, CheckCircle2, Sparkles, Users, Handshake, RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { closingLabel, displayTitle, formatTenderValue, urgencyBand } from "@/lib/tenders";

type MyTenderRow = {
  id: string;
  ocid: string;
  title: string | null;
  description: string | null;
  buyer_name: string | null;
  province: string | null;
  closing_at: string | null;
  value_amount: number | null;
  value_currency: string | null;
  category: string | null;
  unlocked: boolean;
  fit_checked: boolean;
  intent: "solo" | "open_to_partner" | null;
  intent_visibility: "visible" | "private" | null;
  last_activity_at: string | null;
};

type MySyndicate = {
  id: string;
  name: string | null;
  status: string;
  tender_id: string;
  tender_title: string | null;
  closing_at: string | null;
  role: "originator" | "member";
  my_status: string;
  accepted_count: number;
  updated_at: string;
};

type TabKey = "all" | "unlocked" | "fit_checked" | "intent";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unlocked", label: "Unlocked" },
  { key: "fit_checked", label: "Fit-checked" },
  { key: "intent", label: "Pursuing" },
];

export default function MyTendersList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MyTenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [syndicates, setSyndicates] = useState<MySyndicate[]>([]);

  const load = useCallback(async () => {
    if (!user) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const [{ data, error }, synRes] = await Promise.all([
      supabase.rpc("my_tenders"),
      supabase.rpc("my_tender_syndicates"),
    ]);
    if (error) console.error("my_tenders failed:", error.message);
    setRows((data as MyTenderRow[] | null) ?? []);
    setSyndicates((synRes.data as MySyndicate[] | null) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Sign in to see the tenders you've unlocked, fit-checked or flagged.
        </p>
        <Button asChild variant="outline"><Link to="/login">Sign in</Link></Button>
      </Card>
    );
  }

  const filtered = rows.filter((r) =>
    tab === "all" ? true
    : tab === "unlocked" ? r.unlocked
    : tab === "fit_checked" ? r.fit_checked
    : r.intent !== null,
  );

  const counts = {
    all: rows.length,
    unlocked: rows.filter((r) => r.unlocked).length,
    fit_checked: rows.filter((r) => r.fit_checked).length,
    intent: rows.filter((r) => r.intent !== null).length,
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={tab === t.key ? "default" : "outline"}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={tab === t.key ? "" : "text-muted-foreground"}
            >
              {t.label} ({counts[t.key]})
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={load} disabled={loading} className="ml-auto">
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Everything you've spent Sparks on stays here — unlocks are permanent.
        </p>
      </Card>

      {syndicates.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-partner/20 text-partner ring-1 ring-partner/40">
              <Handshake className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-medium">My syndicates</h2>
              <p className="text-xs text-muted-foreground">Consortiums you lead or belong to.</p>
            </div>
          </div>
          <ul className="space-y-2">
            {syndicates.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/tenders/syndicate/${s.id}`}
                  className="block rounded-xl border p-3 transition-smooth hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">{s.name ?? s.tender_title ?? "Syndicate"}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.role === "originator" ? "You lead this" : "Member"} · {s.accepted_count} in the room
                        {s.closing_at ? ` · ${closingLabel(s.closing_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{s.status}</Badge>
                      {s.my_status !== "accepted" && (
                        <Badge variant="secondary" className="text-[10px] capitalize">{s.my_status}</Badge>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {loading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Unlock a tender, run a Fit-Check, or mark that you're pursuing one — it
          will appear in My Tenders.
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((t) => {
            const band = urgencyBand(t.closing_at);
            const value = formatTenderValue(t.value_amount, t.value_currency);
            return (
              <li key={t.id}>
                <Card className="p-4 transition-smooth hover:shadow-soft">
                  <Link to={`/tenders/${t.id}`} className="block space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-medium leading-snug">
                        {displayTitle(t.description ?? t.title)}
                      </h2>
                      <Badge
                        variant={band === "red" ? "destructive" : band === "closed" ? "secondary" : "outline"}
                        className="shrink-0 gap-1"
                      >
                        <Clock className="h-3 w-3" />
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
                      {value && <span className="text-foreground font-medium">{value}</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {t.unlocked && (
                        <Badge className="gap-1 border-primary/40 bg-primary/10 text-primary" variant="outline">
                          <CheckCircle2 className="h-3 w-3" /> Unlocked
                        </Badge>
                      )}
                      {t.fit_checked && (
                        <Badge className="gap-1 border-accent/50 bg-accent/10 text-accent" variant="outline">
                          <Sparkles className="h-3 w-3" /> Fit-checked
                        </Badge>
                      )}
                      {t.intent === "open_to_partner" && (
                        <Badge className="gap-1 border-partner/50 bg-partner/10 text-partner" variant="outline">
                          <Handshake className="h-3 w-3" /> Open to partner
                        </Badge>
                      )}
                      {t.intent === "solo" && (
                        <Badge className="gap-1 border-primary/40 bg-primary/10 text-primary" variant="outline">
                          <Users className="h-3 w-3" />
                          Pursuing solo{t.intent_visibility === "private" ? " (private)" : ""}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
