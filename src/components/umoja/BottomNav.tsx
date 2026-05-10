import { Link, useLocation } from "react-router-dom";
import { Home, Users, Sparkles, Car, TrendingUp, Store, ArrowLeftRight } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/circle", label: "Circle", icon: Users },
  { to: "/spark", label: "Spark", icon: Sparkles },
  { to: "/market", label: "Market", icon: Store },
  { to: "/exchange", label: "Swap", icon: ArrowLeftRight },
  { to: "/drive", label: "Drive", icon: Car },
  { to: "/predictor", label: "Predict", icon: TrendingUp },
];

export const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="glass mx-auto max-w-lg rounded-3xl px-1.5 py-2 shadow-soft">
        <ul className="grid grid-cols-7">
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
            return (
              <li key={to}>
                <Link
                  to={to}
                  className="group flex flex-col items-center gap-1 py-2 transition-smooth"
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
                  <span
                    className={`text-[10px] font-medium tracking-wide ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};
