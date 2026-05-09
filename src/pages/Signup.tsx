import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/umoja/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a valid phone").max(20),
  password: z.string().min(6, "At least 6 characters").max(100),
});

const Signup = () => {
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

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

    // Insert member profile + welcome wallet (RLS requires auth.uid() = id / member_id)
    const uid = data.user.id;
    const { error: memberErr } = await supabase.from("members").insert({
      id: uid,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      is_active: true,
    });

    if (memberErr) {
      console.error("member insert", memberErr);
      toast.error("Account created but profile setup failed. Please contact support.");
      setBusy(false);
      return;
    }

    await supabase.from("spark_wallets").insert({ member_id: uid, balance: 100 });

    setBusy(false);
    toast.success("You've earned 100 welcome Sparks! ✨", { duration: 5000 });

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
            <span className="text-muted-foreground">100 welcome Sparks for new members</span>
          </div>
          <h1 className="mt-5 font-display text-[40px] leading-[1.05] tracking-tight">
            Join the{" "}
            <span className="text-gradient-gold italic font-[450]">circle.</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            Wealth is stronger when it's shared.
          </p>

          <form onSubmit={onSubmit} className="mt-10 space-y-5">
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
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Password</Label>
              <Input type="password" autoComplete="new-password" value={form.password} onChange={update("password")} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="At least 6 characters" required />
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
