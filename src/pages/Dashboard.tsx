import { Link } from "react-router-dom";
import { Bell, ArrowUpRight, Users, Sparkles, Car, TrendingUp, Plus, ChevronRight, Flame } from "lucide-react";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";

const quickActions = [
  { to: "/circle", icon: Users, label: "Circle", desc: "3 active" , tint: "from-primary/30 to-primary/5"},
  { to: "/spark", icon: Sparkles, label: "Spark", desc: "12 signals", tint: "from-accent/30 to-accent/5" },
  { to: "/drive", icon: Car, label: "Drive", desc: "1 vehicle", tint: "from-primary/25 to-accent/10" },
  { to: "/predictor", icon: TrendingUp, label: "Predict", desc: "+248 SP", tint: "from-accent/25 to-primary/10" },
];

const activity = [
  { title: "Circle payout received", meta: "UMOJA Circle #214 · 2h ago", amount: "+R125,000", positive: true, icon: Users },
  { title: "Spark signal: Air Fryers", meta: "South Africa · today", amount: "Hot", positive: true, icon: Flame },
  { title: "Predictor reward", meta: "USD/ZAR call · yesterday", amount: "+248 SP", positive: true, icon: TrendingUp },
  { title: "Drive contribution", meta: "Vehicle #DR-08", amount: "−R18,000", positive: false, icon: Car },
];

const Dashboard = () => {
  return (
    <main className="relative min-h-screen pb-32">
      {/* Top bar */}
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Logo />
          <button className="relative grid h-10 w-10 place-items-center rounded-2xl glass">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
          </button>
        </div>
      </header>

      {/* Greeting */}
      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Sawubona, Amara</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Your wealth is<br/>
            <span className="text-gradient-gold italic font-[450]">growing in trust.</span>
          </h1>
        </div>
      </section>

      {/* Balance card */}
      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-scale-in">
          <div className="relative overflow-hidden rounded-[28px] p-6 bg-gradient-primary shadow-glow">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
            <div className="absolute inset-0 grain opacity-40" />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/80">Total wealth</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="font-display text-[44px] leading-none text-primary-foreground tracking-tight">R2,184,500</p>
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/15 px-3 py-1 text-xs text-primary-foreground">
                <ArrowUpRight className="h-3.5 w-3.5" /> +12.4% this month
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { k: "Circle", v: "R1.2M" },
                  { k: "Spark", v: "R612K" },
                  { k: "Drive", v: "R372K" },
                ].map((s) => (
                  <div key={s.k} className="rounded-2xl bg-background/15 backdrop-blur p-3">
                    <p className="text-[10px] uppercase tracking-wider text-primary-foreground/75">{s.k}</p>
                    <p className="mt-1 font-display text-base text-primary-foreground">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl">Pillars</h2>
            <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-smooth">
              Customize <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickActions.map(({ to, icon: Icon, label, desc, tint }, i) => (
              <Link
                to={to}
                key={label}
                style={{ animationDelay: `${i * 80}ms` }}
                className="group relative overflow-hidden rounded-3xl border border-border bg-gradient-card p-4 transition-smooth hover:border-primary/40 hover:-translate-y-0.5 animate-slide-up"
              >
                <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tint} blur-2xl`} />
                <div className="relative flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-smooth" />
                </div>
                <p className="relative mt-5 font-display text-lg">{label}</p>
                <p className="relative text-xs text-muted-foreground">{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Active circle */}
      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl">Active circle</h2>
            <Link to="/circle" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-smooth">
              All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-4 rounded-3xl glass p-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Round 7 of 12</p>
                <p className="mt-1 font-display text-xl">UMOJA Circle #214</p>
              </div>
              <div className="flex -space-x-2">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-gradient-to-br from-primary to-accent" />
                ))}
                <div className="h-8 w-8 rounded-full border-2 border-background bg-secondary text-[10px] grid place-items-center">
                  +8
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Pool collected</span>
                <span className="font-display text-base text-gradient-gold">R4.2M / R5.8M</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full w-[72%] rounded-full bg-gradient-gold" />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5">
                <Plus className="h-4 w-4" /> Contribute
              </button>
              <button className="h-11 px-5 rounded-2xl border border-border text-sm font-medium hover:bg-secondary transition-smooth">
                Bid
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Activity */}
      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-xl">Activity</h2>
          <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
            {activity.map(({ title, meta, amount, positive, icon: Icon }, i) => (
              <li
                key={title}
                style={{ animationDelay: `${i * 60}ms` }}
                className="flex items-center gap-4 p-4 animate-fade-in"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{meta}</p>
                </div>
                <span className={`text-sm font-display ${positive ? "text-accent-soft" : "text-muted-foreground"}`}>
                  {amount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Predictor teaser */}
      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <Link to="/predictor" className="group block relative overflow-hidden rounded-3xl border border-border p-6 bg-gradient-card hover:border-accent/50 transition-smooth">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Today's predictor</p>
            <h3 className="mt-2 font-display text-2xl leading-tight">Will cocoa close above <span className="text-gradient-gold">$8,400</span> Friday?</h3>
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/15 text-primary text-xs px-3 py-1">Yes 64%</span>
                <span className="rounded-full bg-secondary text-muted-foreground text-xs px-3 py-1">No 36%</span>
              </div>
              <span className="text-sm font-medium text-foreground inline-flex items-center gap-1 group-hover:text-accent transition-smooth">
                Play <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      <BottomNav />
    </main>
  );
};

export default Dashboard;
