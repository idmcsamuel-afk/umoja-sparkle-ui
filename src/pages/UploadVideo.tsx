import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Upload, ArrowLeft, ArrowRight, CheckCircle2, Video } from "lucide-react";
import { BottomNav } from "@/components/umoja/BottomNav";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = ["video/mp4", "video/quicktime", "video/mov", "video/webm"];

const PLATFORMS = [
  { value: "instagram_post", label: "Instagram Post/Reel" },
  { value: "instagram_story", label: "Instagram Story" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "whatsapp_status", label: "WhatsApp Status" },
];

const detailsSchema = z.object({
  platform: z.string().min(1, "Pick a platform"),
  social_media_link: z.string().trim().url("Enter a valid URL").max(500),
  caption_used: z.string().trim().max(2000).optional(),
});

export default function UploadVideo() {
  const { user, member } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [platform, setPlatform] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const suggested = `I'm earning real returns with UMOJA — check it out 👇\nhttps://umojarise.com/join?ref=${member?.referral_code ?? ""}`;
  const [caption, setCaption] = useState(suggested);
  const [submitting, setSubmitting] = useState(false);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return toast.error("Use MP4, MOV, or WebM");
    if (f.size > MAX_BYTES) return toast.error("Max 100MB");
    setFile(f);
  };

  const upload = async () => {
    if (!file || !user) return;
    setUploading(true);
    setUploadPct(10);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("member-ugc-videos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) { setUploading(false); return toast.error(error.message); }
    setUploadPct(100);
    const { data } = supabase.storage.from("member-ugc-videos").getPublicUrl(path);
    setVideoUrl(data.publicUrl);
    setVideoPath(path);
    setUploading(false);
    setStep(2);
  };

  const submit = async () => {
    if (!user || !videoUrl) return;
    const parsed = detailsSchema.safeParse({ platform, social_media_link: socialLink, caption_used: caption });
    if (!parsed.success) return toast.error(Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Invalid");
    setSubmitting(true);
    const { error } = await supabase.from("member_ugc_submissions").insert({
      member_id: user.id,
      video_url: videoUrl,
      video_path: videoPath,
      platform: parsed.data.platform,
      social_media_link: parsed.data.social_media_link,
      caption_used: parsed.data.caption_used,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setStep(3);
  };

  const reset = () => {
    setStep(0); setFile(null); setVideoUrl(null); setVideoPath(null);
    setPlatform(""); setSocialLink(""); setCaption(suggested); setUploadPct(0);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Upload & earn</p>
        <h1 className="font-display text-2xl md:text-3xl mt-1">🎥 Upload your video & earn 200 Sparks</h1>
      </header>

      {step > 0 && step < 3 && (
        <Progress value={(step / 3) * 100} />
      )}

      {step === 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="rounded-lg bg-accent/10 p-4 space-y-1">
              <p className="font-medium text-sm">💰 Earn 200 Sparks when you:</p>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>Film yourself talking about UMOJA</li>
                <li>Share it on Instagram, TikTok, or Facebook</li>
                <li>Submit the link here for review</li>
              </ol>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">✅ What makes a good video</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  <li>30–60 seconds long</li>
                  <li>Show your genuine experience</li>
                  <li>Mention your earnings — be specific</li>
                  <li>Include your referral link in caption</li>
                  <li>Good lighting & clear audio</li>
                  <li>Be yourself — authentic wins</li>
                </ul>
              </div>
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">❌ Don't</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  <li>Make false earnings claims</li>
                  <li>Use copyrighted music</li>
                  <li>Show sensitive personal info</li>
                </ul>
              </div>
            </div>

            <Button size="lg" className="w-full h-12" onClick={() => setStep(1)}>
              Start upload <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-display text-xl">📤 Upload your video</h2>

            <label
              htmlFor="file"
              className="block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-accent/5 transition"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0] ?? null); }}
            >
              <Upload className="h-10 w-10 text-accent mx-auto mb-2" />
              <p className="text-sm font-medium">{file ? file.name : "Drag & drop or browse"}</p>
              <p className="text-xs text-muted-foreground mt-1">MP4 / MOV / WebM · up to 100MB · 30–90 sec</p>
              <Input id="file" type="file" className="hidden" accept="video/mp4,video/quicktime,video/mov,video/webm"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </label>

            {uploading && (
              <div className="space-y-1">
                <Progress value={uploadPct} />
                <p className="text-xs text-muted-foreground">Uploading… {uploadPct}%</p>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button disabled={!file || uploading} onClick={upload} className="h-11">
                {uploading ? "Uploading…" : <>Next: Add details <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-display text-xl">📱 Share details</h2>

            {videoUrl && <video src={videoUrl} controls className="w-full rounded-md max-h-72" />}

            <div className="space-y-2">
              <Label>Where did you share this video?</Label>
              <RadioGroup value={platform} onValueChange={setPlatform} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <label key={p.value} className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer ${platform === p.value ? "border-primary bg-primary/5" : ""}`}>
                    <RadioGroupItem value={p.value} />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="link">Link to your post <span className="text-destructive">*</span></Label>
              <Input id="link" placeholder="https://instagram.com/p/..." value={socialLink} onChange={(e) => setSocialLink(e.target.value)} maxLength={500} />
              <p className="text-xs text-muted-foreground">ℹ️ We'll verify the link and approve within 24 hours.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cap">Caption you used (optional)</Label>
              <Textarea id="cap" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2000} />
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button disabled={submitting || !platform || !socialLink} onClick={submit} className="h-11">
                {submitting ? "Submitting…" : <>Submit for review <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardContent className="p-8 space-y-4 text-center">
            <CheckCircle2 className="h-14 w-14 text-accent mx-auto" />
            <h2 className="font-display text-2xl">✅ Video submitted!</h2>
            <p className="text-sm text-muted-foreground">Your video is under review.</p>
            <ul className="text-sm space-y-2 text-left max-w-sm mx-auto">
              <li>⏰ Review time: usually within 24 hours</li>
              <li>💰 If approved: <span className="font-semibold text-accent">+200 Sparks</span></li>
              <li>🔔 We'll notify you by email & in-app</li>
              <li>📊 Track status in <em>My Videos → Submissions</em></li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button variant="outline" className="h-11" onClick={reset}>Submit another video</Button>
              <Button className="h-11" onClick={() => nav("/browse-videos")}><Video className="h-4 w-4" /> Browse video library</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-center text-muted-foreground">
        <Link to="/my-videos" className="underline">View my submissions →</Link>
      </p>
    </div>
  );
}
