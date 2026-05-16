import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Lock, Crown } from "lucide-react";
import type { FlameTier } from "@/hooks/useFlameTier";

export function AvatarVideoCard({ tier = "free" }: { tier?: FlameTier }) {
  const isPro = tier === "pro";

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-card/80 backdrop-blur p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xl">👤</span>
        <h3 className="font-display text-base text-amber-200">AI Avatar Videos</h3>
        <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-semibold text-amber-200 uppercase tracking-wider">
          R150 per video
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Generate spokesperson videos with AI avatars narrating your script.
      </p>

      {isPro ? (
        <>
          <ul className="mt-3 space-y-1 text-xs text-foreground/85 flex-1">
            <li>✨ 4 presenter styles (M/F · pro &amp; casual)</li>
            <li>✨ Voice presets · 3 languages (EN / AF / ZU)</li>
            <li>✨ Scripts up to 500 chars (~60 sec)</li>
          </ul>
          <div className="mt-3 rounded-xl bg-emerald-500/5 border border-emerald-400/30 p-3 text-[11px] text-emerald-100 space-y-1">
            <div className="flex items-center gap-1 text-emerald-300 font-semibold">
              <Crown className="h-3 w-3" /> Buy Avatar Credits
            </div>
            <div>• R150 per video (one-time)</div>
            <div>• R399/month for 5 videos (save R351)</div>
          </div>
          <Button
            onClick={() => toast({ title: "Launching soon 🚀", description: "Avatar credit packs go live next drop. We'll notify Pro members." })}
            className="mt-3 w-full bg-gradient-to-r from-emerald-600 to-amber-500 text-black border-0 font-semibold"
          >
            Buy Credits →
          </Button>
        </>
      ) : (
        <>
          <div className="mt-3 rounded-xl bg-amber-500/5 border border-amber-400/30 p-3 text-xs text-amber-100 flex-1 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-amber-200">
              <Lock className="h-3.5 w-3.5" /> Flame Pro Required
            </div>
            <p className="text-[11px] text-amber-100/90">
              AI Avatar videos are an add-on for Flame Pro members.
            </p>
            <div className="text-[11px] text-amber-100/80">
              R150 per video · or R399/month for 5
            </div>
          </div>
          <Link to="/spark-trade" className="mt-3 block">
            <Button variant="outline" className="w-full border-amber-400/50 text-amber-200">
              Upgrade to Pro to Unlock
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
