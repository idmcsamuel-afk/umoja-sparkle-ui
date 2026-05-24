import { MessageCircle } from "lucide-react";
import { ttTrack } from "@/lib/tiktokPixel";

export const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/LIzQkAMrciL5uL3KOdDili";

const trackJoin = (source: string) => {
  try { ttTrack("Contact", { content_name: "whatsapp_group", source }); } catch {}
};

type Variant = "section" | "compact";

export function WhatsAppCommunity({
  variant = "section",
  source = "unknown",
  heading = "Join Our WhatsApp Community",
  subheading = "Connect with 6,000+ members",
}: {
  variant?: Variant;
  source?: string;
  heading?: string;
  subheading?: string;
}) {
  if (variant === "compact") {
    return (
      <a
        href={WHATSAPP_GROUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackJoin(source)}
        className="flex items-center justify-between gap-3 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/[0.08] px-4 py-3 transition-smooth hover:bg-[#25D366]/[0.14]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{heading}</p>
            <p className="text-xs text-muted-foreground">{subheading}</p>
          </div>
        </div>
        <span className="text-xs font-medium text-[#25D366]">Join →</span>
      </a>
    );
  }

  return (
    <section className="px-5 pb-8">
      <div className="mx-auto max-w-md rounded-3xl border border-[#25D366]/30 bg-[#25D366]/[0.06] p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="h-6 w-6" />
          </span>
          <div>
            <h3 className="font-display text-xl text-foreground">{heading}</h3>
            <p className="text-xs text-muted-foreground">{subheading}</p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-foreground/85">
          <li>• Get Circle opening alerts</li>
          <li>• Ask questions and get support</li>
          <li>• Share success stories</li>
          <li>• Network with other members</li>
        </ul>
        <a
          href={WHATSAPP_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackJoin(source)}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 font-medium text-white shadow-md transition-smooth hover:bg-[#1ebe57]"
        >
          <MessageCircle className="h-5 w-5" />
          Join WhatsApp Group →
        </a>
      </div>
    </section>
  );
}

export function WhatsAppFab({ source = "fab" }: { source?: string }) {
  return (
    <a
      href={WHATSAPP_GROUP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => { try { ttTrack("Contact", { content_name: "whatsapp_group", source }); } catch {} }}
      aria-label="Join WhatsApp Community"
      title="Join Community"
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl ring-4 ring-[#25D366]/20 transition-transform hover:scale-105 md:bottom-6 md:right-6"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
