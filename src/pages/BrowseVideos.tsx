import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, Copy, Share2, Download, Instagram, Music2, Facebook, MessageCircle, Twitter } from "lucide-react";

type Video = {
  id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_title: string | null;
  video_caption: string | null;
  duration_seconds: number | null;
  avatar_id: string | null;
  caption_instagram: string | null;
  caption_tiktok: string | null;
  caption_facebook: string | null;
  hashtags: string | null;
  created_at: string;
  ai_avatars?: { id: string; name: string | null; preview_image_url: string | null } | null;
};

const PAGE_SIZE = 12;

const personalize = (caption: string | null | undefined, code: string | null | undefined, hashtags?: string | null) => {
  const link = code ? `https://umojarise.com/join?ref=${code}` : "https://umojarise.com";
  const base = (caption ?? "")
    .replace(/\[REFERRAL_LINK\]/g, link)
    .replace(/\{REFERRAL_LINK\}/g, link);
  return hashtags ? `${base}\n\n${hashtags}` : base;
};

export default function BrowseVideos() {
  const { user, member } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [avatars, setAvatars] = useState<{ id: string; name: string | null }[]>([]);
  const [avatarFilter, setAvatarFilter] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Video | null>(null);
  const [share, setShare] = useState<Video | null>(null);
  const [stats, setStats] = useState({ total: 0, byPlatform: {} as Record<string, number>, referrals: 0 });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ai_generated_videos")
      .select("*, ai_avatars(id, name, preview_image_url)")
      .eq("generation_status", "ready")
      .order("created_at", { ascending: sort === "oldest" })
      .limit(200);
    setVideos((data ?? []) as any);
    const av = await supabase.from("ai_avatars").select("id, name").eq("is_active", true);
    setAvatars(av.data ?? []);
    setLoading(false);
  };

  const loadStats = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("member_video_shares")
      .select("platform, referrals_generated")
      .eq("member_id", user.id);
    const rows = data ?? [];
    const byPlatform: Record<string, number> = {};
    let refs = 0;
    rows.forEach((r: any) => {
      byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + 1;
      refs += r.referrals_generated ?? 0;
    });
    setStats({ total: rows.length, byPlatform, referrals: refs });
  };

  useEffect(() => { load(); }, [sort]);
  useEffect(() => { loadStats(); }, [user]);

  const filtered = useMemo(
    () => videos.filter((v) => avatarFilter === "all" || v.avatar_id === avatarFilter),
    [videos, avatarFilter],
  );
  const visible = filtered.slice(0, page * PAGE_SIZE);

  const code = member?.referral_code ?? null;
  const sparksEarned = stats.referrals * 100;

  const recordShare = async (video: Video, platform: string, caption: string) => {
    if (!user) return;
    await supabase.from("member_video_shares").insert({
      member_id: user.id, video_id: video.id, platform, caption_used: caption,
    });
    loadStats();
  };

  const copyCaption = async (video: Video, platform: "instagram" | "tiktok" | "facebook") => {
    const raw = (video as any)[`caption_${platform}`] || video.video_caption;
    const text = personalize(raw, code, video.hashtags);
    await navigator.clipboard.writeText(text);
    await recordShare(video, platform, text);
    toast.success(`${platform} caption copied`);
  };

  const download = async (video: Video, withCaptions = false) => {
    if (!video.video_url) return toast.error("Video not ready");
    if (withCaptions) {
      const block = (["instagram", "tiktok", "facebook"] as const)
        .map((p) => `--- ${p.toUpperCase()} ---\n${personalize((video as any)[`caption_${p}`] || video.video_caption, code, video.hashtags)}`)
        .join("\n\n");
      await navigator.clipboard.writeText(block);
      toast.success("All captions copied to clipboard");
    }
    const a = document.createElement("a");
    a.href = video.video_url; a.download = `umoja-${video.id}.mp4`; a.target = "_blank";
    a.click();
    await recordShare(video, "download", video.video_url);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Video library</p>
        <h1 className="font-display text-2xl md:text-3xl mt-1">🎬 Share & Earn</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Choose videos to share with your referral link. Earn 100 Sparks per friend who joins.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Videos shared" value={stats.total} />
        <Stat label="Instagram" value={stats.byPlatform.instagram ?? 0} />
        <Stat label="TikTok" value={stats.byPlatform.tiktok ?? 0} />
        <Stat label="Facebook" value={stats.byPlatform.facebook ?? 0} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Referrals from videos" value={stats.referrals} />
        <Stat label="Sparks earned" value={sparksEarned} accent />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <Select value={avatarFilter} onValueChange={setAvatarFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All avatars" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All avatars</SelectItem>
              {avatars.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name ?? "Avatar"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground sm:ml-auto">{filtered.length} videos</span>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : visible.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No videos yet. Check back soon.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <div className="aspect-[9/16] bg-secondary relative group">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt={v.video_title ?? "Video"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-4xl">🎬</div>
                )}
                <button
                  onClick={() => setPreview(v)}
                  className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Preview"
                >
                  <Play className="h-12 w-12 text-white" />
                </button>
              </div>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{v.ai_avatars?.name ?? "Avatar"}</span>
                  {v.duration_seconds && <Badge variant="secondary">{v.duration_seconds}s</Badge>}
                </div>
                {v.video_title && <p className="text-xs text-muted-foreground line-clamp-2">{v.video_title}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreview(v)}>
                    <Play className="h-3.5 w-3.5" /> Preview
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => setShare(v)}>
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {visible.length < filtered.length && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Load more videos</Button>
        </div>
      )}

      {/* Preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{preview?.ai_avatars?.name ?? "Preview"}</DialogTitle></DialogHeader>
          {preview?.video_url && (
            <video src={preview.video_url} controls autoPlay className="w-full rounded-md" />
          )}
          <Button onClick={() => { if (preview) { setShare(preview); setPreview(null); } }}>
            <Share2 className="h-4 w-4" /> Share this video
          </Button>
        </DialogContent>
      </Dialog>

      {/* Share modal */}
      <Dialog open={!!share} onOpenChange={(o) => !o && setShare(null)}>
        <DialogContent className="max-w-lg w-screen h-screen sm:w-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-lg overflow-y-auto">
          <DialogHeader><DialogTitle>📱 Share this video</DialogTitle></DialogHeader>
          {share && (
            <div className="space-y-4">
              {share.video_url && (
                <video src={share.video_url} controls className="w-full rounded-md max-h-64" />
              )}

              {!code && (
                <div className="text-xs p-3 rounded bg-muted">
                  Set up your referral code first to personalize captions.
                </div>
              )}

              {(["instagram", "tiktok", "facebook"] as const).map((p) => {
                const Icon = p === "instagram" ? Instagram : p === "tiktok" ? Music2 : Facebook;
                const raw = (share as any)[`caption_${p}`] || share.video_caption || "";
                const text = personalize(raw, code, share.hashtags);
                return (
                  <div key={p} className="space-y-2 border rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm font-medium capitalize">
                      <Icon className="h-4 w-4" /> {p}
                    </div>
                    <Textarea value={text} readOnly rows={4} className="text-xs" />
                    <Button size="sm" variant="outline" className="w-full" onClick={() => copyCaption(share, p)}>
                      <Copy className="h-3.5 w-3.5" /> Copy {p} caption
                    </Button>
                  </div>
                );
              })}

              {/* One-tap share */}
              <div className="space-y-2 border rounded-lg p-3">
                <div className="text-sm font-medium">⚡ One-tap share</div>
                <p className="text-xs text-muted-foreground">Uses your Facebook caption with your referral link.</p>
                <div className="grid grid-cols-3 gap-2">
                  {(() => {
                    const raw = share.caption_facebook || share.video_caption || "";
                    const text = personalize(raw, code, share.hashtags);
                    const link = code ? `https://umojarise.com/join?ref=${code}` : "https://umojarise.com";
                    const encText = encodeURIComponent(text);
                    const encLink = encodeURIComponent(link);
                    const open = (url: string, platform: string) => {
                      window.open(url, "_blank", "noopener,noreferrer");
                      recordShare(share, platform, text);
                    };
                    return (
                      <>
                        <Button size="sm" variant="outline" onClick={() => open(`https://wa.me/?text=${encText}`, "whatsapp")}>
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => open(`https://twitter.com/intent/tweet?text=${encText}`, "twitter")}>
                          <Twitter className="h-3.5 w-3.5" /> X
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encLink}&quote=${encText}`, "facebook")}>
                          <Facebook className="h-3.5 w-3.5" /> Facebook
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-2 border rounded-lg p-3">
                <div className="text-sm font-medium">📥 Download</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="lg" variant="outline" className="flex-1 h-12" onClick={() => download(share, false)}>
                    <Download className="h-4 w-4" /> Video only
                  </Button>
                  <Button size="lg" className="flex-1 h-12" onClick={() => download(share, true)}>
                    <Download className="h-4 w-4" /> Video + captions
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground p-3 bg-accent/10 rounded">
                💡 Videos with your personal link earn you 100 Sparks per referral.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl mt-1 ${accent ? "text-accent" : ""}`}>{value}</p>
    </CardContent></Card>
  );
}
