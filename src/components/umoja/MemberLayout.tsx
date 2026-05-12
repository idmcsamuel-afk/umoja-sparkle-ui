import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MemberSidebar } from "@/components/umoja/MemberSidebar";

export default function MemberLayout() {
  return (
    <SidebarProvider defaultOpen>
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
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
