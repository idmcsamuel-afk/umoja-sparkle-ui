import { Info } from "lucide-react";

export const SparksDisclaimer = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-2xl glass p-4 text-xs text-muted-foreground leading-relaxed flex gap-3 ${className}`}>
    <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
    <p>
      Sparks are UMOJA community reward points. They cannot be directly redeemed for cash
      but may be traded peer-to-peer on the Spark Exchange at member-agreed rates.
    </p>
  </div>
);

export default SparksDisclaimer;
