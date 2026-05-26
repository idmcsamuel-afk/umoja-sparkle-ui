import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { ArrowRight, Loader2, Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/umoja/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  city: z.string().trim().max(100).optional(),
});

const Waitlist = () => {
  const [form, setForm] = useState({ email: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("waitlist").insert({
      email: parsed.data.email,
      city: parsed.data.city || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success("You're on the list. We'll be in touch.");
  };

  return (
    <main className="relative min-h-screen overflow-hidden pb-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-hero" />
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
            <Globe2 className="h-3 w-3 text-accent" />
            <span className="text-muted-foreground">Pan-African · Pay in ZAR or USDT</span>
          </div>
          <h1 className="mt-5 font-display text-[40px] leading-[1.05] tracking-tight">
            Join the <span className="text-gradient-gold italic font-[450]">waitlist.</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            UMOJA started in South Africa and is expanding across Africa. Pay with local methods or USDT cryptocurrency from anywhere on the continent.
          </p>

          {done ? (
            <div className="mt-10 rounded-2xl border border-accent/30 bg-accent/5 p-6 text-center">
              <p className="font-display text-xl text-gradient-gold">You're in line ✨</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Have an invite code already?
              </p>
              <Button asChild className="mt-4 h-11 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <Link to="/signup">Sign up with invite code <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-10 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="you@umoja.africa" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">City (optional)</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="h-12 rounded-2xl bg-secondary/60 border-border" placeholder="Johannesburg" />
              </div>
              <Button type="submit" disabled={busy} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Notify me <ArrowRight className="ml-1 h-4 w-4" /></>)}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Have an invite code? <Link to="/signup" className="text-accent hover:underline">Sign up here</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default Waitlist;
