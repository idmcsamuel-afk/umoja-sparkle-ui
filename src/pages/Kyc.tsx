import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Camera, FileText, CheckCircle2, Loader2, Upload, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Member = {
  phone: string | null;
  phone_verified: boolean | null;
  kyc_level: number | null;
  kyc_photo_url: string | null;
  kyc_document_url: string | null;
  kyc_rejection_reason: string | null;
};

const STEPS = [
  { n: 1, label: "Phone", icon: Phone },
  { n: 2, label: "Selfie", icon: Camera },
  { n: 3, label: "Address", icon: FileText },
];

export default function Kyc() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("members")
      .select("phone, phone_verified, kyc_level, kyc_photo_url, kyc_document_url, kyc_rejection_reason")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setMember(data as Member);
      const lvl = data.kyc_level ?? 0;
      setStep(lvl >= 3 ? 3 : lvl + 1);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const level = member?.kyc_level ?? 0;

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Verification</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Unlock <span className="text-gradient-gold italic font-[450]">payouts.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Three short steps. Your data stays private and only admins can see your documents.
          </p>

          {/* Stepper */}
          <ol className="mt-6 grid grid-cols-3 gap-2">
            {STEPS.map((s) => {
              const done = level >= s.n;
              const active = step === s.n;
              return (
                <li key={s.n}>
                  <button
                    onClick={() => setStep(s.n)}
                    className={`w-full rounded-2xl border p-3 text-left transition-smooth ${
                      done
                        ? "border-primary/50 bg-primary/10"
                        : active
                        ? "border-accent/60 bg-accent/5"
                        : "border-border bg-gradient-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <s.icon className="h-4 w-4 text-accent" />
                      {done && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">Step {s.n}</p>
                    <p className="font-display">{s.label}</p>
                  </button>
                </li>
              );
            })}
          </ol>

          {member?.kyc_rejection_reason && (
            <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Previous submission rejected</p>
              <p className="text-xs text-muted-foreground mt-1">{member.kyc_rejection_reason}</p>
            </div>
          )}

          {loading ? (
            <div className="mt-8 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : level >= 3 ? (
            <div className="mt-8 rounded-3xl border border-primary/40 bg-primary/10 p-6 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-display text-xl">You're fully verified</p>
              <p className="mt-1 text-xs text-muted-foreground">Payouts are unlocked.</p>
              <Button onClick={() => nav("/dashboard")} className="mt-4 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                Back to dashboard
              </Button>
            </div>
          ) : (
            <div className="mt-6">
              {step === 1 && <PhoneStep member={member} onDone={load} />}
              {step === 2 && <SelfieStep onDone={load} />}
              {step === 3 && <AddressStep onDone={load} />}
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}

/* -------- Step 1: Phone OTP (mock — replace with Twilio/Supabase auth) -------- */
function PhoneStep({ member, onDone }: { member: Member | null; onDone: () => void }) {
  const { user } = useAuth();
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = () => {
    if (!/^[+0-9 ]{8,}$/.test(phone.trim())) {
      toast.error("Enter a valid phone number");
      return;
    }
    // Mock OTP — generates a code shown on screen. Swap for Twilio/Supabase OTP later.
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setSent(otp);
    toast.success(`Demo code sent: ${otp}`, { duration: 8000 });
  };

  const verify = async () => {
    if (!user || !sent) return;
    if (code.trim() !== sent) {
      toast.error("Code doesn't match");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("members")
      .update({
        phone: phone.trim(),
        phone_verified: true,
        kyc_level: Math.max(1, member?.kyc_level ?? 0),
        kyc_submitted_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Phone verified");
    onDone();
  };

  return (
    <div className="rounded-3xl border border-border bg-gradient-card p-5 space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone number</Label>
        <Input
          inputMode="tel"
          placeholder="+27 82 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 h-12 rounded-2xl bg-secondary/60 border-border"
          disabled={!!sent}
        />
      </div>
      {!sent ? (
        <Button onClick={sendCode} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          Send SMS code
        </Button>
      ) : (
        <>
          <div>
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">6-digit code</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="mt-1 h-12 rounded-2xl bg-secondary/60 border-border tracking-widest text-center font-display text-xl"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setSent(null); setCode(""); }} className="rounded-2xl">
              Change number
            </Button>
            <Button onClick={verify} disabled={busy} className="flex-1 h-12 rounded-2xl bg-gradient-gold text-amber-950 hover:opacity-95">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
        </>
      )}
      <p className="text-[11px] text-muted-foreground">
        Demo mode: the code is shown in the toast. Wire Twilio or Supabase phone auth for production.
      </p>
    </div>
  );
}

/* -------- Step 2: Selfie + simple liveness (blink instruction) -------- */
function SelfieStep({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<"idle" | "ready" | "blink" | "captured">("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setPhase("ready");
      setTimeout(() => setPhase("blink"), 1500);
    } catch {
      toast.error("Couldn't access camera. Allow camera permission and try again.");
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  useEffect(() => () => stopCamera(), []); // eslint-disable-line

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 480;
    c.height = v.videoHeight || 640;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      if (!b) return;
      setBlob(b);
      setPreview(URL.createObjectURL(b));
      setPhase("captured");
      stopCamera();
    }, "image/jpeg", 0.85);
  };

  const upload = async () => {
    if (!user || !blob) return;
    setBusy(true);
    const path = `${user.id}/selfie-${Date.now()}.jpg`;
    const up = await supabase.storage.from("kyc-photos").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { error } = await supabase
      .from("members")
      .update({
        kyc_photo_url: path,
        kyc_level: 2,
        kyc_submitted_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Selfie uploaded");
    onDone();
  };

  return (
    <div className="rounded-3xl border border-border bg-gradient-card p-5 space-y-4">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black/40 grid place-items-center relative">
        {!stream && !preview && (
          <div className="text-center text-sm text-muted-foreground p-6">
            <Camera className="mx-auto h-8 w-8 text-accent" />
            <p className="mt-2">We'll take a quick selfie to confirm you're real.</p>
          </div>
        )}
        <video ref={videoRef} className={`h-full w-full object-cover ${stream ? "" : "hidden"}`} muted playsInline />
        {preview && <img src={preview} alt="Selfie" className="h-full w-full object-cover" />}
        {phase === "blink" && (
          <div className="absolute inset-x-0 bottom-3 mx-3 rounded-xl bg-background/80 backdrop-blur p-2 text-center text-xs">
            👁️ Please blink, then tap capture
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {!stream && !preview && (
        <Button onClick={startCamera} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          <Camera className="h-4 w-4 mr-2" /> Open camera
        </Button>
      )}
      {stream && (
        <Button onClick={capture} className="w-full h-12 rounded-2xl bg-gradient-gold text-amber-950">
          Capture
        </Button>
      )}
      {preview && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setPreview(null); setBlob(null); setPhase("idle"); }} className="rounded-2xl">
            Retake
          </Button>
          <Button onClick={upload} disabled={busy} className="flex-1 h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit selfie"}
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------- Step 3: Proof of address upload -------- */
function AddressStep({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Max 10MB");
    setFile(f);
  };

  const upload = async () => {
    if (!user || !file) return;
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${user.id}/address-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { error } = await supabase
      .from("members")
      .update({
        kyc_document_url: path,
        kyc_submitted_at: new Date().toISOString(),
        kyc_rejection_reason: null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Document submitted — admin will review shortly");
    onDone();
  };

  return (
    <div className="rounded-3xl border border-border bg-gradient-card p-5 space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload any document showing your address: utility bill, bank statement, lease, or letter from your chief.
      </p>
      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-border p-6 text-center hover:border-accent/60 transition-smooth">
        <Upload className="mx-auto h-8 w-8 text-accent" />
        <p className="mt-2 text-sm font-medium">{file ? file.name : "Tap to choose file"}</p>
        <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG, or PDF · max 10MB</p>
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />
      </label>
      <Button onClick={upload} disabled={!file || busy} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for review"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Once approved by an admin you reach Level 3 and payouts unlock.
      </p>
    </div>
  );
}
