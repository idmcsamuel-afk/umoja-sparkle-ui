import { Button } from "@/components/ui/button";

export function AvatarVideoCard() {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-card/60 backdrop-blur p-4 flex flex-col h-full opacity-90">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xl">👤</span>
        <h3 className="font-display text-base text-amber-200">AI Avatar Videos</h3>
        <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-semibold text-amber-200 uppercase tracking-wider">
          Coming in Flame Pro
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Generate spokesperson videos with AI avatars narrating your script.
      </p>
      <ul className="mt-3 space-y-1 text-xs text-foreground/70 flex-1">
        <li>🔒 Script → narrated avatar video</li>
        <li>🔒 30+ presenter styles</li>
        <li>🔒 Voice cloning &amp; brand kits</li>
      </ul>
      <Button disabled className="mt-4 w-full" variant="outline">
        Coming Soon
      </Button>
    </div>
  );
}
