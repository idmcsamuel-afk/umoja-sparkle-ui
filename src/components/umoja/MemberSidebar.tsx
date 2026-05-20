import { NavLink, useLocation } from "react-router-dom";
import {
  Home, Users, Sparkles, Store, ArrowLeftRight, Car, Building2, Gamepad2,
  Trophy, Palette, Gift, Calculator as CalcIcon, User as UserIcon, ShieldCheck, BookOpen, MessageCircle, Flame, Video, BarChart3, Wand2,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/umoja/Logo";
import { restartProductTour } from "@/components/umoja/ProductTour";

const main = [
  { to: "/dashboard", label: "Home", icon: Home, tour: "dashboard" },
  { to: "/circle", label: "Circle", icon: Users, tour: "circle" },
  { to: "/creator-studio", label: "Creator Studio", icon: Wand2 },
  { to: "/community", label: "Community", icon: MessageCircle },
  { to: "/priority", label: "Priority Queue", icon: Trophy },
  { to: "/spark", label: "Spark Trade", icon: Sparkles, tour: "spark-trade" },
  { to: "/trending", label: "Trending 🔥", icon: Flame },
  { to: "/market", label: "Market", icon: Store },
  { to: "/exchange", label: "Exchange", icon: ArrowLeftRight },
  { to: "/drive", label: "Drive", icon: Car, tour: "drive" },
  { to: "/property", label: "Property Fund", icon: Building2, tour: "property" },
  { to: "/spark-pit", label: "Spark Pit", icon: Gamepad2 },
];

const tools = [
  { to: "/flame-marketing", label: "Create Marketing", icon: Palette },
  { to: "/browse-videos", label: "🎬 Browse Videos", icon: Video },
  { to: "/upload-video", label: "📹 Upload & Earn 200", icon: Sparkles },
  { to: "/my-videos", label: "📊 My Videos", icon: BarChart3 },
  { to: "/blog", label: "Blog", icon: BookOpen },
  { to: "/calculator", label: "Calculator", icon: CalcIcon },
  { to: "/referrals", label: "Invite Friends", icon: Gift, tour: "referrals" },
  { to: "/kyc", label: "Verification", icon: ShieldCheck },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

export function MemberSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (path: string) =>
    path === "/dashboard" ? pathname === path : pathname === path || pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        {!collapsed ? <Logo /> : <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground font-display">U</div>}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Main</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.to} data-tour={item.tour}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                    <NavLink to={item.to} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Tools</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {tools.map((item) => (
                <SidebarMenuItem key={item.to} data-tour={item.tour}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                    <NavLink to={item.to} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 py-3 text-[10px] text-muted-foreground space-y-2">
        <button
          type="button"
          onClick={restartProductTour}
          className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent/10 hover:text-accent transition-colors"
          aria-label="Restart product tour"
        >
          <span>🎯</span>
          {!collapsed && <span>Restart Tour</span>}
        </button>
        {!collapsed && <span>Umoja Rise</span>}
      </SidebarFooter>
    </Sidebar>
  );
}
