import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Bot, Sparkles, Wand2, Play, Pause, Trash2, ChevronDown, Loader2,
  Video, TrendingUp, Eye, Clock, Plus, X, Volume2, Lightbulb, Check, AlertCircle, Crown, ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getTierConfig, usagePct, usageColor, type ZCreatorTier } from "@/lib/zcreatorTiers";

const NICHES = ["Finance", "Health", "Tech", "Business", "Entertainment", "Lifestyle", "Education"];
const TONES = ["Professional", "Casual", "Humorous", "Inspirational", "Educational"];
const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "3x_week", label: "3x per week" },
  { value: "weekly", label: "Weekly" },
  { value: "manual", label: "Manual only" },
];
const PLATFORMS = [
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram Reels" },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  script_ready: { label: "Script Ready", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  generating: { label: "Generating Video", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  ready: { label: "Ready to Publish", cls: "bg-green-500/15 text-green-500 border-green-500/30" },
  published: { label: "Published", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  failed: { label: "Failed", cls: "bg-red-500/15 text-red-500 border-red-500/30" },
};

type Agent = any;
type QueueItem = any;

export default function CreatorStudio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [sub, setSub] = useState<any>(null);

  // form state
  const [agentName, setAgentName] = useState("");
  const [niche, setNiche] = useState<string>("");
  const [tone, setTone] = useState<string>("");
  const [audience, setAudience] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [frequency, setFrequency] = useState<string>("weekly");
  const [platforms, setPlatforms] = useState<string[]>(["youtube"]);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [autoPublish, setAutoPublish] = useState(false);
  const [voiceTier, setVoiceTier] = useState<"standard" | "premium">("standard");
  const [previewingTier, setPreviewingTier] = useState<"standard" | "premium" | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);

  const [publishedThisMonth, setPublishedThisMonth] = useState(0);
  const [totalViews, setTotalViews] = useState(0);

  const loadAll = async () => {
    if (!user) return;
    const [a, q, s] = await Promise.all([
      supabase
        .from("zcreator_story_agents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("zcreator_content_queue")
        .select("id, script_title, status, video_style, created_at, thumbnail_url, platforms, agent_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("zcreator_subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setAgents(a.data ?? []);
    setQueue(q.data ?? []);
    setSub(s.data ?? null);

    // stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const ids = (q.data ?? []).map((x: any) => x.id);
    const [pub, an] = await Promise.all([
      supabase
        .from("zcreator_content_queue")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "published")
        .gte("actual_published_at", startOfMonth.toISOString()),
      ids.length
        ? supabase
            .from("zcreator_analytics")
            .select("views")
            .in("content_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setPublishedThisMonth(pub.count ?? 0);
    setTotalViews(((an as any).data ?? []).reduce((s: number, r: any) => s + (r.views ?? 0), 0));
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [user?.id]);

  // realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("zcreator_queue_" + user.id + "_" + Math.random().toString(36).slice(2, 9))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zcreator_content_queue", filter: `user_id=eq.${user.id}` },
        () => loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zcreator_story_agents", filter: `user_id=eq.${user.id}` },
        () => loadAll(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user?.id]);

  const stats = useMemo(() => ({
    totalScripts: queue.length,
    inProduction: queue.filter((q) => q.status === "generating" || q.status === "script_ready").length,
    publishedThisMonth,
    totalViews,
  }), [queue, publishedThisMonth, totalViews]);

  const addTopic = () => {
    const t = topicInput.trim();
    if (!t) return;
    if (topics.includes(t)) { setTopicInput(""); return; }
    setTopics([...topics, t]);
    setTopicInput("");
  };

  const togglePlatform = (id: string) => {
    setPlatforms((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const createAgent = async () => {
    if (!user) return toast.error("Please sign in");
    if (!agentName.trim() || !niche) return toast.error("Agent name and niche are required");
    setCreating(true);
    const { error } = await supabase.from("zcreator_story_agents").insert({
      user_id: user.id,
      agent_name: agentName.trim(),
      niche: niche.toLowerCase(),
      brand_voice: { tone, target_audience: audience, key_topics: topics, voice_tier: voiceTier },
      content_frequency: frequency,
      platforms,
      auto_generate: autoGenerate,
      auto_publish: autoPublish,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Agent created");
    setAgentName(""); setNiche(""); setTone(""); setAudience(""); setTopics([]);
    setFrequency("weekly"); setPlatforms(["youtube"]);
    setAutoGenerate(false); setAutoPublish(false);
    setVoiceTier("standard");
    loadAll();
  };

  const previewVoice = async (tier: "standard" | "premium") => {
    setPreviewingTier(tier);
    try {
      const sampleText = tier === "premium"
        ? "Hey, this is your premium studio-quality voice. Notice the rich tone and natural pacing."
        : "Hi there — this is your free Edge TTS voice, with natural pauses and emotion built in.";
      const { data, error } = await supabase.functions.invoke("zcreator-generate-voice", {
        body: { text: sampleText, tier, returnBase64: true },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const b64 = (data as any)?.audioBase64;
      if (!b64) throw new Error("No audio returned");
      const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
      await audio.play();
    } catch (e: any) {
      toast.error(`Preview failed: ${e?.message ?? "unknown"}`);
    } finally {
      setPreviewingTier(null);
    }
  };

  const toggleActive = async (a: Agent) => {
    await supabase.from("zcreator_story_agents").update({ active: !a.active }).eq("id", a.id);
    loadAll();
  };

  const deleteAgent = async (a: Agent) => {
    if (!confirm(`Delete agent "${a.agent_name}"?`)) return;
    await supabase.from("zcreator_story_agents").delete().eq("id", a.id);
    toast.success("Agent deleted");
    loadAll();
  };

  const generateNow = async (a: Agent) => {
    if (limitReached) {
      toast.error("Creator Studio monthly limit reached. Upgrade to continue.");
      navigate("/creator-studio/subscription");
      return;
    }
    setGeneratingId(a.id);
    const { data, error } = await supabase.functions.invoke("zcreator-story-agent", {
      body: { agentId: a.id, manualTrigger: true },
    });
    setGeneratingId(null);
    if (error) return toast.error(`Generation failed: ${error.message}`);
    if ((data as any)?.error) {
      const err = (data as any).error;
      if (err === "monthly_limit_reached" || /limit reached/i.test(err)) {
        toast.error("Creator Studio limit reached. Upgrade your plan.");
        navigate("/creator-studio/subscription");
        return;
      }
      return toast.error(`Generation failed: ${err}`);
    }
    toast.success("Script generated! View in Videos tab");
    loadAll();
  };

  const currentTier = (sub?.tier ?? "free") as ZCreatorTier;
  const currentCfg = getTierConfig(currentTier);
  const videosUsed = Number(sub?.videos_used_this_month ?? 0);
  const videoLimit = Number(sub?.videos_per_month ?? currentCfg.videosPerMonth);
  const usagePctVal = usagePct(videosUsed, videoLimit);
  const usageCls = usageColor(usagePctVal);
  const limitReached = videosUsed >= videoLimit;
  const limitWarning = usagePctVal >= 80 && !limitReached;

  return (
    <div className="min-h-screen pb-28 md:pb-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Autonomous Content Factory</p>
            <h1 className="font-display text-3xl sm:text-4xl mt-1 flex items-center gap-2">
              Creator Studio <span aria-hidden>🎬</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Spin up an AI story agent that researches trends and ships short-form videos on autopilot.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/creator-studio/subscription")}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${usageCls} hover:opacity-80 transition-opacity flex items-center gap-1.5`}
            title="Manage Creator Studio plan"
          >
            <Crown className="h-3 w-3" /> {videosUsed}/{videoLimit} videos · {currentCfg.name}
          </button>
        </header>

        {limitReached && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Creator Studio monthly limit reached</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You've used all {videoLimit} videos on your <b>{currentCfg.name}</b> plan. Upgrade to keep generating.
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/creator-studio/subscription")}>
              Upgrade Creator Studio
            </Button>
          </div>
        )}
        {limitWarning && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Heads up — running low on Creator Studio videos</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You've used {videosUsed} of {videoLimit} videos this month on your <b>{currentCfg.name}</b> plan.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/creator-studio/subscription")}>
              View Plans
            </Button>
          </div>
        )}

        {/* Quick stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Sparkles} label="Scripts Generated" value={stats.totalScripts} />
          <StatCard icon={Video} label="In Production" value={stats.inProduction} />
          <StatCard icon={TrendingUp} label="Published / Month" value={stats.publishedThisMonth} />
          <StatCard icon={Eye} label="Total Views" value={stats.totalViews} />
        </section>

        {/* Faceless strategy guide */}
        <Collapsible open={strategyOpen} onOpenChange={setStrategyOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full text-left">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4 text-amber-500" /> 🎬 Faceless YouTube Success Strategy
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${strategyOpen ? "rotate-180" : ""}`} />
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  "Use commentary style — reactions, analysis, breakdowns",
                  "Mix stock footage with screen recordings and graphics",
                  "Add your own insights and opinions to scripts",
                  "Natural voice pacing with pauses and emotion",
                  "SEO-optimized titles, descriptions, and tags",
                ].map((tip) => (
                  <div key={tip} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> <span>{tip}</span>
                  </div>
                ))}
                {[
                  "Avoid pure stock montages with robotic voice",
                  "Don't copy existing videos word-for-word",
                  "Never use clickbait without delivering value",
                ].map((tip) => (
                  <div key={tip} className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> <span>{tip}</span>
                  </div>
                ))}
                <p className="sm:col-span-2 text-xs text-muted-foreground pt-2">
                  Full monetization guide coming soon.
                </p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Agent config */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" /> Create Your AI Content Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input id="agent-name" placeholder="e.g. Finance Bro Daily" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Niche</Label>
                <Select value={niche} onValueChange={setNiche}>
                  <SelectTrigger><SelectValue placeholder="Pick a niche" /></SelectTrigger>
                  <SelectContent>{NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <Collapsible open={voiceOpen} onOpenChange={setVoiceOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  Brand Voice
                  <ChevronDown className={`h-4 w-4 transition-transform ${voiceOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger><SelectValue placeholder="Pick a tone" /></SelectTrigger>
                      <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="audience">Target Audience</Label>
                    <Input id="audience" placeholder="e.g. Young entrepreneurs" value={audience} onChange={(e) => setAudience(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Key Topics</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a topic and press Enter"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addTopic}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {topics.map((t) => (
                        <Badge key={t} variant="secondary" className="gap-1">
                          {t}
                          <button type="button" onClick={() => setTopics(topics.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Content Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Platforms</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {PLATFORMS.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={platforms.includes(p.id)} onCheckedChange={() => togglePlatform(p.id)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Voice quality */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-3">
              <Volume2 className="h-4 w-4 mt-0.5 text-accent" />
              <div className="text-xs">
                <p className="font-medium text-foreground">Professional AI voice included</p>
                <p className="text-muted-foreground">Every video uses our studio-quality ElevenLabs voice. No setup needed.</p>
              </div>
            </div>


            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <ToggleRow

                label="Auto-generate scripts"
                hint="Agent runs on its frequency without prompting"
                checked={autoGenerate}
                onChange={setAutoGenerate}
              />
              <ToggleRow
                label="Auto-publish"
                hint="Skip approval and publish straight to platforms"
                checked={autoPublish}
                onChange={setAutoPublish}
              />
            </div>

            <Button onClick={createAgent} disabled={creating} className="w-full sm:w-auto">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Create Agent
            </Button>
          </CardContent>
        </Card>

        {/* Active agents */}
        <section className="space-y-3">
          <h2 className="font-display text-xl flex items-center gap-2"><Wand2 className="h-5 w-5" /> Your Agents</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : agents.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No agents yet. Create your first one above.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map((a) => (
                <Card key={a.id} className={!a.active ? "opacity-70" : ""}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{a.agent_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{a.niche ?? "general"}</p>
                      </div>
                      <Badge variant={a.active ? "default" : "secondary"}>{a.active ? "Active" : "Paused"}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <Stat label="Score" value={`${Math.round(a.performance_score ?? 0)}`} />
                      <Stat label="Videos" value={a.videos_created ?? 0} />
                      <Stat label="Updated" value={timeAgo(a.updated_at)} />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => generateNow(a)}
                        disabled={generatingId === a.id || limitReached}
                        title={limitReached ? "Upgrade Creator Studio plan to continue" : undefined}
                      >
                        {generatingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Generate Script Now
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(a)}>
                        {a.active ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteAgent(a)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Content Queue */}
        <section className="space-y-3">
          <h2 className="font-display text-xl flex items-center gap-2"><Video className="h-5 w-5" /> Content Queue</h2>
          {queue.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No scripts yet. Generate one from an agent above.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {queue.map((q) => {
                const meta = STATUS_META[q.status] ?? { label: q.status, cls: "bg-muted text-foreground" };
                return (
                  <Link
                    key={q.id}
                    to={`/creator-studio/videos?highlight=${q.id}`}
                    aria-label={`View details for ${q.script_title ?? "script"}`}
                    className="group rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-accent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="aspect-video bg-muted relative">
                      {q.thumbnail_url ? (
                        <img src={q.thumbnail_url} alt={q.script_title ?? "Script"} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                          <Sparkles className="h-8 w-8" />
                        </div>
                      )}
                      <Badge className={`absolute top-2 left-2 ${meta.cls}`} variant="outline">{meta.label}</Badge>
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-sm font-medium line-clamp-2 group-hover:text-accent transition-smooth">
                        {q.script_title ?? "Untitled script"}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {timeAgo(q.created_at)}
                        </p>
                        <span className="text-[11px] text-accent flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          View details <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <BottomNav />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <p className="font-display text-2xl mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
