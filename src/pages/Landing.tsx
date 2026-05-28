import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users, Sparkles, Car, TrendingUp, ShieldCheck, Globe2, Crown, Coins, Dice5, Gamepad2, Star, Lock, BadgeCheck, PlayCircle, Check, LineChart, Package, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/umoja/Logo";
import { SiteFooter } from "@/components/umoja/SiteFooter";
import { WhatsAppCommunity, WhatsAppFab } from "@/components/umoja/WhatsAppCommunity";
import { useSocialProof, fmtR } from "@/hooks/useSocialProof";
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
    tag: "Trade smart, not blind",
    desc: "Stop guessing what to import. Our AI tracks 300,000+ products across Amazon, Takealot and Alibaba — showing you EXACTLY what's selling fast with 40–60% margins. Then pool orders to hit MOQ and unlock bulk pricing.",
  },
  {
    icon: Car,
    name: "UMOJA Drive",
    tag: "Own a car in 12 months",
    desc: "OWN YOUR FIRST CAR IN 12 MONTHS. You thought a car was out of reach? Not anymore. 200 members pool R1,500/month = R300K in 90 days. We buy the car, award it to one member via fair bidding. Everyone gets their turn. This is how community wins.",
  },
  {
    icon: TrendingUp,
    name: "Predictor",
    tag: "The market, gamified",
    desc: "Predict markets, earn Sparks, climb the leaderboard. Win Sparks. Trade them for cash on the Exchange.",
  },
];

const stats = [
  { k: "120K+", v: "Members" },
  { k: "$48M", v: "Pooled" },
  { k: "14", v: "Countries" },
];

