import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Home, Users, Sparkles, Car, Store, ArrowLeftRight, Gamepad2, Gift, Palette, ChevronRight, ChevronLeft, Trophy, Building2, MessageCircle, Flame } from "lucide-react";

const items: { to: string; label: string; icon: typeof Home; tour?: string }[] = [
  { to: "/dashboard", label: "Home", icon: Home, tour: "dashboard" },
  { to: "/community", label: "Chat", icon: MessageCircle, tour: "community" },
  { to: "/trending", label: "Trending", icon: Flame },
  { to: "/circle", label: "Circle", icon: Users, tour: "circle" },
  { to: "/spark", label: "Spark", icon: Sparkles, tour: "spark-trade" },
  { to: "/priority", label: "Queue", icon: Trophy },
  { to: "/market", label: "Market", icon: Store },
  { to: "/flame-marketing", label: "Create 🎨", icon: Palette },
  { to: "/exchange", label: "Swap", icon: ArrowLeftRight },
  { to: "/drive", label: "Drive", icon: Car, tour: "drive" },
  { to: "/property", label: "Property", icon: Building2, tour: "property" },
  { to: "/spark-pit", label: "Pit", icon: Gamepad2 },
  { to: "/referrals", label: "Invite", icon: Gift, tour: "referrals" },
];

const HINT_KEY = "umoja_bottomnav_hint_seen";

export const BottomNav = () => {
  const { pathname } = useLocation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const updateEdges = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, []);

  // First-visit hint
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(HINT_KEY)) return;
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 4) return;
    setShowHint(true);
    // gentle nudge
    const t1 = setTimeout(() => el.scrollTo({ left: 40, behavior: "smooth" }), 300);
    const t2 = setTimeout(() => el.scrollTo({ left: 0, behavior: "smooth" }), 1100);
    const t3 = setTimeout(() => {
      setShowHint(false);
      localStorage.setItem(HINT_KEY, "1");
    }, 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="relative mx-auto max-w-lg">
        <div className="glass rounded-3xl px-1.5 py-2 shadow-soft overflow-hidden">
          <div
            ref={scrollerRef}
            role="toolbar"
            aria-label="Primary navigation"
            onKeyDown={(e) => {
              const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
              if (!keys.includes(e.key)) return;
              const links = Array.from(
                scrollerRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-nav-item]") ?? []
              );
              if (!links.length) return;
              const currentIdx = links.findIndex((l) => l === document.activeElement);
              let nextIdx = currentIdx;
              if (e.key === "ArrowRight") nextIdx = currentIdx < 0 ? 0 : Math.min(links.length - 1, currentIdx + 1);
              if (e.key === "ArrowLeft") nextIdx = currentIdx < 0 ? 0 : Math.max(0, currentIdx - 1);
              if (e.key === "Home") nextIdx = 0;
              if (e.key === "End") nextIdx = links.length - 1;
              if (nextIdx === currentIdx && currentIdx >= 0) return;
              e.preventDefault();
              const target = links[nextIdx < 0 ? 0 : nextIdx];
              target.focus();
              target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            }}
            className="overflow-x-auto no-scrollbar"
            style={{ scrollSnapType: "x mandatory" }}
          >
            <ul className="flex gap-0.5 min-w-max">
              {items.map(({ to, label, icon: Icon, tour }) => {
                const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
                return (
                  <li
                    key={to}
                    data-tour={tour}
                    className="flex-1 min-w-[56px]"
                    style={{ scrollSnapAlign: "start" }}
                  >
                    <Link
                      to={to}
                      data-nav-item
                      aria-label={label}
                      aria-current={active ? "page" : undefined}
                      className="group flex flex-col items-center gap-1 py-2 transition-smooth rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-2xl transition-smooth ${
                          active
                            ? "bg-gradient-primary text-primary-foreground shadow-glow"
                            : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-[16px] w-[16px]" strokeWidth={2.2} />
                      </span>
                      <span className={`text-[10px] font-medium tracking-wide whitespace-nowrap ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Left edge fade + chevron */}
        <div
          aria-hidden
          className={`pointer-events-none absolute left-0 top-0 h-full w-10 rounded-l-3xl transition-opacity duration-300 ${
            canLeft ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "linear-gradient(to right, hsl(var(--background) / 0.85), hsl(var(--background) / 0))",
          }}
        />
        <ChevronLeft
          aria-hidden
          className={`pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 h-4 w-4 text-accent transition-opacity duration-300 ${
            canLeft ? "opacity-90 animate-pulse" : "opacity-0"
          }`}
        />

        {/* Right edge fade + chevron */}
        <div
          aria-hidden
          className={`pointer-events-none absolute right-0 top-0 h-full w-12 rounded-r-3xl transition-opacity duration-300 ${
            canRight ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "linear-gradient(to left, hsl(var(--background) / 0.9), hsl(var(--background) / 0))",
          }}
        />
        <ChevronRight
          aria-hidden
          className={`pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 text-accent transition-opacity duration-300 ${
            canRight ? "opacity-90 animate-pulse" : "opacity-0"
          }`}
        />

        {/* First-visit hint */}
        {showHint && (
          <div className="pointer-events-none absolute -top-7 inset-x-0 flex justify-center">
            <span className="glass rounded-full px-3 py-1 text-[10px] font-medium text-accent shadow-soft animate-fade-in">
              ← Swipe for more →
            </span>
          </div>
        )}
      </div>
    </nav>
  );
};
