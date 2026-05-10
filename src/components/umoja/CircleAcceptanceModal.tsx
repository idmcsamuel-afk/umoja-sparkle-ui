import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const KEY = "umoja_circle_accepted";

export const hasAcceptedCircle = () =>
  typeof window !== "undefined" && localStorage.getItem(KEY) === "true";

export function CircleAcceptanceModal({
  onAccept,
}: {
  onAccept?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasAcceptedCircle()) setOpen(true);
  }, []);

  const accept = () => {
    localStorage.setItem(KEY, "true");
    setOpen(false);
    onAccept?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && hasAcceptedCircle()) setOpen(false); }}>
      <DialogContent
        className="rounded-3xl border border-border bg-gradient-card max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary mb-2">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle className="font-display text-2xl">Before you enter the Circle</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            By entering this Circle you confirm that:
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-foreground/90">
          {[
            "UMOJA Circles are community savings pools",
            "Returns shown are targets, not guarantees",
            "Past performance does not predict future results",
            "This is not a regulated investment product",
            "You are participating voluntarily as a community member",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-accent">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => { window.history.back(); }}
            className="rounded-2xl"
          >
            Cancel
          </Button>
          <Button
            onClick={accept}
            className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
          >
            I Accept — Enter Circle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CircleAcceptanceModal;
