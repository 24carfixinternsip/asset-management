import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Package, Search, Settings, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const isMobile = useIsMobile(1024);
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
        <SidebarInset className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 border-b bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
            <div className="mx-auto flex h-14 items-center gap-3 px-3 sm:h-16 sm:gap-4 sm:px-6 max-w-7xl">
              <SidebarTrigger
                className="h-11 w-11 md:h-9 md:w-9 text-muted-foreground hover:text-foreground"
                aria-label="Toggle menu"
              />
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {title && (
                  <h1 className="text-base font-semibold text-foreground line-clamp-1 sm:text-xl">
                    {title}
                  </h1>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <div className="relative hidden md:flex">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search"
                      className="h-9 w-[220px] rounded-full bg-background/70 pl-9 text-sm"
                      aria-label="Global search"
                    />
                  </div>

                  <nav
                    aria-label="Primary"
                    className="hidden items-center rounded-full border bg-background/70 p-1 lg:flex"
                  >
                    {navItems.map((item) => {
                      const active = isActive(item.to);
                      return (
                        <Button
                          key={item.to}
                          asChild
                          size="sm"
                          variant={active ? "default" : "ghost"}
                          className={cn(
                            "h-8 rounded-full px-3 text-xs sm:text-sm",
                            active ? "shadow-sm" : "text-muted-foreground hover:text-foreground",
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

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 md:h-9 md:w-9 text-muted-foreground hover:text-foreground"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6">
            <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
