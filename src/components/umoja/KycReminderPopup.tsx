import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SNOOZE_KEY = "umoja_kyc_reminder_snoozed_until";
const SHOWN_KEY = "umoja_kyc_reminder_shown_session";

export function KycReminderPopup() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    // Don't pester on the KYC page itself
    if (loc.pathname.startsWith("/kyc")) return;
    // Only once per session
    if (sessionStorage.getItem(SHOWN_KEY)) return;
    // Honor snooze
    const snoozed = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (snoozed && Date.now() < snoozed) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("kyc_level")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const lvl = data?.kyc_level ?? 0;
      setLevel(lvl);
      if (lvl < 3) {
        // Small delay so we don't fight other popups mounting
        setTimeout(() => {
          if (cancelled) return;
          // Defer if another popup is already open
          if (document.querySelector('[data-state="open"][role="dialog"]')) {
            // Try again later
            const retry = setInterval(() => {
              if (!document.querySelector('[data-state="open"][role="dialog"]')) {
                clearInterval(retry);
                show();
              }
            }, 2000);
            setTimeout(() => clearInterval(retry), 60000);
            return;
          }
          show();
        }, 4000);
      }
    })();

    function show() {
      sessionStorage.setItem(SHOWN_KEY, "1");
      setOpen(true);
      window.dispatchEvent(new CustomEvent("umoja:popup-open"));
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loc.pathname]);

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) window.dispatchEvent(new CustomEvent("umoja:popup-close"));
  };

  const remindLater = () => {
    // Snooze 24h
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    handleOpenChange(false);
  };

  const goToKyc = () => {
    handleOpenChange(false);
    nav("/kyc");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10">
            <ShieldAlert className="h-6 w-6 text-accent" />
          </div>
          <DialogTitle className="text-center">Finish your verification</DialogTitle>
          <DialogDescription className="text-center">
            You're on Level {level ?? 0} of 3. Complete KYC to unlock payouts, withdrawals, and full circle access.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={remindLater} className="rounded-2xl">
            Remind me later
          </Button>
          <Button onClick={goToKyc} className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            Complete KYC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
