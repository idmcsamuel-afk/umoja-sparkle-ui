import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, SkipBack, SkipForward, Download, Share2, Volume2, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";

type Chapter = { time: number; label: string };

const EPISODE = {
  id: "umoja-explained-001",
  title: "UMOJA Explained — Your Complete Guide",
  subtitle: "Learn how Circles, Drive, and Spark Trade work",
  // Replace with your podcast MP3 (Supabase Storage public URL or external)
  audioUrl: "https://lamohcoijkpigygiqyih.supabase.co/storage/v1/object/public/podcast-episodes/umoja-explained.mp3",
  coverGradient: "from-primary via-accent to-primary/50",
  description:
    "In this episode we break down how the UMOJA platform works — from saving Circles and the Drive vehicle program, to the Spark Trade intelligence engine. A great starting point for new members.",
  chapters: [
    { time: 0, label: "Introduction" },
    { time: 135, label: "What is UMOJA?" },
    { time: 330, label: "How Circles Work" },
    { time: 720, label: "Drive Program" },
    { time: 1125, label: "Spark Trade Intelligence" },
    { time: 1500, label: "Getting Started" },
  ] as Chapter[],
  takeaways: [
    "Circles are rotating savings groups powered by Sparks.",
    "Drive helps members access vehicles through pooled contributions.",
    "Spark Trade gives smart import & resale intelligence.",
  ],
  related: [
    { to: "/circle", label: "Circles" },
    { to: "/drive", label: "Drive" },
    { to: "/spark", label: "Spark Trade" },
  ],
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function Learn() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try {
        await a.play();
        setPlaying(true);
      } catch {
        toast({ title: "Couldn't play audio", description: "Tap play again or check the audio file URL." });
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
    const url = window.location.href;
    const data = { title: EPISODE.title, text: EPISODE.subtitle, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "Share it with anyone!" });
      }
    } catch {/* user cancelled */}
  };

  return (
    <div className="container max-w-3xl px-4 py-6 md:py-10 space-y-6">
      {/* Hero / Cover */}
      <Card className="overflow-hidden border-border">
        <div className={`relative aspect-[16/9] bg-gradient-to-br ${EPISODE.coverGradient} flex items-center justify-center`}>
          <Headphones className="h-20 w-20 text-primary-foreground/80" />
          <div className="absolute bottom-0 inset-x-0 p-4 md:p-6 bg-gradient-to-t from-background/90 to-transparent">
            <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">{EPISODE.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{EPISODE.subtitle}</p>
            <p className="text-xs text-muted-foreground mt-1">Duration: {fmt(duration)}</p>
          </div>
        </div>

        {/* Player */}
        <div className="p-4 md:p-6 space-y-4">
          <audio ref={audioRef} src={EPISODE.audioUrl} preload="metadata" playsInline />

          <div className="flex items-center justify-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => seek(current - 15)} aria-label="Back 15s">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              onClick={toggle}
              className="h-16 w-16 rounded-full"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => seek(current + 30)} aria-label="Forward 30s">
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-1">
            <Slider
              value={[current]}
              max={duration || 1}
              step={1}
              onValueChange={(v) => seek(v[0])}
              aria-label="Seek"
            />
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
              <Button variant="outline" size="sm" asChild>
                <a href={EPISODE.audioUrl} download aria-label="Download episode">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={share} aria-label="Share episode">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Show Notes */}
      <Card className="p-4 md:p-6 space-y-4">
        <h2 className="text-lg font-semibold">📝 Show Notes</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{EPISODE.description}</p>

        <div>
          <h3 className="text-sm font-semibold mb-2">Chapters</h3>
          <ul className="space-y-1">
            {EPISODE.chapters.map((c) => (
              <li key={c.time}>
                <button
                  onClick={() => { seek(c.time); audioRef.current?.play().then(() => setPlaying(true)).catch(()=>{}); }}
                  className="text-sm text-left w-full px-2 py-1.5 rounded-md hover:bg-accent/10 hover:text-accent transition-colors flex gap-3"
                >
                  <span className="tabular-nums text-muted-foreground w-12">{fmt(c.time)}</span>
                  <span>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Key takeaways</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            {EPISODE.takeaways.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">🔗 Related</h3>
          <div className="flex flex-wrap gap-2">
            {EPISODE.related.map((r) => (
              <Button key={r.to} variant="secondary" size="sm" asChild>
                <Link to={r.to}>{r.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
