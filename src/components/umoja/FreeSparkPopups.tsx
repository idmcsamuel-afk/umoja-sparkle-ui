import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Gift, Flame, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ClaimType = "signup_bonus" | "daily_3" | "daily_7" | "daily_30" | "streak_5";

const SESSION_FLAG = "umoja_popups_shown_today";
const MAX_PER_SESSION = 2;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function popupsShownToday(): number {
  try {
    const raw = localStorage.getItem(SESSION_FLAG);
    if (!raw) return 0;
    const [day, count] = raw.split(":");
    if (day !== todayKey()) return 0;
    return Number(count) || 0;
  } catch { return 0; }
}
function bumpPopupsShown() {
  try {
    const n = popupsShownToday() + 1;
    localStorage.setItem(SESSION_FLAG, `${todayKey()}:${n}`);
  } catch {}
}

export function FreeSparkPopups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [active, setActive] = useState<null | {
    type: ClaimType | "out_of_sparks";
    title: string;
    body: string;
    sparks?: number;
    cta?: string;
    onCta?: () => void;
  }>(null);
  const [checked, setChecked] = useState(false);

  const open = (cfg: NonNullable<typeof active>) => {
    if (popupsShownToday() >= MAX_PER_SESSION && cfg.type !== "out_of_sparks" && cfg.type !== "signup_bonus") return;
    setActive(cfg);
    bumpPopupsShown();
  };

  // Out-of-sparks listener (global event from games)
  useEffect(() => {
    const h = () => {
      open({
        type: "out_of_sparks",
        title: "Oh no! 😞",
        body: "You're out of sparks. Top up to keep playing — or grab a free one from Daily Questions.",
        cta: "Buy More Sparks",
        onCta: () => navigate("/buy-sparks"),
      });
    };
    window.addEventListener("umoja:out-of-sparks", h);
    return () => window.removeEventListener("umoja:out-of-sparks", h);
  }, [navigate]);

  // Winning streak listener
  useEffect(() => {
    const h = (e: Event) => {
      const wins = Number((e as CustomEvent).detail?.wins ?? 0);
      if (wins < 5) return;
      open({
        type: "streak_5",
        title: "🔥 5-Win Streak!",
        body: "You're on fire! Claim 25 bonus sparks and keep the run going.",
        sparks: 25,
        cta: "Claim 25 ⚡",
      });
    };
    window.addEventListener("umoja:win-streak", h);
    return () => window.removeEventListener("umoja:win-streak", h);
  }, []);

  // On login: check signup_bonus + daily milestones
  useEffect(() => {
    if (!user || checked) return;
    setChecked(true);
    (async () => {
      const [claims, member] = await Promise.all([
        supabase
          .from("free_spark_claims")
          .select("claim_type, claimed_at")
          .eq("member_id", user.id),
        supabase.from("members").select("streak_count").eq("id", user.id).maybeSingle(),
      ]);
      const have = new Set((claims.data ?? []).map((c) => c.claim_type));
      const streak = Number(member.data?.streak_count ?? 0);

      // Priority: signup -> highest unclaimed milestone
      if (!have.has("signup_bonus")) {
        open({
          type: "signup_bonus",
          title: "🎁 Welcome bonus!",
          body: "You've unlocked 50 free sparks. Try any game right now — valid for 30 days.",
          sparks: 50,
          cta: "Claim 50 ⚡",
        });
        return;
      }
      const milestone: ClaimType | null =
        streak >= 30 && !have.has("daily_30") ? "daily_30"
        : streak >= 7 && !have.has("daily_7") ? "daily_7"
        : streak >= 3 && !have.has("daily_3") ? "daily_3"
        : null;
      if (!milestone) return;
      const cfg: Record<string, { title: string; body: string; sparks: number }> = {
        daily_3:  { title: "3-Day Streak! 🔥",  body: "Bonus: +10 sparks. Keep the streak up!",  sparks: 10 },
        daily_7:  { title: "Week Warrior! 🎖️", body: "Bonus: +15 sparks. You're hooked!",       sparks: 15 },
        daily_30: { title: "Legend! ⚡",         body: "Bonus: +50 sparks for 30 days strong!",  sparks: 50 },
      };
      const m = cfg[milestone];
      open({
        type: milestone,
        title: m.title,
        body: m.body,
        sparks: m.sparks,
        cta: `Claim ${m.sparks} ⚡`,
      });
    })();
  }, [user, checked]);

  // Skip auth pages
  if (loc.pathname.startsWith("/login") || loc.pathname.startsWith("/signup")) return null;

  const close = () => setActive(null);

  const claim = async () => {
    if (!active || active.type === "out_of_sparks") return close();
    const { data, error } = await supabase.rpc("claim_free_sparks", { _claim_type: active.type });
    if (error) { toast.error(error.message); return close(); }
    const r = data as any;
    if (r?.ok) toast.success(`+${r.sparks_awarded} ⚡ added to your wallet!`);
    else toast.info("Bonus already claimed");
    close();
  };

  if (!active) return null;
  const Icon = active.type === "signup_bonus" ? Gift
    : active.type === "streak_5" ? Trophy
    : active.type === "out_of_sparks" ? Sparkles
    : Flame;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-sm rounded-3xl border-amber-500/30 bg-gradient-to-br from-amber-950/60 to-background">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/20 text-amber-300 mb-2">
            <Icon className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl">{active.title}</DialogTitle>
          {active.sparks ? (
            <p className="text-3xl font-display text-gradient-gold">+{active.sparks} ⚡</p>
          ) : null}
          <DialogDescription className="text-center">{active.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {active.type === "out_of_sparks" ? (
            <>
              <Button className="w-full" onClick={() => { active.onCta?.(); close(); }}>
                {active.cta}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { navigate("/daily-questions"); close(); }}>
                Try free games instead
              </Button>
            </>
          ) : (
            <>
              <Button className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 border-0" onClick={claim}>
                {active.cta ?? "Claim"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={close}>Maybe later</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
