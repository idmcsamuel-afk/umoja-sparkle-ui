import { useCallback, useEffect, useState } from "react";
import { Handshake, Users, Loader2, EyeOff, Eye, UserCheck, X, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import TagPicker, { type CapabilityTag } from "@/components/umoja/IntentTagPicker";

type MyIntent = {
  intent: "solo" | "open_to_partner";
  visibility: "visible" | "private";
  brings: string | null;
  needs: string | null;
  brings_tags: string[] | null;
  needs_tags: string[] | null;
  active: boolean;
} | null;

type Partner = {
  member_id: string;
  full_name: string | null;
  province: string | null;
  brings: string | null;
  needs: string | null;
  brings_tags: string[] | null;
  needs_tags: string[] | null;
  created_at: string;
};


export default function TenderIntentPanel({ tenderId }: { tenderId: string }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<MyIntent>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [counts, setCounts] = useState({ pursuing: 0, open: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<CapabilityTag[]>([]);

  const [intent, setIntent] = useState<"solo" | "open_to_partner">("solo");
  const [visibility, setVisibility] = useState<"visible" | "private">("visible");
  const [brings, setBrings] = useState("");
  const [needs, setNeeds] = useState("");
  const [bringsTags, setBringsTags] = useState<string[]>([]);
  const [needsTags, setNeedsTags] = useState<string[]>([]);

  const tagLabel = useCallback(
    (slug: string) => tags.find((t) => t.slug === slug)?.label ?? slug,
    [tags],
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("intent_capability_tags")
        .select("slug,label,tag_group,sort_order")
        .eq("active", true)
        .order("tag_group", { ascending: true })
        .order("sort_order", { ascending: true });
      setTags((data as CapabilityTag[] | null) ?? []);
    })();
  }, []);

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
      setBringsTags(m.brings_tags ?? []);
      setNeedsTags(m.needs_tags ?? []);
    }
    setLoading(false);
  }, [tenderId, user]);


  useEffect(() => { setLoading(true); load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const isPartner = intent === "open_to_partner";
    const { error } = await supabase.rpc("set_tender_intent", {
      p_tender_id: tenderId,
      p_intent: intent,
      p_visibility: visibility,
      p_brings: isPartner ? brings || null : null,
      p_needs: isPartner ? needs || null : null,
      p_brings_tags: isPartner ? bringsTags : null,
      p_needs_tags: isPartner ? needsTags : null,
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
          <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary">
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
              aria-pressed={intent === "solo"}
              className={`justify-start ${
                intent === "solo"
                  ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                  : "text-muted-foreground"
              }`}
            >
              {intent === "solo" ? <Check className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Pursuing solo
            </Button>
            <Button
              type="button"
              variant={intent === "open_to_partner" ? "default" : "outline"}
              onClick={() => setIntent("open_to_partner")}
              aria-pressed={intent === "open_to_partner"}
              className={`justify-start ${
                intent === "open_to_partner"
                  ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                  : "text-muted-foreground"
              }`}
            >
              {intent === "open_to_partner" ? <Check className="mr-2 h-4 w-4" /> : <Handshake className="mr-2 h-4 w-4" />}
              Open to partner
            </Button>
          </div>

          {intent === "solo" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={visibility === "visible" ? "default" : "outline"}
                onClick={() => setVisibility("visible")}
                aria-pressed={visibility === "visible"}
                className={visibility === "visible" ? "" : "text-muted-foreground"}
              >
                <Eye className="mr-2 h-3.5 w-3.5" /> Visible
              </Button>
              <Button
                type="button"
                size="sm"
                variant={visibility === "private" ? "default" : "outline"}
                onClick={() => setVisibility("private")}
                aria-pressed={visibility === "private"}
                className={visibility === "private" ? "" : "text-muted-foreground"}
              >
                <EyeOff className="mr-2 h-3.5 w-3.5" /> Private
              </Button>
              <span className="text-xs text-muted-foreground">
                Private still counts toward the number — your name is never shown.
              </span>
            </div>
          ) : (

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">What I bring (optional)</Label>
                <TagPicker
                  tags={tags}
                  selected={bringsTags}
                  onToggle={(slug) =>
                    setBringsTags((prev) =>
                      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
                    )
                  }
                />
                <Input
                  id="ti-brings"
                  value={brings}
                  maxLength={280}
                  onChange={(e) => setBrings(e.target.value)}
                  placeholder="Optional note — e.g. CIDB 3GB, own bakkie…"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">What I need (optional)</Label>
                <TagPicker
                  tags={tags}
                  selected={needsTags}
                  onToggle={(slug) =>
                    setNeedsTags((prev) =>
                      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
                    )
                  }
                />
                <Input
                  id="ti-needs"
                  value={needs}
                  maxLength={280}
                  onChange={(e) => setNeeds(e.target.value)}
                  placeholder="Optional note — e.g. working capital, local partner…"
                />
              </div>
              {bringsTags.length === 0 && needsTags.length === 0 && (
                <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                  Tip: pick at least one tag so other members can see how you match.
                </p>
              )}
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
              <li key={p.member_id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.full_name ?? "UMOJA member"}</span>
                  {p.province && <Badge variant="outline" className="text-[10px]">{p.province}</Badge>}
                </div>
                {(p.brings_tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">Brings:</span>
                    {p.brings_tags!.map((s) => (
                      <Badge key={`b-${s}`} variant="secondary" className="text-[10px]">{tagLabel(s)}</Badge>
                    ))}
                  </div>
                )}
                {(p.needs_tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">Needs:</span>
                    {p.needs_tags!.map((s) => (
                      <Badge key={`n-${s}`} variant="outline" className="text-[10px]">{tagLabel(s)}</Badge>
                    ))}
                  </div>
                )}
                {p.brings && <p className="text-xs text-muted-foreground">Brings note: {p.brings}</p>}
                {p.needs && <p className="text-xs text-muted-foreground">Needs note: {p.needs}</p>}
              </li>

            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">
          No contact details are shared at this stage — only name, province and what each member brings
          or needs. Connecting happens on-platform inside the Bid Circle.
        </p>
      </div>

    </Card>
  );
}