const Landing = () => {
  const proof = useSocialProof();
  useEffect(() => { import("@/lib/tiktokPixel").then(m => m.ttTrack("ViewContent", { content_type: "product" })); }, []);
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
          <div className="flex items-center gap-4 text-sm">
            <Link to="/blog" className="font-medium text-muted-foreground hover:text-foreground transition-smooth">
              Blog
            </Link>
            <Link
              to="/dashboard"
              className="font-medium text-muted-foreground hover:text-foreground transition-smooth"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative px-5 pt-10">
        <div className="mx-auto max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-muted-foreground animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Africa's community wealth platform
            <span className="mx-1 h-3 w-px bg-border" />
            <span className="inline-flex items-center gap-1 text-accent-soft">
              <Star className="h-3 w-3 fill-current" /> 4.9
            </span>
          </div>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            🔥 {proof.membersCount.toLocaleString("en-ZA")} members earned {fmtR(proof.paidThisMonth)} this month
          </div>

          <h1 className="mt-5 font-display text-[44px] leading-[1.02] font-semibold tracking-tight animate-slide-up">
            Wealth is{" "}
            <span className="text-gradient-gold italic font-[450]">stronger</span>
            <br />
            when it's{" "}
            <span className="text-gradient-primary">shared.</span>
          </h1>

          <p className="mt-5 text-base text-muted-foreground leading-relaxed animate-slide-up [animation-delay:120ms]">
            Join a Circle in 60 seconds. Save together, get paid out faster, and unlock cars, capital and cash games — all backed by your community.
          </p>

          {/* Primary + secondary CTAs */}
          <div className="mt-7 flex flex-col gap-2.5 animate-slide-up [animation-delay:200ms]">
            <Button asChild size="lg" className="h-14 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95 px-5 text-base font-semibold">
              <Link to="/waitlist">
                Join Free <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="flex-1 h-11 rounded-2xl border-border bg-secondary/40 hover:bg-secondary">
                <Link to="/login">I already have an account</Link>
              </Button>
              <Button asChild variant="ghost" className="h-11 rounded-2xl text-foreground hover:bg-secondary px-3">
                <a href="#pillars" aria-label="See how it works">
                  <PlayCircle className="mr-1.5 h-4 w-4" /> How it works
                </a>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              No setup fees · Cancel anytime · First payout in days, not months
            </p>
          </div>

          {/* Trust signals row */}
          <div className="mt-6 grid grid-cols-3 gap-2 animate-fade-in [animation-delay:260ms]">
            {[
              { icon: ShieldCheck, label: "KYC verified" },
              { icon: Lock, label: "Bank-grade security" },
              { icon: BadgeCheck, label: "Member-governed" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl glass p-3 text-center flex flex-col items-center gap-1">
                <Icon className="h-4 w-4 text-accent" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Global payment methods */}
          <div className="mt-4 rounded-2xl glass p-3 animate-fade-in [animation-delay:280ms]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Pay your way · works across Africa</p>
            <ul className="mt-2 grid gap-1 text-xs text-foreground/90">
              <li>💳 Card payment <span className="text-muted-foreground">— instant</span></li>
              <li>🏦 Bank transfer (EFT) <span className="text-muted-foreground">— South Africa</span></li>
              <li>⚡ USDT crypto <span className="text-muted-foreground">— global, no bank needed</span></li>
            </ul>
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

          {/* Social proof */}
          <div className="mt-12 rounded-3xl glass p-4 flex items-center gap-3 animate-fade-in">
            <div className="flex -space-x-2 shrink-0">
              {["A","T","N","K"].map((c, i) => (
                <div key={i} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-background text-[11px] font-semibold ${["bg-primary/30 text-primary","bg-accent/30 text-accent","bg-secondary text-foreground","bg-primary/20 text-primary"][i]}`}>{c}</div>
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-foreground/90 leading-snug">"Got my payout in 9 days. The Circle just works."</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Thandi · Gold member · Johannesburg</p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-2 animate-fade-in">
            {stats.map((s) => (
              <div key={s.v} className="rounded-2xl glass p-4 text-center">
                <p className="font-display text-2xl tracking-tight">{s.k}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>

          {/* Quick anchor jumps */}
          <nav className="mt-8 flex flex-wrap gap-2 animate-fade-in" aria-label="Jump to section">
            {[
              { href: "#pillars", label: "Pillars" },
              { href: "#sparkpit", label: "Spark Pit" },
              { href: "#trust", label: "Trust" },
            ].map((a) => (
              <a key={a.href} href={a.href}
                className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-accent/40 transition-smooth">
                {a.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Founding tier pricing removed — landing page is platform-wide and free to join. */}

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

      {/* Spark Trade deep-dive */}
      <section id="sparktrade" className="relative px-5 pt-20">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" /> Spark Trade
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight">
            TRADE SMART,<br />NOT BLIND.
          </h2>

          <div className="mt-6 rounded-3xl border border-primary/30 bg-gradient-card p-6 shadow-glow">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Stop guessing what to import. Our AI tracks{" "}
              <span className="text-foreground font-semibold">300,000+ products</span> across
              Amazon, Takealot, and Alibaba — showing you EXACTLY what's selling fast with{" "}
              <span className="text-gradient-gold font-display">40–60% margins</span>.
            </p>

            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-accent">
              See the data BEFORE you buy
            </p>
            <ul className="mt-3 space-y-2.5">
              {[
                { icon: Activity, text: "Sales velocity (units sold per day)" },
                { icon: LineChart, text: "Profit margins (buy price vs sell price)" },
                { icon: TrendingUp, text: "Market signals (trending up or cooling down)" },
                { icon: Package, text: "Minimum order quantities" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="flex-1 text-foreground/90">
                    <Icon className="mr-1.5 inline h-3.5 w-3.5 text-accent/80" />
                    {text}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
              Then pool your order with other traders to hit MOQ and unlock bulk pricing. You get{" "}
              <span className="text-foreground font-semibold">market intelligence + group buying power</span>.
            </p>

            <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4">
              <p className="text-sm leading-relaxed">
                Real traders are making{" "}
                <span className="text-gradient-gold font-display text-lg">R50K–R200K</span> monthly
                because they <span className="font-semibold">BUY WHAT'S PROVEN TO SELL.</span>
              </p>
            </div>

            <Button asChild size="lg" className="mt-6 w-full bg-gradient-primary shadow-glow">
              <Link to="/spark#signals">
                See Live Signals <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Spark Pit games */}
      <section id="sparkpit" className="relative px-5 pt-20">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent inline-flex items-center gap-2">
            <Gamepad2 className="h-3.5 w-3.5" /> Spark Pit
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight">
            Win while you <span className="text-gradient-gold italic font-[450]">save</span> 🎮
          </h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Play Dream Draw, Spark Flip and predict the market — all with Sparks earned from your Circle.
          </p>

          <div className="mt-6 grid gap-3">
            {[
              { icon: Dice5, name: "Dream Draw", tag: "Weekly lottery", desc: "50 Sparks per entry. One winner takes the pot.", grad: "from-accent/30 to-primary/10" },
              { icon: Coins, name: "Spark Flip", tag: "Coin flip", desc: "20 Sparks per flip. Double or nothing — 10 plays a day.", grad: "from-primary/30 to-accent/10" },
              { icon: TrendingUp, name: "Predictor", tag: "Market game", desc: "Predict tomorrow's market. Climb the leaderboard.", grad: "from-emerald-700/30 to-accent/10" },
            ].map((g, i) => (
              <article
                key={g.name}
                style={{ animationDelay: `${i * 80}ms` }}
                className={`group relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${g.grad} p-5 animate-slide-up hover:shadow-glow transition-smooth`}
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-background/40 backdrop-blur text-accent group-hover:scale-110 transition-transform">
                    <g.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-display text-xl">{g.name}</h3>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-accent">{g.tag}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{g.desc}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="relative px-5 pt-20">
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
        </div>
      </section>

      <WhatsAppCommunity
        source="landing"
        subheading={`Join ${proof.membersCount.toLocaleString("en-ZA")}+ members on WhatsApp`}
      />

      <SiteFooter />
      <WhatsAppFab source="landing" />
    </main>
  );
};

export default Landing;
