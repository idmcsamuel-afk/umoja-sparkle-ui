import { useState } from "react";
import { Flame, Copy, RefreshCw, Sparkles, Loader2, Crown } from "lucide-react";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

export default function FlameMarketing() {
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

        {/* Flame Pro upgrade banner */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-gradient-to-br from-emerald-950 via-emerald-900 to-amber-950 p-5 shadow-[0_20px_60px_-20px_hsl(45_90%_50%/0.5)]">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-emerald-950 shadow-lg">
              <Crown className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-lg text-amber-200">🎬 Flame Pro</h3>
                <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-semibold text-amber-200 uppercase tracking-wider">Coming Soon</span>
              </div>
              <p className="mt-1 text-sm text-amber-100/80">
                Want AI video content + automated posting? Upgrade to <b>Flame Pro</b> for UGC reels, scheduled drops, and brand-kit visuals.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-300/90">
                <Sparkles className="h-3.5 w-3.5" /> Join waitlist when it drops
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
