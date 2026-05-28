import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowRight, Loader2, Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/umoja/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const COUNTRIES = [
  { code: "ZA", label: "South Africa", flag: "🇿🇦" },
  { code: "NG", label: "Nigeria",      flag: "🇳🇬" },
  { code: "KE", label: "Kenya",        flag: "🇰🇪" },
  { code: "ZW", label: "Zimbabwe",     flag: "🇿🇼" },
  { code: "ZM", label: "Zambia",       flag: "🇿🇲" },
  { code: "MZ", label: "Mozambique",   flag: "🇲🇿" },
] as const;

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(5, "Enter your phone number").max(30),
  country_code: z.enum(["ZA","NG","KE","ZW","ZM","MZ"]),
});

const Waitlist = () => {
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    country_code: "ZA" as (typeof COUNTRIES)[number]["code"],
  });
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("waitlist-signup", {
        body: parsed.data,
      });
      if (error || !data?.success) {
        const msg = (data?.error as string) || error?.message || "Could not create account";
        toast.error(typeof msg === "string" ? msg : "Could not create account");
        setBusy(false);
        return;
      }
      // Auto sign-in with the temp password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.temp_password,
      });
      if (signInErr) {
        toast.error(signInErr.message);
        setBusy(false);
        return;
      }
      toast.success("Welcome to UMOJA RISE 🎉");
      nav("/dashboard", { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  const country = COUNTRIES.find(c => c.code === form.country_code)!;

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
            <span className="text-muted-foreground">Free account · Pan-African</span>
          </div>
          <h1 className="mt-5 font-display text-[40px] leading-[1.05] tracking-tight">
            Welcome to <span className="text-gradient-gold italic font-[450]">UMOJA RISE.</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            Create your free account to access Circles, Drive, Real Estate, Spark Pit and more.
          </p>

          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="h-12 rounded-2xl bg-secondary/60 border-border"
                placeholder="Thandi Mokoena"
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Country</Label>
              <Select
                value={form.country_code}
                onValueChange={(v) => setForm((f) => ({ ...f, country_code: v as typeof f.country_code }))}
              >
                <SelectTrigger className="h-12 rounded-2xl bg-secondary/60 border-border">
                  <SelectValue>
                    <span className="mr-2">{country.flag}</span>{country.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="mr-2">{c.flag}</span>{c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="h-12 rounded-2xl bg-secondary/60 border-border"
                placeholder="you@umoja.africa"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone number</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="h-12 rounded-2xl bg-secondary/60 border-border"
                placeholder="+27 82 123 4567"
                autoComplete="tel"
                required
              />
            </div>

            <Button type="submit" disabled={busy} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Create Account (Free) <ArrowRight className="ml-1 h-4 w-4" /></>)}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
};

export default Waitlist;
