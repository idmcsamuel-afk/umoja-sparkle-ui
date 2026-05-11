import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Home, Users, Sparkles, Car, Store, ArrowLeftRight, Gamepad2, Gift, Palette, ChevronRight, ChevronLeft } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/circle", label: "Circle", icon: Users },
  { to: "/spark", label: "Spark", icon: Sparkles },
  { to: "/market", label: "Market", icon: Store },
  { to: "/flame-marketing", label: "Create 🎨", icon: Palette },
  { to: "/exchange", label: "Swap", icon: ArrowLeftRight },
  { to: "/drive", label: "Drive", icon: Car },
  { to: "/spark-pit", label: "Pit", icon: Gamepad2 },
  { to: "/referrals", label: "Invite", icon: Gift },
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
    <nav className="fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="relative mx-auto max-w-lg">
        <div className="glass rounded-3xl px-1.5 py-2 shadow-soft overflow-hidden">
          <div
            ref={scrollerRef}
            className="overflow-x-auto no-scrollbar"
            style={{ scrollSnapType: "x mandatory" }}
          >
            <ul className="flex gap-0.5 min-w-max">
              {items.map(({ to, label, icon: Icon }) => {
                const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
                return (
                  <li
                    key={to}
                    className="flex-1 min-w-[56px]"
                    style={{ scrollSnapAlign: "start" }}
                  >
                    <Link to={to} className="group flex flex-col items-center gap-1 py-2 transition-smooth">
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
