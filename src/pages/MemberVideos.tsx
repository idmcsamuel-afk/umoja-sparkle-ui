import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Video, Share2, Sparkles, Users, Upload, ExternalLink } from "lucide-react";
import { BottomNav } from "@/components/umoja/BottomNav";

type ShareRow = {
  id: string;
  platform: string;
  caption_used: string | null;
  referrals_generated: number | null;
  shared_at: string | null;
  video_id: string;
  ai_generated_videos?: {
    video_title: string | null;
    thumbnail_url: string | null;
    ai_avatars?: { name: string | null } | null;
  } | null;
};

type UgcRow = {
  id: string;
  video_url: string;
  platform: string;
  social_media_link: string;
  submission_status: string;
  admin_notes: string | null;
  sparks_rewarded: number;
  created_at: string;
};

export default function MemberVideos() {
  const { user } = useAuth();
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [ugc, setUgc] = useState<UgcRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [s, u] = await Promise.all([
        supabase.from("member_video_shares")
          .select("*, ai_generated_videos(video_title, thumbnail_url, ai_avatars(name))")
          .eq("member_id", user.id).order("shared_at", { ascending: false }).limit(200),
        supabase.from("member_ugc_submissions")
          .select("*").eq("member_id", user.id).order("created_at", { ascending: false }).limit(100),
      ]);
      setShares((s.data ?? []) as any);
      setUgc((u.data ?? []) as any);
      setLoading(false);
    })();
  }, [user]);

  const totals = {
    shares: shares.length,
    referrals: shares.reduce((s, r) => s + (r.referrals_generated ?? 0), 0),
    sparksShare: shares.reduce((s, r) => s + (r.referrals_generated ?? 0), 0) * 100,
    sparksUgc: ugc.reduce((s, r) => s + (r.sparks_rewarded ?? 0), 0),
    ugcApproved: ugc.filter((r) => r.submission_status === "approved").length,
    ugcPending: ugc.filter((r) => r.submission_status === "pending").length,
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-28 md:pb-8">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">My videos</p>
          <h1 className="font-display text-2xl mt-1">📊 Sharing history & submissions</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/browse-videos"><Button variant="outline" className="h-11"><Video className="h-4 w-4" /> Browse</Button></Link>
          <Link to="/upload-video"><Button className="h-11"><Upload className="h-4 w-4" /> Upload</Button></Link>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Share2 className="h-4 w-4" />} label="Library shares" value={totals.shares} />
        <Stat icon={<Users className="h-4 w-4" />} label="Referrals" value={totals.referrals} />
        <Stat icon={<Upload className="h-4 w-4" />} label="UGC approved" value={totals.ugcApproved} />
        <Stat icon={<Sparkles className="h-4 w-4" />} label="Sparks earned" value={totals.sparksShare + totals.sparksUgc} accent />
      </div>

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Shared from library</TabsTrigger>
          <TabsTrigger value="submissions">My submissions {totals.ugcPending > 0 && `(${totals.ugcPending} pending)`}</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent shares</CardTitle></CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
                : shares.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sm text-muted-foreground">You haven't shared any library videos yet.</p>
                    <Link to="/browse-videos"><Button className="h-11">🎬 Browse videos</Button></Link>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {shares.map((r) => (
                      <li key={r.id} className="border rounded-lg p-3 flex gap-3">
                        <div className="w-16 h-24 sm:w-20 sm:h-28 bg-secondary rounded-md grid place-items-center overflow-hidden shrink-0">
                          {r.ai_generated_videos?.thumbnail_url
                            ? <img src={r.ai_generated_videos.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            : <span className="text-2xl">🎬</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="capitalize">{r.platform}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {r.shared_at ? new Date(r.shared_at).toLocaleString() : ""}
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1 truncate">
                            {r.ai_generated_videos?.video_title ?? r.ai_generated_videos?.ai_avatars?.name ?? "Video"}
                          </p>
                          {r.caption_used && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.caption_used}</p>}
                          <div className="text-xs text-muted-foreground mt-2">
                            {r.referrals_generated ?? 0} referrals · {(r.referrals_generated ?? 0) * 100} Sparks
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Your UGC submissions</CardTitle></CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
                : ugc.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sm text-muted-foreground">No submissions yet. Upload a video to earn 200 Sparks.</p>
                    <Link to="/upload-video"><Button className="h-11"><Upload className="h-4 w-4" /> Upload your video</Button></Link>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {ugc.map((r) => (
                      <li key={r.id} className="border rounded-lg p-3 flex gap-3">
                        <video src={r.video_url} className="w-20 h-28 sm:w-24 sm:h-32 rounded-md object-cover bg-secondary shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={
                              r.submission_status === "approved" ? "default"
                                : r.submission_status === "rejected" ? "destructive" : "secondary"
                            }>{r.submission_status}</Badge>
                            <Badge variant="outline" className="capitalize">{r.platform}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                          </div>
                          <a href={r.social_media_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent underline break-all">
                            <ExternalLink className="h-3 w-3" /> {r.social_media_link}
                          </a>
                          {r.sparks_rewarded > 0 && (
                            <p className="text-xs text-accent">+{r.sparks_rewarded} Sparks earned ✨</p>
                          )}
                          {r.admin_notes && <p className="text-xs italic text-muted-foreground">"{r.admin_notes}"</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <BottomNav />
    </div>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: number; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className={`font-display text-2xl mt-1 ${accent ? "text-accent" : ""}`}>{value}</p>
    </CardContent></Card>
  );
}
