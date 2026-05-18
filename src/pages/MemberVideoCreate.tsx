import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, ChevronLeft, ChevronRight, Video } from "lucide-react";

const STEPS = ["Welcome", "Pick a script", "Pick an avatar", "Review", "Generate"];

export default function MemberVideoCreate() {
  const { member } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<any[]>([]);
  const [avatars, setAvatars] = useState<any[]>([]);
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [customScript, setCustomScript] = useState("");
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, a] = await Promise.all([
        supabase.from("ai_generated_scripts").select("id, script_text, hook, script_type, template_title").eq("member_template", true).order("created_at", { ascending: false }).limit(20),
        supabase.from("ai_avatars").select("id, name, persona_description, preview_image_url").eq("is_active", true).eq("member_selectable", true).order("performance_score", { ascending: false }),
      ]);
      setTemplates(t.data ?? []);
      setAvatars(a.data ?? []);
    })();
  }, []);

  const selectedScript = templates.find((s) => s.id === scriptId);
  const selectedAvatar = avatars.find((a) => a.id === avatarId);
  const finalScript = customScript.trim() || selectedScript?.script_text || "";

  const canNext = () => {
    if (step === 1) return !!(scriptId || customScript.trim().length > 30);
    if (step === 2) return !!avatarId;
    return true;
  };

  const generate = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("ai-create-member-video", {
      body: { script_id: scriptId, avatar_id: avatarId, custom_script: customScript.trim() || undefined },
    });
    setSubmitting(false);
    if (error || data?.error) return toast.error(error?.message || data?.error || "Failed");
    toast.success("Your video is generating — we'll notify you when ready.");
    nav("/my-videos");
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Create my video</p>
        <h1 className="font-display text-2xl mt-1">Earn referrals on autopilot</h1>
        <div className="mt-4">
          <Progress value={((step + 1) / STEPS.length) * 100} />
          <p className="text-xs text-muted-foreground mt-2">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
        </div>
      </header>

      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 0 && (
            <div className="space-y-3">
              <Video className="h-10 w-10 text-accent" />
              <h2 className="font-display text-xl">Create your personalized UMOJA video in 60 seconds</h2>
              <p className="text-sm text-muted-foreground">Pick a script, pick an avatar to be your spokesperson, and we'll generate a vertical video with your referral link baked in. Share it on WhatsApp, Instagram, or TikTok and earn 100 Sparks per signup.</p>
              <p className="text-sm">Your referral code: <span className="font-mono font-semibold">{member?.referral_code ?? "—"}</span></p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm">Pick a script template or write your own:</p>
              <div className="grid gap-2 max-h-72 overflow-auto">
                {templates.map((t) => (
                  <button key={t.id} onClick={() => { setScriptId(t.id); setCustomScript(""); }} className={`text-left p-3 rounded-lg border ${scriptId === t.id ? "border-primary bg-primary/5" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t.template_title ?? t.script_type ?? "Template"}</span>
                      {t.hook && <Badge variant="outline" className="text-[10px]">{t.hook.slice(0, 40)}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.script_text}</p>
                  </button>
                ))}
                {templates.length === 0 && <p className="text-xs text-muted-foreground">No templates available yet — write your own below.</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Or write your own:</p>
                <Textarea rows={4} value={customScript} onChange={(e) => { setCustomScript(e.target.value); if (e.target.value) setScriptId(null); }} placeholder="Hi, I'm earning 15% in 5 days with UMOJA…" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm">Pick your spokesperson:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {avatars.map((a) => (
                  <button key={a.id} onClick={() => setAvatarId(a.id)} className={`p-3 rounded-lg border text-left ${avatarId === a.id ? "border-primary bg-primary/5" : "border-border"}`}>
                    {a.preview_image_url ? <img src={a.preview_image_url} alt={a.name} className="w-full h-32 object-cover rounded-md" /> : <div className="w-full h-32 rounded-md bg-secondary grid place-items-center text-2xl">🎭</div>}
                    <p className="text-sm font-medium mt-2">{a.name}</p>
                    {a.persona_description && <p className="text-xs text-muted-foreground line-clamp-2">{a.persona_description}</p>}
                  </button>
                ))}
                {avatars.length === 0 && <p className="text-xs text-muted-foreground col-span-3">No avatars available yet. Ask the team to add some.</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 className="font-medium">Review</h3>
              <div className="text-sm space-y-2">
                <div><span className="text-muted-foreground">Avatar:</span> {selectedAvatar?.name}</div>
                <div><span className="text-muted-foreground">Script:</span><p className="mt-1 p-3 bg-secondary rounded-md whitespace-pre-wrap">{finalScript}</p></div>
                <div className="text-xs text-muted-foreground">Your referral link will be added to the caption automatically.</div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-center py-6">
              <Sparkles className="h-10 w-10 text-accent mx-auto" />
              <h3 className="font-display text-xl">Ready to generate?</h3>
              <p className="text-sm text-muted-foreground">Video generation takes 1-3 minutes. You'll see it in "My Videos" when it's ready.</p>
              <Button size="lg" onClick={generate} disabled={submitting}>{submitting ? "Submitting…" : "Generate my video"}</Button>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t mt-4">
            <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}><ChevronLeft className="h-4 w-4" /> Back</Button>
            {step < STEPS.length - 1 && (
              <Button size="sm" disabled={!canNext()} onClick={() => setStep(step + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
