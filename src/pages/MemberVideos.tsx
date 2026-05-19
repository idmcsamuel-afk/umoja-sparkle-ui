import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Share2, Download, Trophy, Eye, Copy } from "lucide-react";

export default function MemberVideos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const [v, lb] = await Promise.all([
      supabase.from("member_generated_videos").select("*").eq("member_id", user.id).order("created_at", { ascending: false }),
      supabase.rpc("member_video_leaderboard", { _limit: 10 }),
    ]);
    setVideos(v.data ?? []);
    setLeaderboard(lb.data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const share = async (v: any) => {
    await supabase.rpc("bump_member_video_metric", { _id: v.id, _metric: "share" });
    const text = `${v.caption ?? ""}\n${v.video_url ?? v.referral_link ?? ""}`;
    if (navigator.share) {
      try { await navigator.share({ text, url: v.video_url ?? v.referral_link ?? undefined }); }
      catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
    load();
  };

  const download = async (v: any) => {
    if (!v.video_url) return toast.error("Video not ready yet");
    await supabase.rpc("bump_member_video_metric", { _id: v.id, _metric: "download" });
    const a = document.createElement("a");
    a.href = v.video_url; a.download = `umoja-${v.id}.mp4`; a.target = "_blank";
    a.click();
    load();
  };

  const totals = {
    videos: videos.length,
    shares: videos.reduce((s, v) => s + (v.share_count ?? 0), 0),
    signups: videos.reduce((s, v) => s + (v.signups_attributed ?? 0), 0),
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">My videos</p>
          <h1 className="font-display text-2xl mt-1">Your UMOJA video library</h1>
        </div>
        <Link to="/create-video"><Button><Plus className="h-4 w-4" /> Create My Video</Button></Link>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Videos" value={totals.videos} />
        <Stat label="Total Shares" value={totals.shares} />
        <Stat label="Signups Attributed" value={totals.signups} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your videos</CardTitle></CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No videos yet. Create your first one.</p>
          ) : (
            <ul className="space-y-3">
              {videos.map((v) => (
                <li key={v.id} className="border rounded-lg p-3 flex flex-col md:flex-row gap-3">
                  <div className="w-full md:w-32 aspect-[9/16] bg-secondary rounded-md grid place-items-center text-3xl overflow-hidden">
                    {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" /> : "🎬"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={v.generation_status === "ready" ? "default" : v.generation_status === "failed" ? "destructive" : "secondary"}>
                        {v.generation_status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm mt-2 line-clamp-3">{v.caption ?? v.script_text}</p>
                    {v.error_message && <p className="text-xs text-destructive mt-1">{v.error_message}</p>}
                    <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                      <span><Eye className="inline h-3 w-3" /> {v.view_count ?? 0}</span>
                      <span><Share2 className="inline h-3 w-3" /> {v.share_count ?? 0}</span>
                      <span><Download className="inline h-3 w-3" /> {v.download_count ?? 0}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" disabled={v.generation_status !== "ready"} onClick={() => share(v)}><Share2 className="h-4 w-4" /> Share</Button>
                      <Button size="sm" variant="outline" disabled={v.generation_status !== "ready"} onClick={() => download(v)}><Download className="h-4 w-4" /> Download</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-accent" /> Top creators</CardTitle></CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No videos shared yet. Be the first.</p>
          ) : (
            <ul className="space-y-2">
              {leaderboard.map((row: any, i: number) => (
                <li key={row.member_id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                  <span>{i + 1}. {row.full_name}</span>
                  <span className="text-xs text-muted-foreground">{row.videos_count} videos · {row.total_shares} shares · {row.total_signups} signups</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl mt-1">{value}</p>
    </CardContent></Card>
  );
}
