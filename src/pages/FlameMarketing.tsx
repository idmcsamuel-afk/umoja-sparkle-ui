import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Copy, RefreshCw, Sparkles, Loader2, Crown, Download, ImageIcon, Type, Video } from "lucide-react";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TikTokSymphonyCard } from "@/components/umoja/flame/TikTokSymphonyCard";
import { AvatarVideoCard } from "@/components/umoja/flame/AvatarVideoCard";
import { SlideshowCreator } from "@/components/umoja/flame/SlideshowCreator";
import { useFlameTier } from "@/hooks/useFlameTier";

// ───────────────────────── TEXT GENERATOR ─────────────────────────

type ContentType =
  | "ig_caption"
  | "fb_post"
  | "wa_status"
  | "x_post"
  | "tiktok_caption"
  | "flyer"
  | "plan";

type Tone = "Professional" | "Casual" | "Bold" | "Inspirational" | "Funny";

type TypeMeta = {
  id: ContentType;
  emoji: string;
  title: string;
  sub: string;
  target: number;
  max: number;
  social: boolean;
  guide: string;
};

const TYPES: TypeMeta[] = [
  { id: "ig_caption", emoji: "📸", title: "Instagram caption", sub: "Hook + hashtags", target: 220, max: 2200, social: true,
    guide: "Hook in line 1 (≤80 chars). 2-3 short lines with emojis. End with CTA + 8-12 niche SA hashtags." },
  { id: "fb_post", emoji: "👥", title: "Facebook post", sub: "Story-style", target: 400, max: 1500, social: true,
    guide: "Friendly, story-style opener. 2-3 short paragraphs. Clear CTA. 3-5 hashtags max." },
  { id: "wa_status", emoji: "💬", title: "WhatsApp status", sub: "Short broadcast", target: 180, max: 700, social: true,
    guide: "Punchy WhatsApp status / broadcast. *Bold* sparingly, 1-2 emojis, bullet points OK. End with contact CTA. NO hashtags." },
  { id: "x_post", emoji: "𝕏", title: "Twitter / X post", sub: "≤280 chars", target: 240, max: 280, social: true,
    guide: "Single tweet ≤280 chars. Sharp hook, one idea, optional 1-2 hashtags. No fluff." },
  { id: "tiktok_caption", emoji: "🎵", title: "TikTok caption", sub: "Trend-ready", target: 150, max: 300, social: true,
    guide: "Punchy caption ≤150 chars. Front-load the hook. End with 4-6 trending SA hashtags (#fyp #southafricatiktok + niche)." },
  { id: "flyer", emoji: "🎨", title: "Marketing flyer text", sub: "Headline + body", target: 300, max: 800, social: false,
    guide: "Format: HEADLINE on line 1 (≤8 words, ALL CAPS). 2-3 lines body copy. Strong CTA line. No hashtags." },
  { id: "plan", emoji: "📈", title: "Full marketing plan", sub: "30-day roadmap", target: 1200, max: 2500, social: false,
    guide: "Structured 30-day plan: Audience, Offer, Channels, Weekly content cadence, 5 example posts, Budget tips. Use clear headings and bullets." },
];

const TONES: Tone[] = ["Professional", "Casual", "Bold", "Inspirational", "Funny"];

const BIZ_MIN = 20;
const BIZ_MAX = 600;

// ───────────────────────── GRAPHICS GENERATOR ─────────────────────────

type TemplateId = "product_ad" | "social_post" | "ig_story" | "tiktok_thumb" | "fb_cover" | "umoja";

type TemplateMeta = {
  id: TemplateId;
  label: string;
  display: string;       // human dimensions shown in UI
  size: "1024x1024" | "1024x1792" | "1792x1024"; // DALL·E 3 size
  briefSuffix?: string;
};

