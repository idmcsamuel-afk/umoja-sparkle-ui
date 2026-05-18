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

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a valid phone").max(20),
  password: z.string().min(6, "At least 6 characters").max(100),
  invite_code: z.string().trim().max(64).optional(),
});

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
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", invite_code: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!refParam) { setRefStatus("none"); return; }
    setRefStatus("checking");
    (async () => {
      console.log("[Signup] Validating code:", refParam);
      const { data, error } = await supabase.rpc("lookup_referrer", { _code: refParam });
      console.log("[Signup] Raw RPC response:", { data, error });
      console.log("[Signup] Data type:", typeof data, "isArray:", Array.isArray(data));
      console.log("[Signup] Data content:", JSON.stringify(data));

      if (error) {
        console.error("[Signup] lookup_referrer RPC error:", error);
        // Fallback to direct table lookup
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
        console.warn("[Signup] No referrer found for code:", refParam);
        setRefStatus("invalid");
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      const currentUid = sess?.session?.user?.id ?? null;
      if (currentUid && currentUid === referrer.id) {
        console.warn("[Signup] self-referral blocked", { refParam, currentUid });
        setRefStatus("invalid");
        try { localStorage.removeItem("umoja_referral_code"); } catch {}
        toast.error("You can't use your own referral link.");
        return;
      }

      console.log("[Signup] ✅ Valid referrer:", referrer.full_name);
      setReferrerName(referrer.full_name);
      setRefStatus("valid");
    })();
  }, [refParam]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);

    // Gate: SA phone OR valid invite code
    const phoneSA = parsed.data.phone.replace(/\s+/g, "").startsWith("+27");
    const code = parsed.data.invite_code?.trim();

    let inviteRedeemed = false;
    if (code) {
      const { data: ok, error: rpcErr } = await supabase.rpc("redeem_invite_code", { _code: code });
      if (rpcErr) {
        setBusy(false);
        toast.error("Could not validate invite code");
        return;
      }
      if (!ok) {
        setBusy(false);
        toast.error("Invite code is invalid or already used");
        return;
      }
      inviteRedeemed = true;
    }

    const hasValidReferral = !!refParam && refStatus === "valid";

    if (!phoneSA && !inviteRedeemed && !hasValidReferral) {
      setBusy(false);
      toast.error("UMOJA is currently invite-only outside South Africa. Use a referral link, enter a valid invite code, or join the waitlist.");
      return;
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
      toast.error(error?.message ?? "Could not create account");
      return;
    }

    const uid = data.user.id;
    const hasSession = !!data.session;
    console.log("[signup] auth.signUp ok", { uid, hasSession, refParam, refStatus });

    // The handle_new_auth_user trigger already inserts the members row, so use upsert
    // to enrich it (full_name/email/phone) without colliding on the primary key.
    const { error: memberErr } = await supabase
      .from("members")
      .upsert(
        {
          id: uid,
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          is_active: true,
        },
        { onConflict: "id" }
      );

    if (memberErr) {
      console.error("[signup] member upsert failed", memberErr);
      // Non-fatal — trigger row exists. Continue so we still try referral/bonus.
    }

    // claim_signup_bonus and apply_referral_signup BOTH require auth.uid().
    // If email confirmation is required, there's no session yet — defer to first login.
    if (hasSession) {
      const { data: bonus, error: bonusErr } = await supabase.rpc("claim_signup_bonus");
      console.log("[signup] claim_signup_bonus", { bonus, bonusErr });
    } else {
      console.log("[signup] no session yet (email confirm) — bonuses deferred to first login");
    }

    // Fetch member referral code for the welcome email
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
    if (refParam && refStatus !== "invalid" && hasSession) {
      console.log("[signup] calling apply_referral_signup", { uid, refParam });
      const { data: res, error: refErr } = await supabase.rpc("apply_referral_signup", { _code: refParam });
      const r = res as { ok?: boolean; reason?: string; referrer_name?: string; referrer_id?: string } | null;
      console.log("[Signup] ========= REFERRAL RESULT =========");
      console.log("[Signup] Success:", !!r?.ok);
      console.log("[Signup] Reason/Error:", r?.reason ?? refErr?.message ?? "(none)");
      console.log("[Signup] Referrer ID:", r?.referrer_id ?? "(none)");
      console.log("[Signup] Referrer Name:", r?.referrer_name ?? "(none)");
      console.log("[Signup] Raw data:", JSON.stringify(res));
      console.log("[Signup] Raw error:", JSON.stringify(refErr));
      console.log("[Signup] ======================================");
      if (refErr || !r?.ok) {
        console.warn("[signup] referral NOT applied", { refErr, reason: r?.reason });
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
    } else if (refParam && refStatus === "invalid") {
      toast.warning("Invalid referral code — signup allowed without referral bonus.");
      try { localStorage.removeItem("umoja_referral_code"); } catch {}
    } else if (refParam && !hasSession) {
      console.log("[signup] referral deferred to first login (still in localStorage):", refParam);
      // Keep umoja_referral_code so useAuth applies it after email confirmation.
    }

    setBusy(false);
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

          <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4 flex gap-3">
            <Lock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-accent-soft leading-relaxed">
              UMOJA is currently invite-only for South African residents.{" "}
              <Link to="/waitlist" className="underline text-accent">Join the waitlist</Link> to be notified when we open in your region.
            </p>
          </div>

          {refParam && refStatus === "checking" && (
            <div className="mt-3 rounded-2xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground">
              Checking referral code <strong className="font-mono">{refParam}</strong>…
            </div>
          )}
          {refParam && refStatus === "valid" && (
            <div className="mt-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-xs text-accent-soft">
              🎉 You were invited by <strong>{referrerName ?? refParam}</strong>. You'll both earn Sparks when you join.
            </div>
          )}
          {refParam && refStatus === "invalid" && (
            <div className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
              ⚠️ Referral code <strong className="font-mono">{refParam}</strong> isn't valid. You can still sign up — you just won't get a referral bonus.
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
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
              <Input type="tel" autoComplete="tel" value={form.phone} onChange={update("phone")} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="+27 …" required />
              <p className="text-[11px] text-muted-foreground">South African numbers (+27) are auto-approved.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Invite code (optional)</Label>
              <Input value={form.invite_code} onChange={update("invite_code")} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="Required outside +27" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Password</Label>
              <PasswordInput autoComplete="new-password" value={form.password} onChange={update("password")} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="At least 6 characters" required />
            </div>

            <Button type="submit" disabled={busy} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Create my account <ArrowRight className="ml-1 h-4 w-4" /></>)}
            </Button>
          </form>

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
