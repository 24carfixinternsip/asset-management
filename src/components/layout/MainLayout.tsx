import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card/90 px-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:h-16 sm:gap-4 sm:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" aria-label="Toggle menu" />
            {title && (
              <h1 className="text-base font-semibold text-foreground line-clamp-1 sm:text-xl">{title}</h1>
            )}
          </header>
          <main className="flex-1 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6">
            <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
