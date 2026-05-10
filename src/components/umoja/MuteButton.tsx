import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, toggleMuted } from "@/lib/sounds";

export function MuteButton({ className = "" }: { className?: string }) {
  const [m, setM] = useState(isMuted());
  useEffect(() => {
    const h = () => setM(isMuted());
    window.addEventListener("umoja:mute-change", h);
    return () => window.removeEventListener("umoja:mute-change", h);
  }, []);
  return (
    <button
      onClick={() => { toggleMuted(); setM(isMuted()); }}
      aria-label={m ? "Unmute sounds" : "Mute sounds"}
      className={`grid h-9 w-9 place-items-center rounded-full bg-black/40 border border-amber-500/30 text-amber-200 hover:bg-black/60 ${className}`}
    >
      {m ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
