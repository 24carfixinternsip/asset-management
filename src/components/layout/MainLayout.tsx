import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Package, Settings, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navItems = [
    { label: "Products", to: "/products", icon: Package },
    { label: "Transactions", to: "/transactions", icon: ShoppingCart },
    { label: "System Settings", to: "/settings", icon: Settings },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card/90 px-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:h-16 sm:gap-4 sm:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" aria-label="Toggle menu" />
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {title && (
                <h1 className="text-base font-semibold text-foreground line-clamp-1 sm:text-xl">
                  {title}
                </h1>
              )}
              <nav
                aria-label="Primary"
                className="ml-auto flex items-center gap-2 overflow-x-auto pb-1"
              >
                {navItems.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Button
                      key={item.to}
                      asChild
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className={cn(
                        "h-9 whitespace-nowrap rounded-full px-3 text-xs sm:text-sm",
                        active ? "shadow-sm" : "bg-transparent"
                      )}
                    >
                      <Link to={item.to}>
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}
              </nav>
            </div>
          </header>
          <main className="flex-1 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6">
            <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
