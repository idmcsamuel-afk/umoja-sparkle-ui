import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";

export const SPARK_TRADE_SUB_ITEMS: { to: string; label: string; emoji: string; key?: string }[] = [
  { to: "/spark-trade/membership", label: "Group Buy", emoji: "👥" },
  { to: "/spark-trade/onboarding/income-goal", label: "AI Income Builder", emoji: "💡" },
  { to: "/spark-trade/onboarding/income-goal", label: "Spark Trade Intelligence", emoji: "📊", key: "intel" },
];

function isSparkPath(pathname: string) {
  return pathname.startsWith("/spark-trade") || pathname === "/spark";
}

/** Desktop sidebar version of the expandable Spark Trade menu. */
export function SparkTradeSidebarMenu() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => isSparkPath(pathname));

  // Auto-collapse when navigating to a non-spark route
  useEffect(() => {
    if (!isSparkPath(pathname)) setOpen(false);
    else setOpen(true);
  }, [pathname]);

  const active = isSparkPath(pathname);

  return (
    <>
      <SidebarMenuItem data-tour="spark-trade">
        <SidebarMenuButton
          onClick={() => setOpen((v) => !v)}
          isActive={active}
          tooltip="Spark Trade"
          aria-expanded={open}
          className="min-h-[44px]"
        >
          <Sparkles className="h-4 w-4" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Spark Trade</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              />
            </>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
      {!collapsed && (
        <div
          className="grid transition-all duration-300 ease-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <SidebarMenuSub>
              {SPARK_TRADE_SUB_ITEMS.map((item) => (
                <SidebarMenuSubItem key={item.key ?? item.label}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={pathname === item.to}
                    className="min-h-[40px]"
                  >
                    <NavLink to={item.to} className="flex items-center gap-2">
                      <span aria-hidden>{item.emoji}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </div>
        </div>
      )}
    </>
  );
}
