import { Link } from "react-router-dom";
import { ArrowRight, Users, Sparkles, Car, TrendingUp, ShieldCheck, Globe2, Crown, Coins, Dice5, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/umoja/Logo";
import hero from "@/assets/hero.jpg";
import pattern from "@/assets/pattern.jpg";

const pillars = [
  {
    icon: Users,
    name: "Circle",
    tag: "Save & bid together",
    desc: "Modern community savings. Pool, bid, and grow with people you trust.",
  },
  {
    icon: Sparkles,
    name: "Spark Trade",
    tag: "Buyers club intelligence",
    desc: "Product signals and group buying power for traders across the continent.",
  },
  {
    icon: Car,
    name: "UMOJA Drive",
    tag: "Own the road, together",
    desc: "Community car ownership — share the asset, share the upside.",
  },
  {
    icon: TrendingUp,
    name: "Predictor",
    tag: "The market, gamified",
    desc: "Predict markets, earn Sparks, climb the leaderboard.",
  },
];

const stats = [
  { k: "120K+", v: "Members" },
  { k: "$48M", v: "Pooled" },
  { k: "14", v: "Countries" },
];

const Landing = () => {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-hero" />
      <img
        src={pattern}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -z-10 right-[-30%] top-[-10%] h-[120vh] w-[120vh] opacity-[0.06] mix-blend-screen rotate-12"
      />

      {/* Nav */}
      <header className="relative z-10 px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Logo />
          <Link
            to="/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-10">
        <div className="mx-auto max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-muted-foreground animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Africa's community wealth platform
          </div>

          <h1 className="mt-5 font-display text-[44px] leading-[1.02] font-semibold tracking-tight animate-slide-up">
            Wealth is{" "}
            <span className="text-gradient-gold italic font-[450]">stronger</span>
            <br />
            when it's{" "}
            <span className="text-gradient-primary">shared.</span>
          </h1>

          <p className="mt-5 text-base text-muted-foreground leading-relaxed animate-slide-up [animation-delay:120ms]">
            UMOJA unites the continent through circles of trust — saving, trading,
            driving and predicting the future, together.
          </p>

          <div className="mt-7 flex items-center gap-3 animate-slide-up [animation-delay:200ms]">
            <Button asChild size="lg" className="h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95 px-5">
              <Link to="/dashboard">
                Enter UMOJA <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-12 rounded-2xl text-foreground hover:bg-secondary">
              <a href="#pillars">How it works</a>
            </Button>
          </div>

          {/* Hero image */}
          <div className="relative mt-10 animate-scale-in [animation-delay:280ms]">
            <div className="relative overflow-hidden rounded-[28px] border border-border shadow-soft">
              <img
                src={hero}
                alt="A vibrant African community gathering at golden hour"
                width={1024}
                height={1280}
                className="h-[420px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 glass rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-accent-soft">Live circle</p>
                    <p className="font-display text-lg">UMOJA Circle #214</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pool</p>
                    <p className="font-display text-lg text-gradient-gold">R4.2M</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full w-[72%] rounded-full bg-gradient-gold animate-shimmer bg-[length:200%_100%]" />
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -right-2 glass rounded-2xl px-4 py-3 shadow-gold animate-float">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">This week</p>
              <p className="font-display text-base">+R182,400 earned</p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-14 grid grid-cols-3 gap-2 animate-fade-in">
            {stats.map((s) => (
              <div key={s.v} className="rounded-2xl glass p-4 text-center">
                <p className="font-display text-2xl tracking-tight">{s.k}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section id="pillars" className="relative px-5 pt-20">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Four pillars</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight">
            One platform.<br />Built by Africa, for Africa.
          </h2>

          <div className="mt-8 space-y-3">
            {pillars.map(({ icon: Icon, name, tag, desc }, i) => (
              <article
                key={name}
                style={{ animationDelay: `${i * 80}ms` }}
                className="group relative overflow-hidden rounded-3xl bg-gradient-card border border-border p-5 transition-smooth hover:border-primary/40 hover:shadow-glow animate-slide-up"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-primary group-hover:bg-gradient-primary group-hover:text-primary-foreground transition-smooth">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-display text-xl">{name}</h3>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-accent">{tag}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
                <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-smooth" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="relative px-5 pt-20">
        <div className="mx-auto max-w-md grid gap-3">
          <div className="rounded-3xl glass p-6 flex items-start gap-4">
            <ShieldCheck className="h-6 w-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-display text-lg">Trust, by design</h3>
              <p className="mt-1 text-sm text-muted-foreground">Every circle is governed by transparent on-platform rules and member consensus.</p>
            </div>
          </div>
          <div className="rounded-3xl glass p-6 flex items-start gap-4">
            <Globe2 className="h-6 w-6 text-accent mt-0.5" />
            <div>
              <h3 className="font-display text-lg">Pan-African by default</h3>
              <p className="mt-1 text-sm text-muted-foreground">From Lagos to Nairobi, Accra to Kigali — one currency-aware experience.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-5 pt-20 pb-28">
        <div className="mx-auto max-w-md">
          <div className="relative overflow-hidden rounded-[32px] p-8 bg-gradient-primary shadow-glow">
            <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
            <p className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/80">Join UMOJA</p>
            <h2 className="mt-3 font-display text-3xl text-primary-foreground leading-tight">
              Your circle is<br /> already gathering.
            </h2>
            <Button asChild size="lg" className="mt-6 h-12 rounded-2xl bg-background text-foreground hover:bg-background/90">
              <Link to="/dashboard">
                Open the app <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} UMOJA. Built with the continent.
          </p>
        </div>
      </section>
    </main>
  );
};

export default Landing;
