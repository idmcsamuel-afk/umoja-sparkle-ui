import { Link } from "react-router-dom";
import { Lock, Globe2 } from "lucide-react";
import { Logo } from "@/components/umoja/Logo";
import { Button } from "@/components/ui/button";

// UMOJA is now referral-only and open to members worldwide (USDT).
// The previous public waitlist signup has been disabled — new members must
// register through an existing member's referral link.
const Waitlist = () => {
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

      <section className="px-5 pt-16">
        <div className="mx-auto max-w-md animate-fade-in text-center">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs">
            <Globe2 className="h-3 w-3 text-accent" />
            <span className="text-muted-foreground">Open worldwide · USDT-friendly</span>
          </div>

          <h1 className="mt-6 font-display text-[36px] leading-[1.1] tracking-tight">
            UMOJA is <span className="text-gradient-gold italic font-[450]">invite-only.</span>
          </h1>

          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Membership is open to people in every country who want to contribute through USDT —
            but the only way to register is through an existing member's referral link.
          </p>

          <div className="mt-8 rounded-2xl border border-accent/30 bg-accent/5 p-5 flex gap-3 text-left">
            <Lock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-accent-soft leading-relaxed">
              Ask a member to share their personal invite link with you. Once you open it,
              you'll be able to create your free account.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-2.5">
            <Button asChild variant="outline" className="h-11 rounded-2xl">
              <Link to="/login">I already have an account</Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 rounded-2xl">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Waitlist;
