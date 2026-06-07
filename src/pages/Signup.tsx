import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { ArrowRight, Loader2, Sparkles, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/umoja/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSocialProof, fmtR } from "@/hooks/useSocialProof";
import { ttTrack } from "@/lib/tiktokPixel";
import { fbqTrack } from "@/lib/metaPixel";
import { WhatsAppCommunity } from "@/components/umoja/WhatsAppCommunity";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a valid phone").max(20),
  password: z.string().min(6, "At least 6 characters").max(100),
});

// Global country list — UMOJA accepts members worldwide who pay in USDT.
// Local payment rails (e.g. Paystack/EFT) still depend on country_configs in the DB,
// but every country can join and contribute via USDT.
const GLOBAL_COUNTRIES: Array<{ code: string; name: string; flag: string }> = [
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "ZM", name: "Zambia", flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿" },
  { code: "BW", name: "Botswana", flag: "🇧🇼" },
  { code: "NA", name: "Namibia", flag: "🇳🇦" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "MA", name: "Morocco", flag: "🇲🇦" },
  { code: "SN", name: "Senegal", flag: "🇸🇳" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "CM", name: "Cameroon", flag: "🇨🇲" },
  { code: "AO", name: "Angola", flag: "🇦🇴" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "TR", name: "Türkiye", flag: "🇹🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "OTHER", name: "Other (Worldwide)", flag: "🌍" },
];

const Signup = () => {
  const nav = useNavigate();
  const proof = useSocialProof();
  const [params] = useSearchParams();
  const urlRef = (params.get("ref") ?? "").trim().toUpperCase().slice(0, 8);
  // Persist referral code so it survives navigation (email confirmation, etc.)
  const refParam = urlRef || (typeof window !== "undefined" ? (localStorage.getItem("umoja_referral_code") ?? "").toUpperCase() : "");
  useEffect(() => {
    if (urlRef) localStorage.setItem("umoja_referral_code", urlRef);
  }, [urlRef]);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [refStatus, setRefStatus] = useState<"none" | "checking" | "valid" | "invalid">(refParam ? "checking" : "none");
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [country, setCountry] = useState<string>("ZA");
  const [busy, setBusy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [duplicate, setDuplicate] = useState<null | { kind: "email" | "phone" | "account"; value: string }>(null);

  const selectedCountry = GLOBAL_COUNTRIES.find((c) => c.code === country);

  // Map raw auth/db errors to a friendly duplicate kind, or null if not a duplicate.
  const detectDuplicate = (raw: unknown): null | "email" | "phone" | "account" => {
    const e = raw as { code?: string; status?: number; message?: string } | null;
    const msg = (e?.message ?? "").toLowerCase();
    const code = e?.code ?? "";
    if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
      if (msg.includes("phone")) return "phone";
      if (msg.includes("email")) return "email";
      return "account";
    }
    if (
      msg.includes("already registered") ||
      msg.includes("already been registered") ||
      msg.includes("user already") ||
      msg.includes("email exists") ||
      e?.status === 422
    ) {
      return "email";
    }
    return null;
  };

  useEffect(() => {
    if (!refParam) { setRefStatus("none"); return; }
    setRefStatus("checking");
    (async () => {
      const { data, error } = await supabase.rpc("lookup_referrer", { _code: refParam });
      if (error) {
        const { data: row } = await supabase
          .from("members").select("id, full_name").eq("referral_code", refParam).maybeSingle();
        if (row?.full_name) {
          setReferrerName(row.full_name);
          setRefStatus("valid");
          return;
        }
        setRefStatus("invalid");
        return;
      }

      let referrer: { id?: string; full_name?: string } | null = null;
      if (Array.isArray(data) && data.length > 0) referrer = data[0] as typeof referrer;
      else if (data && typeof data === "object" && (data as { id?: string }).id) referrer = data as typeof referrer;

      if (!referrer || !referrer.full_name) {
        setRefStatus("invalid");
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      const currentUid = sess?.session?.user?.id ?? null;
      if (currentUid && currentUid === referrer.id) {
        setRefStatus("invalid");
        try { localStorage.removeItem("umoja_referral_code"); } catch {}
        toast.error("You can't use your own referral link.");
        return;
      }

      setReferrerName(referrer.full_name);
      setRefStatus("valid");
    })();
  }, [refParam]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const hasValidReferral = !!refParam && refStatus === "valid";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicate(null);
    if (!hasValidReferral) {
      toast.error("UMOJA is referral-only. Ask an existing member for their invite link.");
      return;
    }
    if (!ageConfirmed) {
      toast.error("You must confirm you are 18 years or older");
      return;
    }
    if (!acceptTerms) {
      toast.error("Please accept the Terms of Service and Privacy Policy");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);

    // Pre-flight: check if email or phone is already registered in members.
    try {
      const { data: existing } = await supabase
        .from("members")
        .select("email, phone")
        .or(`email.eq.${parsed.data.email},phone.eq.${parsed.data.phone}`)
        .limit(1)
        .maybeSingle();
      if (existing) {
        setBusy(false);
        if (existing.phone === parsed.data.phone && existing.email !== parsed.data.email) {
          setDuplicate({ kind: "phone", value: parsed.data.phone });
        } else {
          setDuplicate({ kind: "email", value: parsed.data.email });
        }
        return;
      }
    } catch {
      // Non-fatal — fall through to auth.signUp and rely on its error.
    }

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
      },
    });

    if (error || !data.user) {
      setBusy(false);
      const kind = detectDuplicate(error);
      if (kind) {
        setDuplicate({
          kind,
          value: kind === "phone" ? parsed.data.phone : parsed.data.email,
        });
        return;
      }
      const raw = (error?.message ?? "").toLowerCase();
      if (raw.includes("database error")) {
        toast.error("We couldn't create your account. Please double-check your details and try again.");
      } else {
        toast.error(error?.message ?? "Could not create account");
      }
      return;
    }

    const uid = data.user.id;
    const hasSession = !!data.session;

    // Look up currency from country_configs if available; default to USDT for global members.
    let currencyCode = "USDT";
    try {
      const { data: cfg } = await supabase
        .from("country_configs" as any)
        .select("currency_code")
        .eq("country_code", country)
        .maybeSingle();
      if (cfg && (cfg as any).currency_code) currencyCode = (cfg as any).currency_code;
    } catch {}

    const { error: memberErr } = await supabase
      .from("members")
      .upsert(
        {
          id: uid,
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          country_code: country,
          currency_code: currencyCode,
          is_active: true,
          age_verified: true,
          age_verified_at: new Date().toISOString(),
        } as any,
        { onConflict: "id" }
      );

    if (memberErr) {
      const kind = detectDuplicate(memberErr);
      if (kind === "phone") {
        setBusy(false);
        setDuplicate({ kind: "phone", value: parsed.data.phone });
        return;
      }
    }

    if (hasSession) {
      await supabase.rpc("claim_signup_bonus");
    }

    const { data: meRow } = await supabase.from("members").select("referral_code").eq("id", uid).maybeSingle();
    supabase.functions.invoke("send-email", {
      body: {
        template: "welcome",
        to: parsed.data.email,
        member_id: uid,
        bypass_prefs: true,
        data: { name: parsed.data.full_name, referral_code: meRow?.referral_code ?? "" },
      },
    }).catch(() => {});

    let refMsg = "";
    if (hasSession) {
      const { data: res, error: refErr } = await supabase.rpc("apply_referral_signup", { _code: refParam });
      const r = res as { ok?: boolean; reason?: string; referrer_name?: string; referrer_id?: string } | null;
      if (refErr || !r?.ok) {
        toast.warning(`Referral code couldn't be applied (${r?.reason ?? refErr?.message ?? "unknown"}).`);
      } else {
        refMsg = ` Your referrer ${r.referrer_name ?? ""} earned 100 Sparks too 🎁`;
        if (r.referrer_id) {
          const { data: refRow } = await supabase.from("members")
            .select("email, full_name").eq("id", r.referrer_id).maybeSingle();
          const { count } = await supabase.from("members")
            .select("id", { count: "exact", head: true }).eq("referred_by", r.referrer_id);
          if (refRow?.email) {
            supabase.functions.invoke("send-email", {
              body: {
                template: "referral_success",
                to: refRow.email,
                member_id: r.referrer_id,
                data: { name: parsed.data.full_name, total_referrals: count ?? 0 },
              },
            }).catch(() => {});
          }
        }
        try { localStorage.removeItem("umoja_referral_code"); } catch {}
      }
    }
    // If no session yet (email confirm), keep refParam in localStorage so useAuth applies it.

    setBusy(false);
    ttTrack("CompleteRegistration", { content_name: "umoja_signup" });
    fbqTrack("Lead", { content_name: "umoja_signup", country: country });
    toast.success(`You've earned 50 welcome Sparks! ✨${refMsg}`, { duration: 6000 });

    if (data.session) nav("/dashboard", { replace: true });
    else nav("/login", { replace: true });
  };

  return (
    <main className="relative min-h-screen overflow-hidden pb-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-hero" />
      <div className="pointer-events-none absolute -z-10 -right-20 -top-20 h-[60vh] w-[60vh] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -z-10 -left-20 bottom-0 h-[40vh] w-[40vh] rounded-full bg-accent/15 blur-3xl" />

      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Logo />
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-smooth">
            Sign in
          </Link>
        </div>
      </header>

      <section className="px-5 pt-12">
        <div className="mx-auto max-w-md animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs">
            <Sparkles className="h-3 w-3 text-accent" />
            <span className="text-muted-foreground">50 welcome Sparks for new members</span>
          </div>
          <h1 className="mt-5 font-display text-[40px] leading-[1.05] tracking-tight">
            Join the <span className="text-gradient-gold italic font-[450]">circle.</span>
          </h1>

          <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
            <p className="text-xs text-foreground/90 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Join <strong className="text-foreground">{proof.membersCount.toLocaleString("en-ZA")}</strong> members building wealth together
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <span className="rounded-lg bg-background/40 px-2 py-1 text-foreground/85">💰 {fmtR(proof.paidThisMonth)} paid out this month</span>
              <span className="rounded-lg bg-background/40 px-2 py-1 text-foreground/85">⚡ {proof.sparksThisWeek.toLocaleString("en-ZA")} Sparks earned this week</span>
            </div>
          </div>

          {!hasValidReferral && (
            <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4 flex gap-3">
              <Lock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-accent-soft leading-relaxed">
                UMOJA is <strong>referral-only and open worldwide</strong>. Members in every country can join and contribute via USDT.
                Ask an existing member to share their invite link with you.
              </p>
            </div>
          )}

          {refParam && refStatus === "checking" && (
            <div className="mt-3 rounded-2xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground">
              Checking referral code <strong className="font-mono">{refParam}</strong>…
            </div>
          )}
          {hasValidReferral && (
            <div className="mt-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-xs text-accent-soft">
              🎉 You were invited by <strong>{referrerName ?? refParam}</strong>. You'll both earn Sparks when you join.
            </div>
          )}
          {refParam && refStatus === "invalid" && (
            <div className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
              ⚠️ Referral code <strong className="font-mono">{refParam}</strong> isn't valid. Please ask the member for a fresh invite link.
            </div>
          )}

          {duplicate && (
            <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] p-4">
              <p className="text-sm text-foreground">
                ⚠️ This {duplicate.kind === "phone" ? "phone number" : "email"}{" "}
                <strong className="font-medium">{duplicate.value}</strong> is already registered.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Looks like you already have an UMOJA account. Sign in, or reset your password if you've forgotten it.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => nav("/login", { state: { email: duplicate.kind === "email" ? duplicate.value : undefined } })}
                  className="h-10 rounded-xl bg-gradient-primary text-primary-foreground"
                >
                  Sign in instead
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => nav("/forgot-password")}
                  className="h-10 rounded-xl"
                >
                  Forgot password?
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDuplicate(null)}
                  className="h-10 rounded-xl"
                >
                  Try different details
                </Button>
              </div>
            </div>
          )}

          {hasValidReferral ? (
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Country</Label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-12 rounded-2xl bg-secondary/60 border border-border px-3 text-sm"
                >
                  {GLOBAL_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Members worldwide contribute and get paid out in USDT. Local rails (EFT/Paystack) are also available where supported.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Full name</Label>
                <Input value={form.full_name} onChange={update("full_name")} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="Amara Khumalo" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</Label>
                <Input type="email" autoComplete="email" value={form.email} onChange={update("email")} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="you@umoja.africa" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone</Label>
                <Input type="tel" autoComplete="tel" value={form.phone} onChange={update("phone")} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="+country code …" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Password</Label>
                <PasswordInput autoComplete="new-password" value={form.password} onChange={update("password")} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="At least 6 characters" required />
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                  required
                />
                <span className="text-xs leading-relaxed text-foreground/85">
                  I confirm I am <strong>18 years or older</strong>. Spark Pit games are 18+ and have a house edge — you may lose all sparks wagered.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                  required
                />
                <span className="text-xs leading-relaxed text-foreground/85">
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" className="text-accent hover:underline">Terms of Service</Link>{" "}
                  and{" "}
                  <Link to="/privacy" target="_blank" className="text-accent hover:underline">Privacy Policy</Link>.
                </span>
              </label>

              <Button type="submit" disabled={busy || !acceptTerms || !ageConfirmed} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Create my account <ArrowRight className="ml-1 h-4 w-4" /></>)}
              </Button>
            </form>
          ) : (
            <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-6 text-center space-y-3">
              <Lock className="h-6 w-6 text-accent mx-auto" />
              <h2 className="font-display text-xl">Invitation required</h2>
              <p className="text-sm text-muted-foreground">
                Signup is only available through a member's referral link.
                If you already have an invite link, open it now to continue.
              </p>
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/login">I already have an account</Link>
              </Button>
            </div>
          )}

          {hasValidReferral && (
            <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next steps after signup</p>
              <ol className="mt-2 space-y-1 text-sm text-foreground/85">
                <li>1. Complete KYC</li>
                <li>2. Join your first Circle</li>
                <li>3. Join the WhatsApp Community ↓</li>
              </ol>
              <div className="mt-3">
                <WhatsAppCommunity
                  variant="compact"
                  source="signup"
                  heading="Join WhatsApp Community"
                  subheading="Get instant support from our community"
                />
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already a member?{" "}
            <Link to="/login" className="text-accent hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
};

export default Signup;
