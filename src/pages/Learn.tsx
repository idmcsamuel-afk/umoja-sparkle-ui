import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, SkipBack, SkipForward, Download, Share2, Volume2, Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Chapter = { time: string | number; title?: string; label?: string };
type RelLink = { text?: string; label?: string; url?: string; to?: string };

type Episode = {
  id: string;
  title: string;
  description: string;
  audio_url: string | null;
  cover_image_url: string | null;
  duration_seconds: number;
  episode_number: number | null;
  status: string;
  published_at: string | null;
  timestamps_json: Chapter[];
  takeaways: string[];
  related_links_json: RelLink[];
  play_count: number;
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function parseTime(t: string | number): number {
  if (typeof t === "number") return t;
  const parts = t.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export default function Learn() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [playLogged, setPlayLogged] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("podcast_episodes" as any)
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) toast({ title: "Couldn't load episodes", description: error.message });
      const list = (data as any) ?? [];
      setEpisodes(list);
      if (list.length) setSelectedId(list[0].id);
      setLoading(false);
    })();
  }, []);

  const selected = episodes.find(e => e.id === selectedId) || null;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => {
      setPlaying(false);
      if (selected) supabase.from("podcast_analytics" as any).insert({
        episode_id: selected.id, action: "complete",
        seconds_listened: a.currentTime, percentage_completed: 100,
      } as any);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [selected]);

  useEffect(() => {
    setPlayLogged(false);
    setCurrent(0);
    setPlaying(false);
  }, [selectedId]);

  const logPlay = async () => {
    if (!selected || playLogged) return;
    setPlayLogged(true);
    await supabase.rpc("increment_podcast_play" as any, { _episode: selected.id });
    await supabase.from("podcast_analytics" as any).insert({
      episode_id: selected.id, action: "play",
    } as any);
  };

  const toggle = async () => {
    const a = audioRef.current;
    if (!a || !selected) return;
    if (a.paused) {
      try {
        await a.play();
        setPlaying(true);
        await logPlay();
      } catch {
        toast({ title: "Couldn't play audio", description: "Tap play again or check the audio file." });
      }
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const seek = (t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(duration || 0, t));
    setCurrent(a.currentTime);
  };

  const changeSpeed = () => {
    const a = audioRef.current;
    if (!a) return;
    const i = SPEEDS.indexOf(speed);
    const next = SPEEDS[(i + 1) % SPEEDS.length];
    a.playbackRate = next;
    setSpeed(next);
  };

  const onVolume = (v: number[]) => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = v[0];
    setVolume(v[0]);
  };

  const share = async () => {
    if (!selected) return;
    const url = window.location.href;
    const data = { title: selected.title, text: selected.description, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied" });
      }
    } catch {/* user cancelled */}
  };

  if (loading) {
    return <div className="container max-w-3xl p-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!selected) {
    return (
      <div className="container max-w-3xl px-4 py-10 text-center">
        <Headphones className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h1 className="font-display text-2xl">No episodes yet</h1>
        <p className="text-sm text-muted-foreground mt-2">Check back soon for UMOJA podcast episodes.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl px-4 py-6 md:py-10 space-y-6">
      <Card className="overflow-hidden border-border">
        <div className="relative aspect-[16/9] bg-gradient-to-br from-primary via-accent to-primary/50 flex items-center justify-center">
          {selected.cover_image_url ? (
            <img src={selected.cover_image_url} alt={selected.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Headphones className="h-20 w-20 text-primary-foreground/80" />
          )}
          <div className="absolute bottom-0 inset-x-0 p-4 md:p-6 bg-gradient-to-t from-background/95 to-transparent">
            <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">{selected.title}</h1>
            <p className="text-xs text-muted-foreground mt-1">Duration: {fmt(selected.duration_seconds || duration)} · {selected.play_count} plays</p>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-4">
          <audio ref={audioRef} src={selected.audio_url ?? ""} preload="metadata" playsInline />

          <div className="flex items-center justify-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => seek(current - 15)}><SkipBack className="h-5 w-5" /></Button>
            <Button size="icon" onClick={toggle} className="h-16 w-16 rounded-full">
              {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => seek(current + 30)}><SkipForward className="h-5 w-5" /></Button>
          </div>

          <div className="space-y-1">
            <Slider value={[current]} max={duration || 1} step={1} onValueChange={(v) => seek(v[0])} />
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{fmt(current)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-[140px] flex-1">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Slider value={[volume]} max={1} step={0.05} onValueChange={onVolume} className="max-w-[140px]" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={changeSpeed}>⚡ {speed}x</Button>
              {selected.audio_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={selected.audio_url} download><Download className="h-4 w-4" /></a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-6 space-y-4">
        <h2 className="text-lg font-semibold">📝 Show Notes</h2>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.description}</p>

        {selected.timestamps_json?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Chapters</h3>
            <ul className="space-y-1">
              {selected.timestamps_json.map((c, i) => {
                const secs = parseTime(c.time);
                return (
                  <li key={i}>
                    <button
                      onClick={() => { seek(secs); audioRef.current?.play().then(() => { setPlaying(true); logPlay(); }).catch(() => {}); }}
                      className="text-sm text-left w-full px-2 py-1.5 rounded-md hover:bg-accent/10 hover:text-accent transition-colors flex gap-3"
                    >
                      <span className="tabular-nums text-muted-foreground w-16">{typeof c.time === "string" ? c.time : fmt(secs)}</span>
                      <span>{c.title || c.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {selected.takeaways?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Key takeaways</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {selected.takeaways.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}

        {selected.related_links_json?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">🔗 Related</h3>
            <div className="flex flex-wrap gap-2">
              {selected.related_links_json.map((r, i) => {
                const url = r.url || r.to || "#";
                const isExternal = url.startsWith("http");
                const label = r.text || r.label || url;
                return isExternal ? (
                  <Button key={i} variant="secondary" size="sm" asChild>
                    <a href={url} target="_blank" rel="noreferrer">{label}</a>
                  </Button>
                ) : (
                  <Button key={i} variant="secondary" size="sm" asChild>
                    <Link to={url}>{label}</Link>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {episodes.length > 1 && (
        <Card className="p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-3">More episodes</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {episodes.filter(e => e.id !== selected.id).map(e => (
              <button key={e.id} onClick={() => setSelectedId(e.id)}
                className="text-left p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors flex gap-3">
                <div className="h-14 w-14 rounded bg-gradient-to-br from-primary to-accent flex-shrink-0 overflow-hidden">
                  {e.cover_image_url && <img src={e.cover_image_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{fmt(e.duration_seconds)} · {e.play_count} plays</div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
