import { Link } from "react-router-dom";

export const SiteFooter = () => (
  <footer className="border-t border-border/60 mt-12 px-5 py-8">
    <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
      <p>© {new Date().getFullYear()} UMOJA. Community Wealth Platform.</p>
      <nav className="flex items-center gap-5">
        <Link to="/terms" className="hover:text-foreground transition-smooth">Terms</Link>
        <Link to="/privacy" className="hover:text-foreground transition-smooth">Privacy</Link>
        <Link to="/contact" className="hover:text-foreground transition-smooth">Contact</Link>
      </nav>
    </div>
  </footer>
);