const TEMPLATES: TemplateMeta[] = [
  { id: "product_ad",   label: "Product Ad",         display: "1080×1080 (Instagram post)", size: "1024x1024", briefSuffix: "high-end product advertisement composition, studio lighting, square format" },
  { id: "social_post",  label: "Social Media Post",  display: "1080×1080 (general)",        size: "1024x1024", briefSuffix: "social media post composition, eye-catching, square format" },
  { id: "ig_story",     label: "Instagram Story",    display: "1080×1920 (vertical)",       size: "1024x1792", briefSuffix: "vertical 9:16 composition for Instagram Story, mobile-first" },
  { id: "tiktok_thumb", label: "TikTok Thumbnail",   display: "1080×1920 (vertical)",       size: "1024x1792", briefSuffix: "vertical 9:16 TikTok thumbnail, bold focal point, mobile-first" },
  { id: "fb_cover",     label: "Facebook Cover",     display: "1640×924 (landscape)",       size: "1792x1024", briefSuffix: "wide 16:9 Facebook cover banner composition, leave breathing room on sides" },
  { id: "umoja",        label: "UMOJA Marketing",    display: "1080×1080 — branded",        size: "1024x1024", briefSuffix: "UMOJA South African community wealth brand: warm emerald + gold palette, ubuntu values, premium, trustworthy, vibrant Afro-modern" },
];

type GfxStyle = "Minimalist" | "Bold & Colorful" | "Professional" | "Lifestyle Photography" | "Illustration";
const STYLES: GfxStyle[] = ["Minimalist", "Bold & Colorful", "Professional", "Lifestyle Photography", "Illustration"];

const STYLE_HINTS: Record<GfxStyle, { hint: string; dalle: "natural" | "vivid" }> = {
  "Minimalist":              { hint: "minimalist design, generous whitespace, restrained palette, clean typography",   dalle: "natural" },
  "Bold & Colorful":         { hint: "bold colors, high contrast, eye-catching, energetic composition",                dalle: "vivid" },
  "Professional":            { hint: "polished corporate-grade visual, refined palette, premium feel",                  dalle: "natural" },
  "Lifestyle Photography":   { hint: "photorealistic lifestyle photography, natural lighting, shallow depth of field",  dalle: "natural" },
  "Illustration":            { hint: "modern illustration, flat shapes with subtle gradients, stylized",                dalle: "vivid" },
};

const GFX_PROMPT_MAX = 500;
const GFX_OVERLAY_MAX = 50;
const GFX_WEEKLY_LIMIT = 3;

