import { Link } from "react-router-dom";
import { ContactModal } from "@/components/umoja/ContactModal";
import { WHATSAPP_GROUP_URL } from "@/components/umoja/WhatsAppCommunity";

export const SiteFooter = () => (
  <footer className="border-t border-border/60 mt-12 px-5 py-8">
    <div className="mx-auto max-w-6xl flex flex-col gap-6 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p>© {new Date().getFullYear()} UMOJA. Community Wealth Platform.</p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">Serving members across Africa · HQ: Johannesburg, South Africa</p>
      </div>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:flex sm:gap-8">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">Community</p>
          <nav className="flex flex-col gap-1.5">
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-smooth"
            >
              WhatsApp Community
            </a>
            <Link to="/referrals" className="hover:text-foreground transition-smooth">Referrals</Link>
            <Link to="/community" className="hover:text-foreground transition-smooth">Leaderboard</Link>
          </nav>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">Company</p>
          <nav className="flex flex-col gap-1.5">
            <Link to="/blog" className="hover:text-foreground transition-smooth">Latest Updates</Link>
            <Link to="/terms" className="hover:text-foreground transition-smooth">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground transition-smooth">Privacy</Link>
            <ContactModal
              trigger={
                <button type="button" className="text-left hover:text-foreground transition-smooth">
                  Contact Us
                </button>
              }
            />
          </nav>
        </div>
      </div>
    </div>
  </footer>
);
