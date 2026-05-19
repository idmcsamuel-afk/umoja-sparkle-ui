import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Video, Share2, Sparkles, Users } from "lucide-react";

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

export default function MemberVideos() {
  const { user } = useAuth();
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("member_video_shares")
        .select("*, ai_generated_videos(video_title, thumbnail_url, ai_avatars(name))")
        .eq("member_id", user.id)
        .order("shared_at", { ascending: false })
        .limit(200);
      setShares((data ?? []) as any);
      setLoading(false);
    })();
  }, [user]);

  const totals = {
    shares: shares.length,
    referrals: shares.reduce((s, r) => s + (r.referrals_generated ?? 0), 0),
    sparks: shares.reduce((s, r) => s + (r.referrals_generated ?? 0), 0) * 100,
    platforms: new Set(shares.map((r) => r.platform)).size,
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">My stats</p>
          <h1 className="font-display text-2xl mt-1">📊 Sharing history</h1>
          <p className="text-sm text-muted-foreground mt-1">Every video you've shared and what you've earned.</p>
        </div>
        <Link to="/browse-videos"><Button className="h-11"><Video className="h-4 w-4" /> Browse videos</Button></Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Share2 className="h-4 w-4" />} label="Videos shared" value={totals.shares} />
        <Stat icon={<Users className="h-4 w-4" />} label="Referrals" value={totals.referrals} />
        <Stat icon={<Sparkles className="h-4 w-4" />} label="Sparks earned" value={totals.sparks} accent />
        <Stat icon={<Video className="h-4 w-4" />} label="Platforms" value={totals.platforms} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent shares</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : shares.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">You haven't shared any videos yet.</p>
              <Link to="/browse-videos"><Button className="h-11">🎬 Browse videos to share</Button></Link>
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
                    {r.caption_used && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.caption_used}</p>
                    )}
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
