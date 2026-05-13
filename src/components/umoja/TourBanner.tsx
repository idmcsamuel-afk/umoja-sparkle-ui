import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { restartProductTour } from "@/components/umoja/ProductTour";

const TOUR_KEY = "umoja_tour_completed";
const DISMISS_KEY = "umoja_tour_banner_dismissed";

export const TourBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      const completed = localStorage.getItem(TOUR_KEY);
      const dismissed = localStorage.getItem(DISMISS_KEY);
      setVisible(!completed && !dismissed);
    };
    check();
    window.addEventListener("storage", check);
    window.addEventListener("umoja:tour-state", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("umoja:tour-state", check);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="mx-3 mt-3 md:mx-4 md:mt-4 rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 via-primary/5 to-accent/10 px-4 py-3 shadow-soft flex items-center gap-3">
      <span className="text-xl shrink-0" aria-hidden>👋</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          New to UMOJA?{" "}
          <button
            type="button"
            onClick={() => {
              restartProductTour();
            }}
            className="text-accent underline underline-offset-2 hover:text-accent/80 font-semibold"
          >
            Take the Tour
          </button>
        </p>
        <p className="text-xs text-muted-foreground hidden sm:block">
          A quick 2-minute walkthrough of Circle, Spark Trade, Property and more.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss tour banner"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setVisible(false);
        }}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
