import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MemberSidebar } from "@/components/umoja/MemberSidebar";
import { ProductTour } from "@/components/umoja/ProductTour";
import { TourBanner } from "@/components/umoja/TourBanner";
import { WhatsAppFab } from "@/components/umoja/WhatsAppCommunity";
import { FreeSparkPopups } from "@/components/umoja/FreeSparkPopups";
import { useTourControl } from "@/hooks/useTourControl";

export default function MemberLayout() {
  useTourControl();
  return (
    <SidebarProvider defaultOpen>
      <ProductTour />
      <div className="min-h-screen flex w-full">
        {/* Desktop sidebar only */}
        <div className="hidden md:block">
          <MemberSidebar />
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="hidden md:flex h-12 items-center border-b border-border px-3 sticky top-0 z-30 bg-background/80 backdrop-blur">
            <SidebarTrigger />
          </header>
          <main className="flex-1 min-w-0">
            <TourBanner />
            <Outlet />
          </main>
        </div>
        <WhatsAppFab source="member" />
        <FreeSparkPopups />
      </div>
    </SidebarProvider>
  );
}
