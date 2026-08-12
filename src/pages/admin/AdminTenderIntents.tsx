import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Handshake, Users, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/tenders";

type Totals = {
  total_intents: number;
  active_intents: number;
  withdrawn_intents: number;
  solo: number;
  solo_private: number;
  open_to_partner: number;
  distinct_members: number;
  distinct_tenders: number;
};

type TenderRow = {
  tender_id: string;
  ocid: string;
  tender_title: string | null;
  buyer_name?: string | null;
  province?: string | null;
  closing_at: string | null;
  open_to_partner_count: number;
  pursuing_count: number;
};

type Payload = {
  totals: Totals;
  top_open_to_partner: TenderRow[];
  top_pursued: TenderRow[];
};

export default function AdminTenderIntents() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: res, error: err } = await supabase.rpc("admin_tender_intent_analytics", { p_limit: 20 });
    setError(err?.message ?? null);
    setData((res as unknown as Payload) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const t = data?.totals;
  const soloVisible = t ? t.solo - t.solo_private : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Tender appetite signal</h1>
          <p className="text-sm text-muted-foreground">
            Who is pursuing tenders, and where the appetite to partner is strongest.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      {loading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Active intents", value: t?.active_intents ?? 0 },
              { label: "Open to partner", value: t?.open_to_partner ?? 0 },
              { label: "Solo (visible)", value: soloVisible },
              { label: "Solo (private)", value: t?.solo_private ?? 0 },
              { label: "Total ever recorded", value: t?.total_intents ?? 0 },
              { label: "Withdrawn", value: t?.withdrawn_intents ?? 0 },
              { label: "Distinct members", value: t?.distinct_members ?? 0 },
              { label: "Distinct tenders", value: t?.distinct_tenders ?? 0 },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="font-display text-2xl">{s.value.toLocaleString()}</p>
              </Card>
            ))}
          </div>

          <Card className="p-5 space-y-3">
            <h2 className="font-medium inline-flex items-center gap-2">
              <Handshake className="h-4 w-4" /> Most open-to-partner interest
            </h2>
            {(data?.top_open_to_partner ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No open-to-partner intents recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {data!.top_open_to_partner.map((r) => (
                  <li key={r.tender_id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                    <Link to={`/tenders/${r.tender_id}`} className="font-medium hover:underline">
                      {r.tender_title ?? r.ocid}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <Badge variant="secondary">{r.open_to_partner_count} open to partner</Badge>
                      <Badge variant="outline">{r.pursuing_count} pursuing</Badge>
                      {r.buyer_name && <span>{r.buyer_name}</span>}
                      {r.province && <span>{r.province}</span>}
                      <span>Closes {formatDate(r.closing_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-medium inline-flex items-center gap-2">
              <Users className="h-4 w-4" /> Most pursued tenders
            </h2>
            {(data?.top_pursued ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No intents recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {data!.top_pursued.map((r) => (
                  <li key={r.tender_id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                    <Link to={`/tenders/${r.tender_id}`} className="font-medium hover:underline">
                      {r.tender_title ?? r.ocid}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <Badge variant="outline">{r.pursuing_count} pursuing</Badge>
                      <Badge variant="secondary">{r.open_to_partner_count} open to partner</Badge>
                      <span>Closes {formatDate(r.closing_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="text-xs text-muted-foreground">
            Counts include active intents only. Private solo members are counted but never named anywhere.
          </p>
        </>
      )}
    </div>
  );
}
