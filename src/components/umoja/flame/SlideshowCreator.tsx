import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Upload, X, GripVertical, Download, RefreshCw, Film, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { FlameTier } from "@/hooks/useFlameTier";

type SizeId = "square" | "vertical" | "landscape";
const SIZES: { id: SizeId; label: string; w: number; h: number }[] = [
  { id: "square",    label: "Instagram (1:1 — 1080×1080)",    w: 1080, h: 1080 },
  { id: "vertical",  label: "TikTok / Reels (9:16 — 1080×1920)", w: 1080, h: 1920 },
  { id: "landscape", label: "YouTube (16:9 — 1920×1080)",     w: 1920, h: 1080 },
];

type MusicId = "upbeat" | "calm" | "inspirational" | "none";
const MUSIC: { id: MusicId; label: string; ready: boolean }[] = [
  { id: "upbeat",         label: "Upbeat & Energetic",   ready: false },
  { id: "calm",           label: "Calm & Professional",  ready: false },
  { id: "inspirational",  label: "Inspirational",        ready: false },
  { id: "none",           label: "No Music",             ready: true },
];

const MAX_IMAGES = 5;
const MIN_IMAGES = 3;
const WEEKLY_LIMIT = 2;
const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_CORE_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

type ImageSlide = {
  id: string;
  file: File;
  previewUrl: string;
  overlay: string;
};

