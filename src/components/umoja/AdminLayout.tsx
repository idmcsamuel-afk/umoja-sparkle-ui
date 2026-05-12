import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard, Users, Coins, ShoppingBag, Car, TrendingUp, Wallet, ArrowLeft, ShieldCheck, Ticket, Gift, Settings, Trophy, Mail, Crown, Rocket, Building2,
} from "lucide-react";
import { Logo } from "@/components/umoja/Logo";
import { ThemeToggle } from "@/components/umoja/ThemeToggle";

const items = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/members", label: "Members", icon: Users },
  { to: "/admin/circles", label: "Circles", icon: Coins },
  { to: "/admin/allocations", label: "Allocations", icon: Trophy },
  { to: "/admin/spark-trade", label: "Spark Trade", icon: ShoppingBag },
  { to: "/admin/buyers-club", label: "Buyers Club", icon: Crown },
  { to: "/admin/fulfillment", label: "Fulfillment", icon: Rocket },
  { to: "/admin/properties", label: "Properties", icon: Building2 },
  { to: "/admin/drive", label: "Drive", icon: Car },
  { to: "/admin/predictor", label: "Predictor", icon: TrendingUp },
  { to: "/admin/kyc-review", label: "KYC review", icon: ShieldCheck },
  { to: "/admin/payouts", label: "Payouts", icon: Wallet },
  { to: "/admin/invites", label: "Invites", icon: Ticket },
  { to: "/admin/referrals", label: "Referrals", icon: Gift },
  { to: "/admin/notifications", label: "Notifications", icon: Mail },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Link
        to="/dashboard"
        className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-4 py-2.5 bg-background/95 backdrop-blur border-b border-border text-sm text-foreground"
      >
        <ArrowLeft className="h-4 w-4 text-accent" /> Back to Dashboard
      </Link>
      <aside className="md:w-64 md:min-h-screen md:border-r border-border bg-gradient-card md:sticky md:top-0">
        <div className="flex items-center justify-between p-5">
          <Logo />
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
        <nav className="px-3 pb-4 md:pb-8 overflow-x-auto md:overflow-visible">
          <ul className="flex md:flex-col gap-1 min-w-max md:min-w-0">
            {items.map(({ to, end, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm whitespace-nowrap transition-smooth ${
                      isActive
                        ? "bg-gradient-primary text-primary-foreground shadow-glow"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <Link
            to="/dashboard"
            className="hidden md:flex items-center gap-2 mt-6 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-smooth"
          >
            <ArrowLeft className="h-3 w-3" /> Back to app
          </Link>
        </nav>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-border">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Admin Console</p>
          <ThemeToggle />
        </header>
        <div className="p-5 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
