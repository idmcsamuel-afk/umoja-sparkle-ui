import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Pause, Play, RefreshCw, Sparkles, Video, Calendar, TrendingUp, Plus, Download, Share2 } from "lucide-react";

type Stats = {
  videosGenerated: number;
  videosReady: number;
  videosPostedToday: number;
  scriptsQueue: number;
  postsToday: number;
};

export default function AdminContentDirector() {
  const [campaign, setCampaign] = useState<any>(null);
  const [stats, setStats] = useState<Stats>({ videosGenerated: 0, videosReady: 0, videosPostedToday: 0, scriptsQueue: 0, postsToday: 0 });
  const [avatars, setAvatars] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [readyVideos, setReadyVideos] = useState<any[]>([]);
  const [playing, setPlaying] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newCampaign, setNewCampaign] = useState("");

  const load = async () => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const [c, ready, today, postedToday, scripts, av, sched, readyList] = await Promise.all([
      supabase.from("ai_content_campaigns").select("*").eq("status", "active").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("ai_generated_videos").select("id", { count: "exact", head: true }).eq("generation_status", "ready"),
      supabase.from("ai_generated_videos").select("id", { count: "exact", head: true }).gte("created_at", startOfDay.toISOString()),
      supabase.from("ai_scheduled_posts").select("id", { count: "exact", head: true }).eq("post_status", "posted").gte("posted_at", startOfDay.toISOString()),
      supabase.from("ai_generated_scripts").select("id", { count: "exact", head: true }).lt("used_count", 3),
      supabase.from("ai_avatars").select("*").order("performance_score", { ascending: false }).limit(5),
      supabase.from("ai_scheduled_posts").select("id, platform, scheduled_for").eq("post_status", "scheduled").gte("scheduled_for", new Date().toISOString()).lte("scheduled_for", new Date(Date.now() + 86400_000).toISOString()).order("scheduled_for"),
      supabase.from("ai_generated_videos").select("*, ai_avatars(name), ai_generated_scripts(script_text, hook)").eq("generation_status", "ready").order("created_at", { ascending: false }).limit(20),
    ]);
    setCampaign(c.data);
    setStats({
      videosGenerated: today.count ?? 0,
      videosReady: ready.count ?? 0,
      videosPostedToday: postedToday.count ?? 0,
      scriptsQueue: scripts.count ?? 0,
      postsToday: postedToday.count ?? 0,
    });
    setAvatars(av.data ?? []);
    setSchedule(sched.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const runDirector = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("ai-content-director");
    setRunning(false);
    if (error) return toast.error("Director failed: " + error.message);
    toast.success(`Director ran. Scripts: ${data?.scriptsCreated ?? 0}, Videos: ${data?.videosCreated ?? 0}, Scheduled: ${data?.scheduled ?? 0}`);
    if (data && data.heygen_configured === false) {
      toast.warning("HEYGEN_API_KEY not set — videos created in pending state");
    }
    load();
  };

  const pollStatus = async () => {
    const { data, error } = await supabase.functions.invoke("ai-check-heygen-status");
    if (error) return toast.error("Poll failed: " + error.message);
    toast.success(`Updated admin: ${data?.admin_updated ?? 0}, member: ${data?.member_updated ?? 0}`);
    load();
  };

  const toggleCampaign = async () => {
    if (!campaign) return;
    const next = campaign.status === "active" ? "paused" : "active";
    await supabase.from("ai_content_campaigns").update({ status: next }).eq("id", campaign.id);
    load();
  };

  const createCampaign = async () => {
    if (!newCampaign.trim()) return;
    await supabase.from("ai_content_campaigns").insert({ name: newCampaign.trim() });
    setNewCampaign("");
    load();
  };

  const toggleSetting = async (key: string, value: boolean) => {
    if (!campaign) return;
    const settings = { ...(campaign.autonomous_settings ?? {}), [key]: value };
    await supabase.from("ai_content_campaigns").update({ autonomous_settings: settings }).eq("id", campaign.id);
    load();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const TARGET = campaign?.autonomous_settings?.target_queue_max ?? 150;
  const queuePct = Math.min(100, (stats.videosReady / TARGET) * 100);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">AI Content Factory</p>
          <h1 className="font-display text-2xl mt-1 flex items-center gap-2"><Bot className="h-6 w-6" /> Content Director</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={campaign?.status === "active" ? "default" : "secondary"} className="gap-1">
            <span className={`h-2 w-2 rounded-full ${campaign?.status === "active" ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
            {campaign?.status === "active" ? "Autonomous" : "Paused"}
          </Badge>
          <Button size="sm" variant="outline" onClick={pollStatus}><RefreshCw className="h-4 w-4" /> Sync HeyGen</Button>
          <Button size="sm" onClick={runDirector} disabled={running}>
            {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Run Director Now
          </Button>
        </div>
      </header>

      {!campaign && (
        <Card>
          <CardHeader><CardTitle>Start a campaign</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder="Campaign name e.g. May Referral Blitz" value={newCampaign} onChange={(e) => setNewCampaign(e.target.value)} />
            <Button onClick={createCampaign}><Plus className="h-4 w-4" /> Create</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Video} label="Videos Generated Today" value={stats.videosGenerated} sub={`Target ${campaign?.target_videos_per_day ?? 10}/day`} />
        <StatCard icon={Sparkles} label="Queue Ready" value={stats.videosReady} sub={`Target ${TARGET}`} />
        <StatCard icon={Calendar} label="Posted Today" value={stats.postsToday} sub={`Target ${campaign?.target_posts_per_day ?? 5}/day`} />
        <StatCard icon={TrendingUp} label="Script Bank" value={stats.scriptsQueue} sub="Unused scripts" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Video Queue</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Progress value={queuePct} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.videosReady} ready</span>
            <span>Target {TARGET}</span>
          </div>
        </CardContent>
      </Card>

      {campaign && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Active Campaign</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">{campaign.name}</p>
                <p className="text-xs text-muted-foreground mt-1">Platforms: {(campaign.platforms ?? []).join(", ")}</p>
              </div>
              <Button size="sm" variant="outline" onClick={toggleCampaign}>
                {campaign.status === "active" ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Resume</>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Autonomous Mode</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                ["auto_scripts", "Auto-generate scripts"],
                ["auto_videos", "Auto-create videos when queue low"],
                ["auto_schedule", "Auto-schedule posts"],
                ["auto_pause_low", "Auto-pause low performers"],
                ["auto_boost_high", "Auto-boost high performers"],
              ].map(([k, l]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <Label htmlFor={k} className="cursor-pointer">{l}</Label>
                  <Switch id={k} checked={!!campaign.autonomous_settings?.[k]} onCheckedChange={(v) => toggleSetting(k, v)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Top Avatars (last 7 days)</CardTitle></CardHeader>
        <CardContent>
          {avatars.length === 0 ? (
            <p className="text-sm text-muted-foreground">No avatars yet. Add them in the database (HeyGen avatar_id + voice_id).</p>
          ) : (
            <ul className="space-y-2">
              {avatars.map((a, i) => (
                <li key={a.id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                  <span>{i + 1}. {a.name} {!a.is_active && <Badge variant="secondary" className="ml-2">paused</Badge>}</span>
                  <span className="text-muted-foreground">{a.performance_score}% · {a.times_used} videos</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Next 24h Schedule</CardTitle></CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts scheduled. Run the director to schedule.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {schedule.slice(0, 15).map((s) => (
                <li key={s.id} className="flex justify-between border-b last:border-0 py-1.5">
                  <span className="capitalize">{s.platform}</span>
                  <span className="text-muted-foreground">{new Date(s.scheduled_for).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
        <p className="font-display text-2xl mt-1">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
