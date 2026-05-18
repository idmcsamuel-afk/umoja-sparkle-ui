import { useState } from "react";
import { Info, Lock, Plus, ChevronDown, Sparkles, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CircleSessionTimer } from "@/components/umoja/CircleSessionTimer";
import { cn } from "@/lib/utils";

interface Tier {
  tier: string;
  min_entry: number;
  max_entry: number;
  growth_rate: number;
  vault_days: number;
  is_active: boolean | null;
}

interface Props {
  tier: Tier;
  pool: number;
  members: number;
  target: number;
  myTotal: number;
  sessionOpen: boolean;
  sessionLabel: string | null;
  delayMs?: number;
  onBidMin: () => void;
  onBidMax: () => void;
  payoutsThisWeek?: number;
  liveBidders?: number;
}

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");
const TIER_EMOJI: Record<string, string> = { seed: "🌱", growth: "🌿", harvest: "🌾" };

/** Net return after 5% fees applied to GROSS payout (contribution + return). */
function computeReturns(contribution: number, grossRate: number) {
  const gross = contribution * (1 + grossRate);
  const fees = gross * 0.05;
  const platformFee = gross * 0.02;
  const ubuntuFee = gross * 0.03;
  const net = gross - fees;
  const profit = net - contribution;
  const netPct = contribution > 0 ? (profit / contribution) * 100 : 0;
  return { gross, fees, platformFee, ubuntuFee, net, profit, netPct };
}

function netRatePct(grossRate: number) {
  return Math.round(((1 + grossRate) * 0.95 - 1) * 1000) / 10;
}

function PayoutBreakdownPopover({
  contribution,
  grossRate,
}: {
  contribution: number;
  grossRate: number;
}) {
  const r = computeReturns(contribution, grossRate);
  const grossPct = Math.round(grossRate * 100);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Show payout breakdown"
          className="inline-grid place-items-center h-5 w-5 rounded-full bg-background/60 text-muted-foreground hover:text-foreground transition-smooth"
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs rounded-2xl text-sm">
        <p className="font-display text-base">Payout breakdown</p>
        <div className="mt-3 space-y-1.5">
          <Row label="Your contribution" value={fmtR(contribution)} />
          <Row label={`Circle return (+${grossPct}%)`} value={`+${fmtR(contribution * grossRate)}`} />
          <div className="flex justify-between border-t border-border pt-1.5 text-foreground">
            <span>Subtotal</span>
            <span className="font-medium">{fmtR(r.gross)}</span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fees</p>
          <Row label="Platform fee (2%)" value={`-${fmtR(r.platformFee)}`} />
          <Row label="Ubuntu fund (3%)" value={`-${fmtR(r.ubuntuFee)}`} />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total fees (5%)</span>
            <span className="text-muted-foreground">-{fmtR(r.fees)}</span>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-secondary/60 p-2.5 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You receive</span>
            <span className="font-display text-gradient-gold">{fmtR(r.net)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Net profit</span>
            <span className="text-emerald-400 font-medium">
              +{fmtR(r.profit)} (+{r.netPct.toFixed(1)}%)
            </span>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground leading-snug">
          ℹ️ Ubuntu fund supports community initiatives and member welfare.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", accent ? "text-emerald-400" : "text-foreground")}>{value}</span>
    </div>
  );
}

function WhyFeesAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/60 transition-smooth">
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3 w-3" /> Why fees?
        </span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="mt-2 space-y-3 rounded-xl border border-border bg-secondary/20 p-3 text-xs">
          <div>
            <p className="font-medium text-foreground">Platform fee (2%)</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground list-disc list-inside">
              <li>Secure payment processing</li>
              <li>Platform maintenance &amp; support</li>
              <li>Technology infrastructure</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Ubuntu fund (3%)</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground list-disc list-inside">
              <li>Community welfare programs</li>
              <li>Emergency member assistance</li>
              <li>Educational workshops</li>
              <li>Network growth initiatives</li>
            </ul>
          </div>
          <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
            Total: 5% (deducted from gross payout)
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CircleTierCard({
  tier,
  pool,
  members,
  target,
  myTotal,
  sessionOpen,
  sessionLabel,
  delayMs = 0,
  onBidMin,
  onBidMax,
  payoutsThisWeek = 0,
  liveBidders = 0,
}: Props) {
  const locked = !tier.is_active;
  const disabled = locked || !sessionOpen;
  const grossRate = Number(tier.growth_rate) || 0;
  const grossPct = Math.round(grossRate * 100);
  const netPct = netRatePct(grossRate);
  const pct = Math.min(100, Math.round((pool / Math.max(1, target)) * 100));
  const niceName = `${tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)} Circle`;
  const emoji = TIER_EMOJI[tier.tier] ?? "✦";

  const my = myTotal > 0 ? computeReturns(myTotal, grossRate) : null;

  return (
    <article
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        "group relative overflow-hidden rounded-3xl glass p-5 animate-slide-up transition-all",
        locked && "opacity-80",
        !locked && sessionOpen &&
          "border-2 border-emerald-500/70 shadow-[0_0_40px_rgba(16,185,129,0.35)] bg-emerald-500/[0.04] animate-pulse-glow",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl">
            <span className="mr-1.5">{emoji}</span>
            {niceName}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-accent">
            ⏱️ {tier.vault_days}-Day Cycle · Earn +{grossPct}%
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            +{netPct}% net after 5% fees · {fmtR(tier.min_entry)}–{fmtR(tier.max_entry)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full px-2 py-1",
              locked
                ? "bg-muted text-muted-foreground"
                : sessionOpen
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-primary/15 text-primary",
            )}
          >
            {locked ? (
              <><Lock className="h-3 w-3" /> Locked</>
            ) : sessionOpen ? (
              <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active</>
            ) : (
              "Resting"
            )}
          </span>
        </div>
      </div>

      {/* Your participation */}
      {my && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-accent inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Your participation
          </p>
          <Row label="You contributed" value={fmtR(myTotal)} />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground inline-flex items-center gap-1">
              You'll receive <PayoutBreakdownPopover contribution={myTotal} grossRate={grossRate} />
            </span>
            <span className="font-display text-gradient-gold">{fmtR(my.net)}</span>
          </div>
          <Row
            label="Your profit"
            value={`+${fmtR(my.profit)} (+${my.netPct.toFixed(1)}% net)`}
            accent
          />
        </div>
      )}

      {/* Community pool */}
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          📊 Community pool
        </p>
        <div className="mt-1 flex items-baseline justify-between text-xs">
          <span className="text-foreground font-medium">
            {fmtR(pool)} <span className="text-muted-foreground font-normal">of {fmtR(target)}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" /> {members} member{members === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-gold transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[10px] text-muted-foreground">{pct}% of target</p>
      </div>

      {/* Session timer */}
      <div className="mt-4">
        <CircleSessionTimer tier={tier.tier} />
      </div>

      {sessionLabel && !locked && (
        <p
          className={cn(
            "mt-3 text-[11px] text-center font-medium",
            sessionOpen ? "text-primary" : "text-destructive",
          )}
        >
          {sessionLabel}
        </p>
      )}

      {/* CTA */}
      <div className="mt-4 flex gap-2">
        <button
          disabled={disabled}
          onClick={onBidMin}
          className={cn(
            "flex-1 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-12",
            disabled
              ? "bg-secondary text-muted-foreground border border-border"
              : sessionOpen
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_8px_32px_rgba(16,185,129,0.45)] tracking-wide"
                : "bg-gradient-primary text-primary-foreground shadow-glow",
          )}
        >
          {locked ? (
            <><Lock className="h-4 w-4" /> Locked</>
          ) : !sessionOpen ? (
            <><Lock className="h-4 w-4" /> Session closed</>
          ) : (
            <><Plus className="h-4 w-4" /> Bid to Get Paid Today</>
          )}
        </button>
        <button
          disabled={disabled}
          onClick={onBidMax}
          className="min-h-12 px-4 rounded-2xl border border-border text-xs font-medium hover:bg-secondary transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Max
        </button>
      </div>

      <WhyFeesAccordion />
    </article>
  );
}

export default CircleTierCard;