export function SlideshowCreator({ tier = "free" }: { tier?: FlameTier }) {
  const isPro = tier === "pro";
  const { user } = useAuth();
  const [slides, setSlides] = useState<ImageSlide[]>([]);
  const [music, setMusic] = useState<MusicId>("none");
  const [duration, setDuration] = useState(3);
  const [size, setSize] = useState<SizeId>("vertical");
  const [watermark, setWatermark] = useState(true); // Pro can toggle off
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [used, setUsed] = useState(0);
  const dragIdx = useRef<number | null>(null);

  const showWatermark = isPro ? watermark : true; // forced on for free
  const dim = SIZES.find((s) => s.id === size)!;
  const remaining = Math.max(0, WEEKLY_LIMIT - used);
  const atLimit = !isPro && used >= WEEKLY_LIMIT;

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("flame_video_count_week");
      if (alive && typeof data === "number") setUsed(data);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => () => slides.forEach((s) => URL.revokeObjectURL(s.previewUrl)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => /^image\/(png|jpe?g)$/i.test(f.type));
    if (!incoming.length) {
      toast({ title: "Only JPG or PNG", variant: "destructive" });
      return;
    }
    const room = MAX_IMAGES - slides.length;
    const accepted = incoming.slice(0, room);
    if (incoming.length > room) toast({ title: `Capped at ${MAX_IMAGES} images` });
    setSlides((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        overlay: "",
      })),
    ]);
  };

  const removeSlide = (id: string) => {
    setSlides((prev) => {
      const s = prev.find((x) => x.id === id);
      if (s) URL.revokeObjectURL(s.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const updateOverlay = (id: string, text: string) =>
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, overlay: text.slice(0, 60) } : s)));

  const onDragStart = (idx: number) => () => { dragIdx.current = idx; };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (idx: number) => () => {
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current!, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragIdx.current = null;
  };

  /** Render each image to a canvas at target res with overlay text — returns PNG blobs. */
  const composeFrames = async (): Promise<Blob[]> => {
    const out: Blob[] = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      setStage(`Composing frame ${i + 1}/${slides.length}…`);
      const img = await loadImage(slide.previewUrl);
      const canvas = document.createElement("canvas");
      canvas.width = dim.w;
      canvas.height = dim.h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, dim.w, dim.h);

      // cover-fit
      const scale = Math.max(dim.w / img.width, dim.h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (dim.w - dw) / 2, (dim.h - dh) / 2, dw, dh);

      // text overlay
      if (slide.overlay.trim()) {
        drawOverlayText(ctx, slide.overlay.trim(), dim.w, dim.h);
      }

      // UMOJA watermark (forced for free, toggleable for pro)
      if (showWatermark) {
        drawWatermark(ctx, dim.w, dim.h);
      }

      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png", 0.95),
      );
      out.push(blob);
    }
    return out;
  };

  const generate = async () => {
    if (!user) { toast({ title: "Please sign in", variant: "destructive" }); return; }
    if (slides.length < MIN_IMAGES) {
      toast({ title: `Add at least ${MIN_IMAGES} images`, variant: "destructive" });
      return;
    }
    const musicMeta = MUSIC.find((m) => m.id === music)!;
    if (!musicMeta.ready) {
      toast({ title: "Music library coming soon", description: "Select \"No Music\" for now.", variant: "destructive" });
      return;
    }
    if (atLimit) {
      toast({ title: "Weekly limit reached", description: `${WEEKLY_LIMIT}/${WEEKLY_LIMIT} this week.`, variant: "destructive" });
      return;
    }

    setBusy(true);
    setResultUrl(null);
    try {
      const frames = await composeFrames();

      setStage("Loading video engine (first run ~25 MB)…");
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => console.log("[ffmpeg]", message));
      await ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });

      setStage("Writing frames…");
      for (let i = 0; i < frames.length; i++) {
        const idx = String(i + 1).padStart(4, "0");
        const buf = new Uint8Array(await frames[i].arrayBuffer());
        await ffmpeg.writeFile(`${idx}.png`, buf);
      }

      setStage("Encoding video…");
      const framerate = (1 / duration).toString();
      await ffmpeg.exec([
        "-framerate", framerate,
        "-i", "%04d.png",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-movflags", "+faststart",
        "out.mp4",
      ]);

      const data = await ffmpeg.readFile("out.mp4");
      const mp4Blob = new Blob([data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(data as string)], { type: "video/mp4" });

      setStage("Uploading…");
      const path = `${user.id}/${Date.now()}.mp4`;
      const { error: upErr } = await supabase.storage.from("flame-videos").upload(path, mp4Blob, {
        contentType: "video/mp4",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("flame-videos").getPublicUrl(path);
      const videoUrl = pub.publicUrl;

      await supabase.from("flame_video_usage").insert({
        member_id: user.id,
        kind: "slideshow",
        size,
        duration_seconds: duration * slides.length,
        image_count: slides.length,
        video_url: videoUrl,
      });

      setResultUrl(videoUrl);
      setUsed((u) => u + 1);
      toast({ title: "Video ready 🎬", description: `${remaining - 1} left this week.` });
    } catch (e: any) {
      console.error("[slideshow]", e);
      toast({ title: "Video generation failed", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const downloadVideo = async () => {
    if (!resultUrl) return;
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `flame-slideshow-${Date.now()}.mp4`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-card/80 backdrop-blur p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📸</span>
        <div>
          <h3 className="font-display text-base text-amber-200">Image Slideshow Video</h3>
          <p className="text-xs text-muted-foreground">Turn 3–5 images into a short video with text overlays.</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-black/30 border border-amber-500/15 px-3 py-2">
        <span className="text-xs text-muted-foreground">This week</span>
        {isPro ? (
          <span className="text-xs font-semibold text-amber-200 flex items-center gap-1">
            <Crown className="h-3 w-3" /> Unlimited
          </span>
        ) : (
          <span className={`text-xs font-semibold tabular-nums ${atLimit ? "text-destructive" : "text-amber-200"}`}>
            {used}/{WEEKLY_LIMIT}
          </span>
        )}
      </div>

      {/* Image dropzone */}
      <label
        className="block rounded-2xl border-2 border-dashed border-amber-500/30 p-5 text-center cursor-pointer hover:border-amber-500/60 transition"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
      >
        <input
          type="file" accept="image/png,image/jpeg" multiple className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <Upload className="h-6 w-6 mx-auto text-amber-400" />
        <p className="mt-2 text-sm">Drop images or tap to browse</p>
        <p className="text-[11px] text-muted-foreground">{slides.length}/{MAX_IMAGES} · JPG / PNG · min {MIN_IMAGES}</p>
      </label>

      {/* Slide list */}
      {slides.length > 0 && (
        <div className="space-y-2">
          {slides.map((s, idx) => (
            <div
              key={s.id}
              draggable
              onDragStart={onDragStart(idx)}
              onDragOver={onDragOver}
              onDrop={onDrop(idx)}
              className="flex items-center gap-2 rounded-xl bg-black/30 border border-border/40 p-2"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
              <img src={s.previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">Image {idx + 1} · text overlay (optional)</p>
                <Input
                  value={s.overlay}
                  onChange={(e) => updateOverlay(s.id, e.target.value)}
                  placeholder={`Add text for Image ${idx + 1}`}
                  className="h-8 text-sm mt-0.5"
                />
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeSlide(s.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Music */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground">Background music</label>
        <Select value={music} onValueChange={(v) => setMusic(v as MusicId)}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MUSIC.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label} {m.ready ? "" : "(coming soon)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Duration */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground">Duration per image</label>
          <span className="text-xs tabular-nums text-amber-200">{duration}s</span>
        </div>
        <Slider min={2} max={5} step={1} value={[duration]} onValueChange={(v) => setDuration(v[0])} className="mt-2" />
        <p className="text-[10px] text-muted-foreground mt-1">
          Total: ~{duration * Math.max(slides.length, 1)}s
        </p>
      </div>

      {/* Size */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground">Video size</label>
        <Select value={size} onValueChange={(v) => setSize(v as SizeId)}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SIZES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Watermark (Pro toggle / Free forced) */}
      <div className="flex items-center justify-between rounded-xl bg-black/20 border border-border/40 px-3 py-2">
        <div className="text-xs">
          <div className="font-semibold text-foreground/90">UMOJA watermark</div>
          <div className="text-[10px] text-muted-foreground">
            {isPro ? "Toggle off to export clean" : "Free tier — always on"}
          </div>
        </div>
        {isPro ? (
          <Switch checked={watermark} onCheckedChange={setWatermark} />
        ) : (
          <Lock className="h-4 w-4 text-amber-400/70" />
        )}
      </div>

      <Button
        onClick={generate}
        disabled={busy || slides.length < MIN_IMAGES || atLimit}
        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-600 via-amber-500 to-yellow-500 text-black hover:opacity-95 border-0 disabled:opacity-50"
      >
        {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> {stage || "Generating…"}</> : <>Generate Video 🎬</>}
      </Button>

      {atLimit && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-2">
          <p>Video limit: {used}/{WEEKLY_LIMIT} this week. Resets every Monday.</p>
          <Link to="/spark" className="inline-block">
            <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-amber-500 text-black border-0 font-semibold">
              Upgrade to Buyers Club Pro →
            </Button>
          </Link>
          <p className="text-[10px] text-amber-100/80">R999/month — includes Spark Trade + Flame Pro unlimited.</p>
        </div>
      )}

      {resultUrl && (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-card to-emerald-950/30 p-3 space-y-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-amber-300" />
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Your video</span>
          </div>
          <video src={resultUrl} controls playsInline className="w-full rounded-lg bg-black" />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={downloadVideo} className="bg-gradient-to-r from-emerald-600 to-amber-500 text-black border-0 font-semibold">
              <Download className="h-4 w-4" /> Download MP4
            </Button>
            <Button onClick={generate} disabled={busy || atLimit} variant="outline">
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Regenerate
            </Button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Heads up: video renders in your browser. First generation downloads ~25 MB. Keep this tab focused.
      </p>
    </div>
  );
}

// ───────── helpers ─────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawOverlayText(ctx: CanvasRenderingContext2D, text: string, w: number, h: number) {
  const padding = Math.round(w * 0.06);
  const fontSize = Math.round(Math.min(w, h) * 0.07);
  ctx.font = `700 ${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const lines = wrapText(ctx, text, w - padding * 2);
  const lineHeight = Math.round(fontSize * 1.2);
  const blockHeight = lineHeight * lines.length;
  const baseY = h - padding - blockHeight + lineHeight;

  // dark gradient scrim at bottom for legibility
  const scrimHeight = blockHeight + padding * 2;
  const g = ctx.createLinearGradient(0, h - scrimHeight, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h - scrimHeight, w, scrimHeight);

  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = Math.round(fontSize * 0.25);
  lines.forEach((line, i) => ctx.fillText(line, w / 2, baseY + i * lineHeight));
  ctx.shadowBlur = 0;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3); // cap at 3 lines
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const fontSize = Math.round(Math.min(w, h) * 0.028);
  const padding = Math.round(w * 0.025);
  ctx.save();
  ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = Math.round(fontSize * 0.4);
  // gold gradient
  const grad = ctx.createLinearGradient(0, h - fontSize - padding, 0, h - padding);
  grad.addColorStop(0, "#fde68a");
  grad.addColorStop(1, "#f59e0b");
  ctx.fillStyle = grad;
  ctx.fillText("UMOJA", w - padding, h - padding);
  ctx.restore();
}
