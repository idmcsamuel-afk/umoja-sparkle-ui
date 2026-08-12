import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Handshake, Users, RefreshCw, EyeOff, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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

type PartnerParty = {
  member_id: string;
  full_name: string | null;
  province: string | null;
  brings: string | null;
  needs: string | null;
  brings_tags: string[] | null;
  needs_tags: string[] | null;
  created_at: string;
};

type SoloParty = {
  member_id: string;
  full_name: string | null;
  province: string | null;
  created_at: string;
};

type Parties = {
  tender: { id: string; ocid: string; title: string | null; buyer_name: string | null; province: string | null; closing_at: string | null } | null;
  open_to_partner: PartnerParty[];
  solo_visible: SoloParty[];
  solo_private_count: number;
};

export default function AdminTenderIntents() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [parties, setParties] = useState<Parties | null>(null);
  const [partiesLoading, setPartiesLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: res, error: err } = await supabase.rpc("admin_tender_intent_analytics", { p_limit: 20 });
    setError(err?.message ?? null);
    setData((res as unknown as Payload) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDrill = async (tenderId: string) => {
    setDrillId(tenderId);
    setParties(null);
    setPartiesLoading(true);
    const { data: res, error: err } = await supabase.rpc("admin_tender_intent_parties", { p_tender_id: tenderId });
    if (err) setError(err.message);
    setParties((res as unknown as Parties) ?? null);
    setPartiesLoading(false);
  };

  const t = data?.totals;
  const soloVisible = t ? t.solo - t.solo_private : 0;

  const rowLine = (r: TenderRow) => (
    <li key={r.tender_id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/tenders/${r.tender_id}`} className="font-medium hover:underline">
          {r.tender_title ?? r.ocid}
        </Link>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => openDrill(r.tender_id)}>
          Interested parties <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
        <Badge variant="outline" className="border-partner/50 bg-partner/10 text-partner">
          {r.open_to_partner_count} open to partner
        </Badge>
        <Badge variant="outline">{r.pursuing_count} pursuing solo</Badge>
        {r.buyer_name && <span>{r.buyer_name}</span>}
        {r.province && <span>{r.province}</span>}
        <span>Closes {formatDate(r.closing_at)}</span>
      </div>
    </li>
  );

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
              { label: "Pursuing solo (visible)", value: soloVisible },
              { label: "Pursuing solo (private)", value: t?.solo_private ?? 0 },
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
              <ul className="space-y-2">{data!.top_open_to_partner.map(rowLine)}</ul>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-medium inline-flex items-center gap-2">
              <Users className="h-4 w-4" /> Most pursued tenders
            </h2>
            {(data?.top_pursued ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No intents recorded yet.</p>
            ) : (
              <ul className="space-y-2">{data!.top_pursued.map(rowLine)}</ul>
            )}
          </Card>

          <p className="text-xs text-muted-foreground">
            "Pursuing solo" and "open to partner" are mutually exclusive and together equal all active
            intents on a tender. Private solo members are counted but never named anywhere.
          </p>
        </>
      )}

      <Dialog open={!!drillId} onOpenChange={(o) => { if (!o) { setDrillId(null); setParties(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Interested parties</DialogTitle>
            <DialogDescription>
              {parties?.tender?.title ?? parties?.tender?.ocid ?? "Loading tender…"}
            </DialogDescription>
          </DialogHeader>

          {partiesLoading ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !parties ? (
            <p className="text-sm text-muted-foreground">Nothing to show.</p>
          ) : (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="text-sm font-medium inline-flex items-center gap-2 text-partner">
                  <Handshake className="h-4 w-4" /> Open to partner ({parties.open_to_partner.length})
                </h3>
                {parties.open_to_partner.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members open to partnering yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {parties.open_to_partner.map((p) => (
                      <li key={p.member_id} className="rounded-xl border border-partner/40 bg-partner/5 px-3 py-2 text-sm space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{p.full_name ?? "UMOJA member"}</span>
                          {p.province && <Badge variant="outline" className="text-[10px]">{p.province}</Badge>}
                        </div>
                        {(p.brings_tags?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">Brings:</span>
                            {p.brings_tags!.map((s) => (
                              <Badge key={`b-${s}`} variant="secondary" className="text-[10px]">{s}</Badge>
                            ))}
                          </div>
                        )}
                        {(p.needs_tags?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">Needs:</span>
                            {p.needs_tags!.map((s) => (
                              <Badge key={`n-${s}`} variant="outline" className="text-[10px]">{s}</Badge>
                            ))}
                          </div>
                        )}
                        {p.brings && <p className="text-xs text-muted-foreground">Brings note: {p.brings}</p>}
                        {p.needs && <p className="text-xs text-muted-foreground">Needs note: {p.needs}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium inline-flex items-center gap-2">
                  <Users className="h-4 w-4" /> Pursuing solo — visible ({parties.solo_visible.length})
                </h3>
                {parties.solo_visible.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No visible solo members.</p>
                ) : (
                  <ul className="space-y-2">
                    {parties.solo_visible.map((p) => (
                      <li key={p.member_id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.full_name ?? "UMOJA member"}</span>
                        {p.province && <Badge variant="outline" className="text-[10px]">{p.province}</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-1">
                <h3 className="text-sm font-medium inline-flex items-center gap-2 text-muted-foreground">
                  <EyeOff className="h-4 w-4" /> Pursuing solo — private ({parties.solo_private_count})
                </h3>
                <p className="text-xs text-muted-foreground">
                  These members chose privacy. They are counted only — never named, not even to admin.
                </p>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