export default function FlameMarketing() {
  const { tier } = useFlameTier();
  const isPro = tier === "pro";

  // text state
  const [biz, setBiz] = useState("");
  const [typeId, setTypeId] = useState<ContentType>("ig_caption");
  const [tone, setTone] = useState<Tone>("Casual");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const type = TYPES.find((t) => t.id === typeId)!;
  const bizLen = biz.trim().length;
  const outLen = output.length;
  const overLimit = outLen > type.max;

  // graphics state
  const [gfxTemplate, setGfxTemplate] = useState<TemplateId>("social_post");
  const [gfxDesc, setGfxDesc] = useState("");
  const [gfxStyle, setGfxStyle] = useState<GfxStyle>("Lifestyle Photography");
  const [gfxOverlay, setGfxOverlay] = useState("");
  const [gfxLoading, setGfxLoading] = useState(false);
  const [gfxImage, setGfxImage] = useState<string | null>(null);
  const [gfxRevised, setGfxRevised] = useState<string | null>(null);
  const [gfxUsed, setGfxUsed] = useState<number>(0);
  const [videoUsed, setVideoUsed] = useState<number>(0);

  const template = TEMPLATES.find((t) => t.id === gfxTemplate)!;
  const gfxRemaining = Math.max(0, GFX_WEEKLY_LIMIT - gfxUsed);
  const gfxAtLimit = !isPro && gfxUsed >= GFX_WEEKLY_LIMIT;
  const VIDEO_WEEKLY_LIMIT = 2;
  const videoRemaining = Math.max(0, VIDEO_WEEKLY_LIMIT - videoUsed);

  // Fetch this week's usage on mount (skip for Pro — unlimited)
  useEffect(() => {
    if (isPro) return;
    let active = true;
    (async () => {
      const [{ data: g }, { data: v }] = await Promise.all([
        supabase.rpc("flame_graphics_count_week"),
        supabase.rpc("flame_video_count_week"),
      ]);
      if (!active) return;
      if (typeof g === "number") setGfxUsed(g);
      if (typeof v === "number") setVideoUsed(v);
    })();
    return () => { active = false; };
  }, [isPro]);

  const generate = async () => {
    const trimmed = biz.trim();
    if (trimmed.length < BIZ_MIN) {
      toast({ title: "Add a bit more detail", description: `At least ${BIZ_MIN} characters — what you sell, where, price.`, variant: "destructive" });
      return;
    }
    if (trimmed.length > BIZ_MAX) {
      toast({ title: "Description too long", description: `Keep it under ${BIZ_MAX} characters.`, variant: "destructive" });
      return;
    }
    setLoading(true);
    setOutput("");
    const user = [
      `Tone: ${tone}.`,
      `Format: ${type.title} (${type.guide}).`,
      `Strict: at most ${type.max} characters, ideally close to ${type.target}. Output only the copy — no preamble, quotes, or labels.`,
      ``,
      `Business: ${trimmed}`,
      ``,
      `Write the ${type.title.toLowerCase()} now.`,
    ].join("\n");

    try {
      const { data, error } = await supabase.functions.invoke("flame-ai", {
        body: { prompt: "marketing", temperature: 0.85, messages: [{ role: "user", content: user }] },
      });
      if (error) throw error;
      let reply: string = (data as any)?.reply ?? "";
      if (reply.length > type.max) reply = reply.slice(0, type.max).replace(/\s\S*$/, "") + "…";
      setOutput(reply || "Flame went quiet — try again.");
    } catch (e: any) {
      toast({ title: "Flame couldn't generate", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast({ title: "Copied 🔥", description: "Marketing copy on your clipboard." });
  };

  // ───────── graphics actions ─────────

  const buildGfxPrompt = (): string => {
    const t = TEMPLATES.find((x) => x.id === gfxTemplate)!;
    const styleHint = STYLE_HINTS[gfxStyle].hint;
    const overlay = gfxOverlay.trim();
    const parts = [
      gfxDesc.trim(),
      t.briefSuffix,
      `Style: ${styleHint}.`,
      overlay
        ? `Include large, legible, well-kerned text overlay reading exactly: "${overlay}". Place it where it doesn't compete with the focal point. Use clean modern typography.`
        : `No text in the image.`,
      `Output: ${t.display}.`,
    ].filter(Boolean);
    return parts.join(" ");
  };

  const generateGraphic = async () => {
    const desc = gfxDesc.trim();
    if (desc.length < 5) {
      toast({ title: "Describe the image", description: "At least a short sentence.", variant: "destructive" });
      return;
    }
    if (desc.length > GFX_PROMPT_MAX) {
      toast({ title: "Description too long", description: `Keep it under ${GFX_PROMPT_MAX} characters.`, variant: "destructive" });
      return;
    }
    if (gfxAtLimit) {
      toast({ title: "Weekly limit reached", description: `${GFX_WEEKLY_LIMIT}/${GFX_WEEKLY_LIMIT} used. Resets Monday. Upgrade to Buyers Club Pro for unlimited.`, variant: "destructive" });
      return;
    }
    setGfxLoading(true);
    setGfxImage(null);
    setGfxRevised(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-graphics", {
        body: {
          prompt: buildGfxPrompt(),
          size: template.size,
          style: STYLE_HINTS[gfxStyle].dalle,
          template: template.id,
          style_label: gfxStyle,
        },
      });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error === "weekly_limit_reached" || payload?.error === "daily_limit_reached") {
        setGfxUsed(GFX_WEEKLY_LIMIT);
        toast({ title: "Weekly limit reached", description: payload?.message ?? `${GFX_WEEKLY_LIMIT}/${GFX_WEEKLY_LIMIT} used this week.`, variant: "destructive" });
        return;
      }
      if (payload?.error) throw new Error(payload.error);
      setGfxImage(payload.image_url);
      setGfxRevised(payload.revised_prompt ?? null);
      if (typeof payload.used === "number") setGfxUsed(payload.used);
      const desc = payload.unlimited
        ? "Unlimited generations — Buyers Club Pro ✨"
        : `${payload.remaining ?? gfxRemaining - 1} generations left this week.`;
      toast({ title: "Graphic ready 🎨", description: desc });
    } catch (e: any) {
      toast({ title: "Generation failed", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setGfxLoading(false);
    }
  };

  const downloadImage = async () => {
    if (!gfxImage) return;
    try {
      const res = await fetch(gfxImage);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flame-${template.id}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(gfxImage, "_blank", "noopener,noreferrer");
    }
  };

  const copyPrompt = async () => {
    const p = gfxRevised ?? buildGfxPrompt();
    await navigator.clipboard.writeText(p);
    toast({ title: "Prompt copied", description: "Paste to remix in a new generation." });
  };

  return (
    <div className="min-h-screen pb-32 bg-[radial-gradient(ellipse_at_top,hsl(150_60%_14%/0.7),hsl(150_18%_6%)_60%)]">
      <header className="px-5 pt-8 pb-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-600 to-amber-500 shadow-[0_20px_60px_-20px_hsl(45_90%_50%/0.6)]">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
              Flame Marketing Studio
            </h1>
            <p className="text-sm text-muted-foreground">AI content for your hustle — free for all members</p>
          </div>
        </div>
      </header>

      <main className="px-5 space-y-5 max-w-2xl mx-auto">
        {/* Tier status banner */}
        {isPro ? (
          <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-emerald-950 via-emerald-900 to-amber-950 p-4 shadow-[0_20px_60px_-20px_hsl(45_90%_50%/0.5)]">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="relative flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-emerald-950">
                <Crown className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-base text-amber-200">✨ Flame Pro — UNLIMITED</h3>
                <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
                  <li>✅ Unlimited graphics & videos</li>
                  <li>✅ No watermarks</li>
                  <li>✅ Brand kit & batch generation</li>
                </ul>
                <p className="mt-2 text-[11px] text-amber-300/80">Included with Buyers Club Pro</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-card to-emerald-950/40 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300 text-lg">
                🎯
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-base text-amber-200">Flame Studio (Limited)</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Your limits this week (resets Monday)</p>
                <ul className="mt-2 space-y-1 text-xs text-foreground/90">
                  <li>• Graphics: <span className="font-semibold tabular-nums">{gfxRemaining}/{GFX_WEEKLY_LIMIT}</span> remaining</li>
                  <li>• Slideshows: <span className="font-semibold tabular-nums">{videoRemaining}/{VIDEO_WEEKLY_LIMIT}</span> remaining</li>
                </ul>
                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 space-y-2">
                  <p className="text-xs text-amber-100">Want unlimited? Upgrade to <b>Buyers Club Pro</b> for R999/month.</p>
                  <Button asChild size="sm" className="w-full bg-amber-500 text-black hover:bg-amber-400">
                    <Link to="/spark">View Buyers Club Tiers →</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-card/60 border border-amber-500/20">
            <TabsTrigger value="text" className="data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-200">
              <Type className="h-4 w-4" /> Text
            </TabsTrigger>
            <TabsTrigger value="graphics" className="data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-200">
              <ImageIcon className="h-4 w-4" /> Graphics 🎨
            </TabsTrigger>
            <TabsTrigger value="video" className="data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-200">
              <Video className="h-4 w-4" /> Video 🎬
            </TabsTrigger>
          </TabsList>

          {/* ───────── TEXT TAB ───────── */}
          <TabsContent value="text" className="space-y-5 mt-4">
            <Card className="p-4 space-y-5 border-amber-500/20 bg-card/80 backdrop-blur">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">Describe your business</label>
                  <span className={`text-[10px] tabular-nums ${
                    bizLen > BIZ_MAX ? "text-destructive" : bizLen < BIZ_MIN ? "text-muted-foreground" : "text-emerald-400"
                  }`}>{bizLen}/{BIZ_MAX}</span>
                </div>
                <Textarea
                  value={biz}
                  onChange={(e) => setBiz(e.target.value.slice(0, BIZ_MAX + 50))}
                  rows={4}
                  placeholder="e.g. I sell homemade vetkoek and koeksisters from home in Soweto. R10 each. Daily delivery in Soweto."
                  className="mt-1.5"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Content type</label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTypeId(t.id)}
                      className={`rounded-2xl border p-3 text-left transition-all ${
                        typeId === t.id
                          ? "border-amber-500 bg-amber-500/15 shadow-[0_0_30px_-10px_hsl(45_90%_50%/0.6)]"
                          : "border-border bg-card hover:border-amber-500/40"
                      }`}
                    >
                      <div className="text-2xl">{t.emoji}</div>
                      <div className="mt-1 text-sm font-semibold leading-tight">{t.title}</div>
                      <div className="text-[11px] text-muted-foreground">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Tone</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        tone === t ? "border-amber-500 bg-amber-500/15 text-amber-100" : "border-border text-muted-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={generate}
                disabled={loading || bizLen < BIZ_MIN || bizLen > BIZ_MAX}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-600 via-amber-500 to-yellow-500 text-black hover:opacity-95 border-0 disabled:opacity-50"
              >
                {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</> : <>Generate Content 🔥</>}
              </Button>
            </Card>

            {output && (
              <Card className="p-4 border-amber-500/30 bg-gradient-to-br from-card to-emerald-950/30 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">🔥 {type.title}</span>
                    {type.social && (
                      <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
                        overLimit ? "bg-destructive/20 text-destructive" : "bg-emerald-500/15 text-emerald-300"
                      }`}>{outLen}/{type.max}</span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Regenerate
                  </Button>
                </div>

                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/95 rounded-xl bg-black/30 border border-amber-500/15 p-3">{output}</pre>

                <Button
                  onClick={copy}
                  className={`w-full mt-3 border-0 font-semibold transition-all ${
                    copied
                      ? "bg-emerald-500 text-black"
                      : "bg-gradient-to-r from-emerald-600 to-amber-500 text-black"
                  }`}
                >
                  <Copy className="h-4 w-4" /> {copied ? "Copied!" : "Copy to clipboard"}
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* ───────── GRAPHICS TAB ───────── */}
          <TabsContent value="graphics" className="space-y-5 mt-4">
            <Card className="p-4 space-y-5 border-amber-500/20 bg-card/80 backdrop-blur">
              <div className="flex items-center justify-between rounded-xl bg-black/30 border border-amber-500/15 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {isPro ? "Buyers Club Pro" : "Graphics this week"}
                </span>
                {isPro ? (
                  <span className="text-xs font-semibold text-amber-200">Unlimited ✨</span>
                ) : (
                  <span className={`text-xs font-semibold tabular-nums ${gfxAtLimit ? "text-destructive" : "text-amber-200"}`}>
                    {gfxUsed}/{GFX_WEEKLY_LIMIT} <span className="text-muted-foreground font-normal">(resets Monday)</span>
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Template</label>
                <Select value={gfxTemplate} onValueChange={(v) => setGfxTemplate(v as TemplateId)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label} — <span className="text-muted-foreground">{t.display}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">Visual description</label>
                  <span className={`text-[10px] tabular-nums ${gfxDesc.length > GFX_PROMPT_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                    {gfxDesc.length}/{GFX_PROMPT_MAX}
                  </span>
                </div>
                <Textarea
                  value={gfxDesc}
                  onChange={(e) => setGfxDesc(e.target.value.slice(0, GFX_PROMPT_MAX + 50))}
                  rows={4}
                  placeholder="Describe the image you want to create...
e.g. Modern apartment living room with LED cloud lamp glowing purple on coffee table"
                  className="mt-1.5"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Style</label>
                <Select value={gfxStyle} onValueChange={(v) => setGfxStyle(v as GfxStyle)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">Text overlay <span className="text-muted-foreground/60">(optional)</span></label>
                  <span className={`text-[10px] tabular-nums ${gfxOverlay.length > GFX_OVERLAY_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                    {gfxOverlay.length}/{GFX_OVERLAY_MAX}
                  </span>
                </div>
                <Input
                  value={gfxOverlay}
                  onChange={(e) => setGfxOverlay(e.target.value.slice(0, GFX_OVERLAY_MAX))}
                  placeholder="Add headline or CTA text to image"
                  className="mt-1.5"
                />
                <p className="text-[10px] text-muted-foreground mt-1">DALL·E may approximate text — preview before publishing.</p>
              </div>

              <Button
                onClick={generateGraphic}
                disabled={gfxLoading || gfxDesc.trim().length < 5 || gfxAtLimit}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-600 via-amber-500 to-yellow-500 text-black hover:opacity-95 border-0 disabled:opacity-50"
              >
                {gfxLoading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Generating your graphic…</>
                ) : gfxAtLimit ? (
                  <>Weekly limit reached ({GFX_WEEKLY_LIMIT}/{GFX_WEEKLY_LIMIT})</>
                ) : (
                  <>Generate Graphics 🎨</>
                )}
              </Button>

              {gfxAtLimit && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-2">
                  <p className="font-semibold">Weekly limit reached ({GFX_WEEKLY_LIMIT}/{GFX_WEEKLY_LIMIT})</p>
                  <p>Upgrade to Buyers Club Pro for unlimited graphics.</p>
                  <Button asChild size="sm" className="w-full bg-amber-500 text-black hover:bg-amber-400">
                    <a href="/spark-trade">Upgrade to Pro · R999/month →</a>
                  </Button>
                </div>
              )}
            </Card>

            {gfxImage && (
              <Card className="p-4 border-amber-500/30 bg-gradient-to-br from-card to-emerald-950/30 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">🎨 {template.label}</span>
                  <span className="text-[10px] text-muted-foreground">{template.display}</span>
                </div>

                <div className="rounded-xl overflow-hidden bg-black/40 border border-amber-500/15">
                  <img src={gfxImage} alt="Generated graphic" className="w-full h-auto block" />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button onClick={downloadImage} className="bg-gradient-to-r from-emerald-600 to-amber-500 text-black border-0 font-semibold">
                    <Download className="h-4 w-4" /> Download PNG
                  </Button>
                  <Button onClick={generateGraphic} disabled={gfxLoading || gfxAtLimit} variant="outline">
                    <RefreshCw className={`h-4 w-4 ${gfxLoading ? "animate-spin" : ""}`} /> Regenerate
                  </Button>
                  <Button onClick={copyPrompt} variant="outline" className="col-span-2">
                    <Copy className="h-4 w-4" /> Copy prompt (remix)
                  </Button>
                </div>

                {gfxRevised && (
                  <details className="mt-3 text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer hover:text-amber-200">DALL·E revised prompt</summary>
                    <p className="mt-1.5 rounded-lg bg-black/30 border border-border/40 p-2 leading-relaxed">{gfxRevised}</p>
                  </details>
                )}
              </Card>
            )}
          </TabsContent>

          {/* ───────── VIDEO TAB ───────── */}
          <TabsContent value="video" className="space-y-5 mt-4">
            <div className={`rounded-2xl border p-3 text-xs ${isPro ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-amber-400/40 bg-amber-500/10 text-amber-100"}`}>
              {isPro ? (
                <><b>Flame Pro active ✨</b> — Unlimited slideshows, no watermark, avatar add-ons unlocked.</>
              ) : (
                <><b>Free tier</b> — TikTok Symphony (unlimited) + 2 slideshows / week. <Link to="/spark-trade" className="underline font-semibold">Upgrade →</Link></>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TikTokSymphonyCard />
              <AvatarVideoCard tier={tier} />
            </div>
            <SlideshowCreator tier={tier} />
          </TabsContent>
        </Tabs>

      </main>

      <BottomNav />
    </div>
  );
}
