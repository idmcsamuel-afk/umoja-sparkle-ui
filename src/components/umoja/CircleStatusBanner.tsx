import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function HelpDot() {
  const content = (
    <div className="space-y-2 text-left">
      <p className="font-display text-sm">Circles are open 24/7</p>
      <p className="text-xs text-muted-foreground">
        You can place a bid in any Circle at any time of day. Once you bid, your
        contribution has a pay-by deadline shown as a countdown on your bid —
        pay before it runs out so your bid doesn't expire.
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>
          <span className="text-foreground">EFT</span> — pay within 2 hours of bidding
        </li>
        <li>
          <span className="text-foreground">USDT</span> — pay within 1 hour of bidding
        </li>
      </ul>
    </div>
  );

  return (
    <>
      {/* Desktop: hover tooltip */}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="How do Circle deadlines work?"
              className="hidden md:inline-grid place-items-center h-5 w-5 rounded-full bg-background/40 text-muted-foreground hover:text-foreground transition-smooth"
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{content}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Mobile: tap popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="How do Circle deadlines work?"
            className="md:hidden inline-grid place-items-center h-5 w-5 rounded-full bg-background/40 text-muted-foreground"
          >
            <Info className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-w-xs rounded-2xl">{content}</PopoverContent>
      </Popover>
    </>
  );
}

export function CircleStatusBanner() {
  return (
    <div className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-emerald-400">
          Circles open 24/7 — bid anytime
        </p>
        <HelpDot />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Your pay-by countdown starts when you place a bid.
      </p>
    </div>
  );
}

export default CircleStatusBanner;
