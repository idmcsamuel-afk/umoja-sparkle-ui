import { useState } from "react";
import { Flame, Copy, RefreshCw, Sparkles, Loader2, Instagram, Facebook, MessageCircle, Music2 } from "lucide-react";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ContentType = "social" | "flyer" | "whatsapp" | "video";
type Tone = "Professional" | "Friendly" | "Hype";
type Platform = "Instagram" | "Facebook" | "WhatsApp" | "TikTok";

const TYPES: { id: ContentType; emoji: string; title: string; sub: string }[] = [
  { id: "social", emoji: "📱", title: "Social Post", sub: "IG / FB caption" },
  { id: "flyer", emoji: "🎨", title: "Flyer Text", sub: "Headline + body" },
  { id: "whatsapp", emoji: "📣", title: "WhatsApp Blast", sub: "Community msg" },
  { id: "video", emoji: "🎥", title: "Video Script", sub: "Short script" },
];

const PLATFORMS: { id: Platform; icon: any }[] = [
  { id: "Instagram", icon: Instagram },
  { id: "Facebook", icon: Facebook },
  { id: "WhatsApp", icon: MessageCircle },
  { id: "TikTok", icon: Music2 },
];

export default function FlameMarketing() {
  const [biz, setBiz] = useState("");
  const [type, setType] = useState<ContentType>("social");
  const [tone, setTone] = useState<Tone>("Friendly");
  const [platform, setPlatform] = useState<Platform>("Instagram");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!biz.trim()) {
      toast({ title: "Tell Flame about your business first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const typeLabel = TYPES.find((t) => t.id === type)?.title ?? "Social Post";
      const system = `You are Flame, UMOJA's AI marketing assistant for South African micro-businesses. Write punchy, culturally relevant ${tone.toLowerCase()} marketing copy. Use SA English, Rand pricing, and local references where natural. Keep it ready-to-post. Add 5-8 relevant hashtags at the end for social posts.`;
      const user = `Business: ${biz}\n\nFormat: ${typeLabel}\nPlatform: ${platform}\nTone: ${tone}\n\nWrite the ${typeLabel.toLowerCase()} now.`;
      const { data, error } = await supabase.functions.invoke("flame-ai", {
        body: { system, temperature: 0.85, messages: [{ role: "user", content: user }] },
      });
      if (error) throw error;
      setOutput((data as any)?.reply ?? "Flame is thinking… try again.");
    } catch (e: any) {
      toast({ title: "Flame couldn't generate", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    toast({ title: "Copied 🔥", description: "Paste it anywhere." });
  };

  return (
    <div className="min-h-screen pb-32 bg-[radial-gradient(ellipse_at_top,hsl(20_90%_18%/0.55),hsl(150_18%_6%)_60%)]">
      <header className="px-5 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-[0_20px_60px_-20px_hsl(20_90%_50%/0.7)]">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 bg-clip-text text-transparent">
              🔥 UMOJA Flame
            </h1>
            <p className="text-sm text-muted-foreground">Your AI Marketing Assistant</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-100/90">
          Flame is <b>FREE</b> for all UMOJA members. Upgrade to <b>Signal</b> for video and UGC content.
        </div>
      </header>

      <main className="px-5 space-y-5">
        <Card className="p-4 space-y-4 border-orange-500/20">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Describe your business</label>
            <Textarea
              value={biz}
              onChange={(e) => setBiz(e.target.value)}
              rows={4}
              placeholder="e.g. I sell homemade vetkoek and koeksisters from home in Soweto. Available daily. Delivery in Soweto only."
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Content type</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`rounded-2xl border p-3 text-left transition-all ${
                    type === t.id
                      ? "border-orange-500 bg-orange-500/15 shadow-[0_0_30px_-10px_hsl(20_90%_50%/0.6)]"
                      : "border-border bg-card hover:border-orange-500/40"
                  }`}
                >
                  <div className="text-2xl">{t.emoji}</div>
                  <div className="mt-1 text-sm font-semibold">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground">{t.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Tone</label>
            <div className="mt-2 flex gap-2">
              {(["Professional", "Friendly", "Hype"] as Tone[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
                    tone === t ? "border-orange-500 bg-orange-500/15 text-orange-100" : "border-border text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Platform</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {PLATFORMS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPlatform(id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] transition ${
                    platform === id ? "border-orange-500 bg-orange-500/15 text-orange-100" : "border-border text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {id}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={generate}
            disabled={loading}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-black hover:opacity-95 border-0"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Generate with Flame 🔥</>}
          </Button>
        </Card>

        {output && (
          <Card className="p-4 border-orange-500/30 bg-gradient-to-br from-card to-orange-950/20 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-orange-300 uppercase tracking-wider">🔥 Flame says</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copy}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Regen
                </Button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/95">{output}</pre>

            <div className="mt-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-3 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-200">Upgrade to Signal</div>
                <div className="text-xs text-amber-100/70">Get AI-generated images, UGC reels, and video ads for your campaigns.</div>
              </div>
            </div>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
