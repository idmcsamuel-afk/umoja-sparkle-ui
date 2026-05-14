import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { restartProductTour } from "@/components/umoja/ProductTour";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const TOUR_KEY = "umoja_tour_completed";
// Legacy localStorage key — used as a fallback for signed-out users and during migration.
const LEGACY_DISMISS_KEY = "umoja_tour_banner_dismissed";

export const TourBanner = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [remoteDismissed, setRemoteDismissed] = useState<boolean | null>(null);

  // Fetch persisted dismissal from Supabase for the signed-in member.
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setRemoteDismissed(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("tour_banner_dismissed_at")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const dismissed = !!data?.tour_banner_dismissed_at;
      setRemoteDismissed(dismissed);
      // Backfill: if user had dismissed locally but not remotely, push it up once.
      if (!dismissed && localStorage.getItem(LEGACY_DISMISS_KEY)) {
        await supabase
          .from("members")
          .update({ tour_banner_dismissed_at: new Date().toISOString() })
          .eq("id", user.id);
        setRemoteDismissed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    const check = () => {
      const completed = localStorage.getItem(TOUR_KEY);
      // Signed-in users → use remote flag. Signed-out → fall back to localStorage.
      const dismissed = user?.id
        ? remoteDismissed === true
        : !!localStorage.getItem(LEGACY_DISMISS_KEY);
      // While we're still loading the remote value for a signed-in user, hide to avoid flicker.
      if (user?.id && remoteDismissed === null) {
        setVisible(false);
        return;
      }
      setVisible(!completed && !dismissed);
    };
    check();
    window.addEventListener("storage", check);
    window.addEventListener("umoja:tour-state", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("umoja:tour-state", check);
    };
  }, [user?.id, remoteDismissed]);

  if (!visible) return null;

  const handleDismiss = async () => {
    setVisible(false);
    if (user?.id) {
      setRemoteDismissed(true);
      await supabase
        .from("members")
        .update({ tour_banner_dismissed_at: new Date().toISOString() })
        .eq("id", user.id);
    } else {
      localStorage.setItem(LEGACY_DISMISS_KEY, "1");
    }
  };

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
        onClick={handleDismiss}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
