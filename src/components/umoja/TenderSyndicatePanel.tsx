import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Handshake, Loader2, Plus, Users, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type SyndicateRow = {
  id: string;
  name: string | null;
  status: string;
  originator_id: string;
  originator_name: string | null;
  accepted_count: number;
  my_status: string | null;
  is_originator: boolean;
  created_at: string;
};

const RPC_ERRORS: Record<string, string> = {
  tender_not_unlocked: "Unlock this tender first — then you can open a Syndicate on it.",
  intent_required: "Flag your intent on this tender first (pursuing or open to partner).",
  syndicates_disabled: "Syndicates are temporarily unavailable.",
  syndicate_not_forming: "This Syndicate is no longer forming.",
};

const friendly = (msg: string) => {
  const key = Object.keys(RPC_ERRORS).find((k) => msg.includes(k));
  return key ? RPC_ERRORS[key] : msg || "Something went wrong. Please try again.";
};

export default function TenderSyndicatePanel({
  tenderId,
  unlocked,
}: {
  tenderId: string;
  unlocked: boolean;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<SyndicateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applyNote, setApplyNote] = useState<Record<string, string>>({});
  const [hasIntent, setHasIntent] = useState(false);

  const load = useCallback(async () => {
    if (user) {
      const { data: mi } = await supabase.rpc("my_tender_intent", { p_tender_id: tenderId });
      setHasIntent(Boolean((mi as { active?: boolean } | null)?.active));
    }
    const { data, error } = await supabase.rpc("tender_syndicates_for_tender", { p_tender_id: tenderId });
    if (error) console.error("tender_syndicates_for_tender failed:", error.message);
    setRows((data as SyndicateRow[] | null) ?? []);
    setLoading(false);
  }, [tenderId, user]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const create = async () => {
    setCreating(true);
    const { data, error } = await supabase.rpc("open_tender_syndicate", {
      p_tender_id: tenderId,
      p_name: name || null,
      p_summary: summary || null,
    });
    setCreating(false);
    if (error) { toast.error(friendly(error.message)); return; }
    toast.success("Syndicate opened — invite partners in the room");
    setShowForm(false); setName(""); setSummary("");
    await load();
    if (data) window.location.assign(`/tenders/syndicate/${data as string}`);
  };

  const apply = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("apply_to_tender_syndicate", {
      p_syndicate_id: id,
      p_brings_tags: [],
      p_brings_note: applyNote[id] || null,
    });
    setBusyId(null);
    if (error) { toast.error(friendly(error.message)); return; }
    toast.success("Application sent — the originator will accept or decline");
    await load();
  };

  const canOpen = unlocked && hasIntent;

  const mine = rows.find((r) => r.is_originator);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-partner/20 text-partner ring-1 ring-partner/40">
            <Handshake className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-medium">Syndicates on this tender</h2>
            <p className="text-xs text-muted-foreground">
              Form a consortium with other members. UMOJA provides the space — no money moves here.
            </p>
          </div>
        </div>
        {user && canOpen && !mine && !showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Open a Syndicate
          </Button>
        )}
      </div>

      {user && canOpen && showForm && (
        <div className="space-y-3 rounded-xl border border-partner/40 bg-partner/5 p-3">
          <div className="space-y-1">
            <Label htmlFor="syn-name" className="text-xs">Syndicate name (optional)</Label>
            <Input
              id="syn-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Defaults to the tender title"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="syn-summary" className="text-xs">What this opportunity needs</Label>
            <Textarea
              id="syn-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="e.g. CIDB 4GB partner, bakkie + driver, and someone who can carry 30 days of materials."
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={create} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Open Syndicate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} disabled={creating}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {user && !canOpen && !mine && (
        <p className="text-xs text-muted-foreground">
          Unlock this tender and flag your intent to open a Syndicate on it.
        </p>
      )}

      {loading ? (
        <div className="grid place-items-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No syndicates forming on this tender yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const isIn = r.is_originator || r.my_status === "accepted";
            return (
              <li key={r.id} className="rounded-xl border p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">{r.name ?? "Syndicate"}</p>
                    <p className="text-xs text-muted-foreground">
                      Led by {r.originator_name ?? "a member"} · {r.accepted_count} in the room
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
                    {r.my_status && !isIn && (
                      <Badge variant="secondary" className="text-[10px] capitalize">{r.my_status}</Badge>
                    )}
                  </div>
                </div>

                {isIn ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/tenders/syndicate/${r.id}`}>
                      Open room <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : r.status === "forming" && user && !r.my_status ? (
                  <div className="space-y-2">
                    <Input
                      value={applyNote[r.id] ?? ""}
                      maxLength={280}
                      onChange={(e) => setApplyNote((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="What do you bring? (max 280 characters)"
                    />
                    <Button size="sm" onClick={() => apply(r.id)} disabled={busyId === r.id}>
                      {busyId === r.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Users className="mr-2 h-3.5 w-3.5" /> Apply to join
                    </Button>
                  </div>
                ) : r.my_status === "invited" ? (
                  <Button size="sm" onClick={() => apply(r.id)} disabled={busyId === r.id}>
                    {busyId === r.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Accept invitation
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
