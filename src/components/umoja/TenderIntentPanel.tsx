import { useCallback, useEffect, useState } from "react";
import { Handshake, Users, Loader2, EyeOff, Eye, UserCheck, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type MyIntent = {
  intent: "solo" | "open_to_partner";
  visibility: "visible" | "private";
  brings: string | null;
  needs: string | null;
  active: boolean;
} | null;

type Partner = {
  member_id: string;
  full_name: string | null;
  province: string | null;
  brings: string | null;
  needs: string | null;
  created_at: string;
};

export default function TenderIntentPanel({ tenderId }: { tenderId: string }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<MyIntent>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [counts, setCounts] = useState({ pursuing: 0, open: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [intent, setIntent] = useState<"solo" | "open_to_partner">("solo");
  const [visibility, setVisibility] = useState<"visible" | "private">("visible");
  const [brings, setBrings] = useState("");
  const [needs, setNeeds] = useState("");

  const load = useCallback(async () => {
    const [countRes, partnerRes, mineRes] = await Promise.all([
      supabase.rpc("tender_intent_counts", { p_tender_ids: [tenderId] }),
      supabase.rpc("tender_open_partners", { p_tender_id: tenderId }),
      user ? supabase.rpc("my_tender_intent", { p_tender_id: tenderId }) : Promise.resolve({ data: null }),
    ]);
    const c = (countRes.data as { pursuing_count: number; open_to_partner_count: number }[] | null)?.[0];
    setCounts({ pursuing: c?.pursuing_count ?? 0, open: c?.open_to_partner_count ?? 0 });
    setPartners((partnerRes.data as Partner[] | null) ?? []);
    const m = (mineRes as { data: unknown }).data as MyIntent;
    setMine(m ?? null);
    if (m) {
      setIntent(m.intent);
      setVisibility(m.visibility);
      setBrings(m.brings ?? "");
      setNeeds(m.needs ?? "");
    }
    setLoading(false);
  }, [tenderId, user]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("set_tender_intent", {
      p_tender_id: tenderId,
      p_intent: intent,
      p_visibility: visibility,
      p_brings: intent === "open_to_partner" ? brings : null,
      p_needs: intent === "open_to_partner" ? needs : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Could not save your intent"); return; }
    toast.success(
      intent === "open_to_partner"
        ? "You're listed as open to partnering on this tender"
        : visibility === "private"
          ? "Recorded privately — you're counted, not named"
          : "Recorded — you're pursuing this tender",
    );
    await load();
  };

  const withdraw = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("withdraw_tender_intent", { p_tender_id: tenderId });
    setSaving(false);
    if (error) { toast.error(error.message || "Could not withdraw"); return; }
    toast.success("Withdrawn — you're no longer counted on this tender");
    await load();
  };

  const activeMine = mine?.active ? mine : null;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-medium">Who's pursuing this</h2>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Loading community signal…"
                : `${counts.pursuing} pursuing · ${counts.open} open to partner`}
            </p>
          </div>
        </div>
        {activeMine && (
          <Badge variant="secondary" className="gap-1">
            <UserCheck className="h-3 w-3" />
            {activeMine.intent === "open_to_partner"
              ? "You're open to partner"
              : activeMine.visibility === "private" ? "You're pursuing (private)" : "You're pursuing"}
          </Badge>
        )}
      </div>

      {!user ? (
        <p className="text-sm text-muted-foreground">Sign in to mark that you're pursuing this tender.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={intent === "solo" ? "default" : "outline"}
              onClick={() => setIntent("solo")}
              className="justify-start"
            >
              <UserCheck className="mr-2 h-4 w-4" /> Pursuing solo
            </Button>
            <Button
              type="button"
              variant={intent === "open_to_partner" ? "default" : "outline"}
              onClick={() => setIntent("open_to_partner")}
              className="justify-start"
            >
              <Handshake className="mr-2 h-4 w-4" /> Open to partner
            </Button>
          </div>

          {intent === "solo" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={visibility === "visible" ? "secondary" : "ghost"}
                onClick={() => setVisibility("visible")}
              >
                <Eye className="mr-2 h-3.5 w-3.5" /> Visible
              </Button>
              <Button
                type="button"
                size="sm"
                variant={visibility === "private" ? "secondary" : "ghost"}
                onClick={() => setVisibility("private")}
              >
                <EyeOff className="mr-2 h-3.5 w-3.5" /> Private
              </Button>
              <span className="text-xs text-muted-foreground">
                Private still counts toward the number — your name is never shown.
              </span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ti-brings" className="text-xs">What I bring (optional)</Label>
                <Input
                  id="ti-brings"
                  value={brings}
                  maxLength={280}
                  onChange={(e) => setBrings(e.target.value)}
                  placeholder="CIDB 3GB, own bakkie, CSD registered…"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ti-needs" className="text-xs">What I need (optional)</Label>
                <Input
                  id="ti-needs"
                  value={needs}
                  maxLength={280}
                  onChange={(e) => setNeeds(e.target.value)}
                  placeholder="Working capital, tax clearance, local partner…"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {activeMine ? "Update my intent" : "Pursue this tender"}
            </Button>
            {activeMine && (
              <Button variant="outline" onClick={withdraw} disabled={saving}>
                <X className="mr-2 h-4 w-4" /> Withdraw
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Free — no unlock needed. Only members who choose “open to partner” are listed by name.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Open to partnering</p>
        {partners.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one has flagged themselves as open to partnering yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {partners.map((p) => (
              <li key={p.member_id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm space-y-1">
                <span className="font-medium">{p.full_name ?? "UMOJA member"}</span>
                {p.brings && <p className="text-xs text-muted-foreground">Brings: {p.brings}</p>}
                {p.needs && <p className="text-xs text-muted-foreground">Needs: {p.needs}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
