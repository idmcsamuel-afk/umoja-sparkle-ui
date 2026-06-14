import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const ENTRIES = [
  {
    icon: "🟢",
    title: "Earned Sparks",
    body: "Won in the Spark Pit. Play them again, or cash them out once you've made your first contribution to the community.",
    accent: "border-emerald-500/30 bg-emerald-500/5",
  },
  {
    icon: "🟣",
    title: "Referral Sparks",
    body: "Earned by bringing people into UMOJA. Play them anytime. To cash them out, invest in a Circle — for every R3 you put in, R2 of referral Sparks unlocks. Your contribution does double duty: it works for you inside the Circle and unlocks your Sparks.",
    accent: "border-fuchsia-500/30 bg-fuchsia-500/5",
  },
  {
    icon: "🔵",
    title: "Purchased Sparks",
    body: "Bought with cash. Yours to play or withdraw, anytime — no conditions.",
    accent: "border-blue-500/30 bg-blue-500/5",
  },
  {
    icon: "🟡",
    title: "Promotional Sparks",
    body: "A welcome gift to get you started. Play them in the Spark Pit. They can't be cashed out, and they expire — use them while they're hot.",
    accent: "border-amber-500/30 bg-amber-500/5",
  },
];

export function SparksExplainer({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-left text-[12px] text-muted-foreground transition hover:bg-accent/10"
      >
        <span>
          <b className="text-foreground">Your Sparks, explained</b> — some you can cash out now, some
          unlock when you invest in the community. Tap to see how
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-border/60 bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            How your Sparks work
          </p>
          <ul className="mt-2 space-y-2">
            {ENTRIES.map((e) => (
              <li key={e.title} className={`rounded-lg border p-2.5 ${e.accent}`}>
                <p className="text-xs font-semibold">
                  <span className="mr-1">{e.icon}</span>
                  {e.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{e.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] italic text-muted-foreground">
            One principle holds it all together: we rise together. Cash flows out of UMOJA in step
            with what flows in.
          </p>
        </div>
      )}
    </div>
  );
}

export const BUCKET_TOOLTIPS = {
  earned: "Won in games. Withdrawable once you've contributed to the community.",
  referral:
    "Earned from your referrals. Playable now. Unlocks for cash as you invest in a Circle (R3 in unlocks R2 out).",
  purchased: "Bought with cash. Play or withdraw anytime.",
  promotional:
    "A starter gift. Play in the Spark Pit. Not withdrawable. Expires — use them soon.",
};
