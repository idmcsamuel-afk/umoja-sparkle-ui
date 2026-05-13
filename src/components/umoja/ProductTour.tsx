import { Joyride, Step, EventData, STATUS } from "react-joyride";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";

const TOUR_KEY = "umoja_tour_completed";

const TOUR_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    
    content: (
      <div className="space-y-2">
        <h3 className="text-lg font-display text-accent">Welcome to UMOJA! 🎉</h3>
        <p className="text-sm">Let's take a quick 2-minute tour to show you how everything works.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="dashboard"]',
    placement: "right",
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-display text-accent">Your Dashboard</h3>
        <p className="text-sm">See your Sparks balance, Circle progress, and quick actions here.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="circle"]',
    placement: "right",
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-display text-accent">Circle — Rotating Savings 🎯</h3>
        <p className="text-sm font-medium">How it works:</p>
        <ul className="text-xs list-disc pl-4 space-y-1">
          <li>Choose a tier: Seed (R200–R2K), Growth (R2K–R10K), Harvest (R10K+)</li>
          <li>Make your monthly contribution (minimum R200)</li>
          <li>Get ranked by priority score (consistency + time + contribution)</li>
          <li>Top scorers get payouts each allocation session</li>
          <li>Everyone gets their turn based on merit</li>
        </ul>
        <p className="text-xs italic text-muted-foreground">It's NOT first-come-first-served — it's MERIT-based!</p>
        <p className="text-[11px] text-muted-foreground">Your consistency, contribution size, and community impact determine your rank.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="spark-trade"]',
    placement: "right",
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-display text-accent">Spark Trade — Group Buying 📦</h3>
        <p className="text-sm">See what's selling in real-time. Join group buys to get wholesale prices from China.</p>
        <p className="text-xs text-muted-foreground">We show sales velocity, profit margins, and MOQ requirements.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="property"]',
    placement: "right",
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-display text-accent">Property Fund — Real Estate 🏘️</h3>
        <p className="text-sm">Invest in properties from R1,000:</p>
        <ul className="text-xs list-disc pl-4 space-y-1">
          <li>Traditional SA properties</li>
          <li>China modular homes (40% cheaper, 8 weeks delivery)</li>
        </ul>
        <p className="text-xs">Earn monthly rental income!</p>
      </div>
    ),
  },
  {
    target: '[data-tour="drive"]',
    placement: "right",
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-display text-accent">UMOJA Drive — Vehicle Program 🚗</h3>
        <p className="text-sm">Own your first car in 12 months through community vehicle purchase.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="referrals"]',
    placement: "right",
    content: (
      <div className="space-y-2">
        <h3 className="text-base font-display text-accent">Earn Sparks by Referring! 💰</h3>
        <p className="text-sm">Get 100 Sparks per referral. Share your link and grow the community.</p>
        <p className="text-xs text-muted-foreground">Your referrals also get 50 Sparks as a welcome bonus!</p>
      </div>
    ),
  },
  {
    target: "body",
    placement: "center",
    content: (
      <div className="space-y-2">
        <h3 className="text-lg font-display text-accent">You're All Set! 🚀</h3>
        <p className="text-sm">Start by joining a Circle or exploring Spark Trade.</p>
        <p className="text-xs text-muted-foreground">You can restart this tour anytime from the sidebar.</p>
      </div>
    ),
  },
];

export const ProductTour = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (!pathname.startsWith("/dashboard")) return;
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => setRun(true), 1000);
    return () => clearTimeout(t);
  }, [user, loading, pathname]);

  // Listen for manual restart
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(TOUR_KEY);
      setRun(false);
      setTimeout(() => setRun(true), 50);
    };
    window.addEventListener("umoja:restart-tour", handler);
    return () => window.removeEventListener("umoja:restart-tour", handler);
  }, []);

  const handleEvent = (data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(TOUR_KEY, "true");
      window.dispatchEvent(new CustomEvent("umoja:tour-state"));
    }
  };

  if (!user) return null;

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{ back: "Back", close: "Close", last: "Done", next: "Next", skip: "Skip tour" }}
      styles={{
        tooltip: { borderRadius: 12, padding: 16, backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" },
        buttonPrimary: { borderRadius: 8, fontWeight: 600, backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" },
        buttonBack: { color: "hsl(var(--muted-foreground))" },
        buttonSkip: { color: "hsl(var(--muted-foreground))" },
        overlay: { backgroundColor: "rgba(0,0,0,0.65)" },
        
      }}
    />
  );
};

export const restartProductTour = () => {
  localStorage.removeItem(TOUR_KEY);
  window.dispatchEvent(new CustomEvent("umoja:restart-tour"));
};
