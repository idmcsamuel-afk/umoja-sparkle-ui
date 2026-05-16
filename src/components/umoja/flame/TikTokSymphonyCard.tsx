import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const SYMPHONY_URL = "https://ads.tiktok.com/business/creativecenter/tools/tiktok-symphony/pc/en";

export function TikTokSymphonyCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-amber-500/20 bg-card/80 backdrop-blur p-4 flex flex-col h-full">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎬</span>
          <h3 className="font-display text-base text-amber-200">TikTok Symphony Studio</h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Professional AI-powered video generation. Create TikTok-ready content with avatars, dubbing, and effects.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-foreground/85 flex-1">
          <li>✅ AI avatars &amp; digital spokespeople</li>
          <li>✅ Multi-language dubbing</li>
          <li>✅ Product URL → video conversion</li>
          <li>✅ TikTok-optimized editing</li>
        </ul>
        <Button
          onClick={() => setOpen(true)}
          className="mt-4 w-full bg-gradient-to-r from-emerald-600 to-amber-500 text-black border-0 font-semibold"
        >
          Open Symphony Studio →
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">🎬 TikTok Symphony</DialogTitle>
            <DialogDescription>A free tool from TikTok — here&apos;s how to use it</DialogDescription>
          </DialogHeader>
          <ol className="space-y-2 text-sm text-foreground/90 list-decimal pl-5">
            <li>Click <b>Continue to Symphony</b> below.</li>
            <li>Login with your TikTok Business account (free to create).</li>
            <li>Create your video using AI tools.</li>
            <li>Download and upload to UMOJA Creative Library.</li>
          </ol>
          <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3 text-[11px] text-amber-100">
            Symphony opens in a new tab — your UMOJA session stays put.
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-gradient-to-r from-emerald-600 to-amber-500 text-black border-0 font-semibold"
              onClick={() => {
                window.open(SYMPHONY_URL, "_blank", "noopener,noreferrer");
                setOpen(false);
              }}
            >
              Continue to Symphony <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
