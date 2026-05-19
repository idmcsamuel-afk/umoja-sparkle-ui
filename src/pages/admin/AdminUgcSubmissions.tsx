import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Check, X } from "lucide-react";

type Row = {
  id: string;
  member_id: string;
  video_url: string;
  platform: string;
  social_media_link: string;
  caption_used: string | null;
  submission_status: string;
  admin_notes: string | null;
  sparks_rewarded: number;
  rewarded_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  members?: { full_name: string | null; email: string | null } | null;
};

export default function AdminUgcSubmissions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rewards, setRewards] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("member_ugc_submissions")
      .select("*, members(full_name, email)")
      .eq("submission_status", tab)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tab]);

  const review = async (id: string, decision: "approved" | "rejected") => {
    const { error } = await supabase.rpc("admin_review_ugc_submission", {
      _submission_id: id,
      _decision: decision,
      _notes: notes[id] ?? null,
      _reward: rewards[id] ?? 200,
    });
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Approved & Sparks awarded" : "Rejected");
    load();
  };

  const counts = { pending: rows.length };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <header>
        <h1 className="font-display text-2xl">🎬 Member video submissions</h1>
        <p className="text-sm text-muted-foreground">Review UGC submissions and award Sparks.</p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No {tab} submissions.</CardContent></Card>
          ) : rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 grid md:grid-cols-[240px_1fr] gap-4">
                <video src={r.video_url} controls className="w-full rounded-md aspect-[9/16] object-cover bg-secondary" />
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{r.members?.full_name ?? "Member"}</p>
                    <Badge variant="secondary">{r.platform}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <a href={r.social_media_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent underline break-all">
                    <ExternalLink className="h-3.5 w-3.5" /> {r.social_media_link}
                  </a>
                  {r.caption_used && (
                    <div className="text-xs p-3 bg-muted rounded whitespace-pre-wrap line-clamp-6">{r.caption_used}</div>
                  )}

                  {tab === "pending" ? (
                    <div className="space-y-2">
                      <Textarea placeholder="Admin notes (sent to member if rejecting)"
                        value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        rows={2} maxLength={1000} />
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-muted-foreground flex items-center gap-1">
                          Reward
                          <Input type="number" min={0} max={5000} className="w-24 h-8"
                            value={rewards[r.id] ?? 200}
                            onChange={(e) => setRewards((s) => ({ ...s, [r.id]: Number(e.target.value) }))} />
                          Sparks
                        </label>
                        <Button size="sm" variant="outline" onClick={() => review(r.id, "rejected")}>
                          <X className="h-4 w-4" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => review(r.id, "approved")}>
                          <Check className="h-4 w-4" /> Approve & reward
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {r.reviewed_at && <p>Reviewed {new Date(r.reviewed_at).toLocaleString()}</p>}
                      {r.sparks_rewarded > 0 && <p className="text-accent">Awarded {r.sparks_rewarded} Sparks</p>}
                      {r.admin_notes && <p className="italic">"{r.admin_notes}"</p>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
