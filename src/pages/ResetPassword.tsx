import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/umoja/Logo";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ResetPassword = () => {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase parses the hash automatically and emits PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValidSession(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset successful! Redirecting to login...");
    setTimeout(() => {
      supabase.auth.signOut();
      nav("/login");
    }, 1800);
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-hero" />
      <div className="pointer-events-none absolute -z-10 -right-20 -top-20 h-[60vh] w-[60vh] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -z-10 -left-20 bottom-0 h-[40vh] w-[40vh] rounded-full bg-accent/15 blur-3xl" />

      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Logo />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-smooth">Home</Link>
        </div>
      </header>

      <section className="px-5 pt-14">
        <div className="mx-auto max-w-md animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Reset password</p>
          <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-tight">
            Choose a new <span className="text-gradient-gold italic font-[450]">password</span>
          </h1>

          {checking ? (
            <div className="mt-10 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying reset link…
            </div>
          ) : !validSession ? (
            <div className="mt-10 space-y-4">
              <p className="text-muted-foreground">
                This password reset link has expired or is invalid.
              </p>
              <Button asChild className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
                <Link to="/forgot-password">Request new reset link <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-10 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">New password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-2xl bg-secondary/60 border-border"
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Confirm password</Label>
                <PasswordInput
                  id="confirm"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-12 rounded-2xl bg-secondary/60 border-border"
                  placeholder="Re-enter password"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Use at least 8 characters. Mix letters, numbers and symbols for a stronger password.</p>
              <Button type="submit" disabled={busy} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Reset password <ArrowRight className="ml-1 h-4 w-4" /></>)}
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default ResetPassword;
