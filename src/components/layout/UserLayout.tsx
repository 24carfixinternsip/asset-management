import { ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, LayoutGrid, LogOut, Package, ShoppingCart, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface UserLayoutProps {
  cartCount: number;
  onOpenCart: () => void;
  children?: ReactNode;
}

export function UserLayout({ cartCount, onOpenCart, children }: UserLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: employee, isLoading } = useCurrentEmployee();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/65">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/portal" className="flex items-center gap-2" aria-label="Go to portal home">
            <div className="rounded-lg bg-[#F15A24] p-2 shadow-sm">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-none text-slate-800">
                <span className="text-[#F15A24]">24</span>CAR<span className="text-[#F15A24]">FIX</span>
              </span>
              <span className="text-[10px] tracking-wider text-muted-foreground">PORTAL SYSTEM</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 p-1 md:flex">
              <Button
                variant="ghost"
                asChild
                size="sm"
                className={cn(
                  "rounded-full px-3 text-slate-600 hover:bg-orange-50 hover:text-[#F15A24]",
                  location.pathname === "/portal" && "bg-orange-50 text-[#F15A24]",
                )}
              >
                <Link to="/portal">
                  <LayoutGrid className="mr-1.5 h-4 w-4" />
                  Catalog
                </Link>
              </Button>
              <Button
                variant="ghost"
                asChild
                size="sm"
                className={cn(
                  "rounded-full px-3 text-slate-600 hover:bg-orange-50 hover:text-[#F15A24]",
                  location.pathname.startsWith("/portal/history") && "bg-orange-50 text-[#F15A24]",
                )}
              >
                <Link to="/portal/history">
                  <ClipboardList className="mr-1.5 h-4 w-4" />
                  History
                </Link>
              </Button>
            </div>

            {!isLoading && employee ? (
              <div className="hidden items-center gap-3 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 transition-all hover:bg-white md:flex">
                <Avatar className="h-8 w-8 border bg-white">
                  <AvatarImage src={employee.image_url || undefined} className="object-cover" />
                  <AvatarFallback className="bg-[#F15A24]/10 text-[#F15A24]">
                    {employee.name ? employee.name.substring(0, 2).toUpperCase() : <UserIcon className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="mr-1 flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-700">{employee.name}</span>
                  <span className="text-[10px] text-muted-foreground">{employee.email || "No Email"}</span>
                </div>
              </div>
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              asChild
              className={cn(
                "text-slate-600 hover:bg-[#F15A24]/5 hover:text-[#F15A24] sm:hidden",
                location.pathname.startsWith("/portal/history") && "bg-[#F15A24]/10 text-[#F15A24]",
              )}
            >
              <Link to="/portal/history" aria-label="Open borrow history">
                <ClipboardList className="h-5 w-5" />
              </Link>
            </Button>

            <Button
              onClick={onOpenCart}
              className="relative border-0 bg-gradient-to-r from-[#F15A24] to-[#ff7a2f] text-white shadow-sm transition-all active:scale-95 hover:from-[#dd4f1a] hover:to-[#ef6c24]"
              aria-label={`Open cart (${cartCount} items)`}
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 ? (
                <Badge variant="secondary" className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-white shadow-sm">
                  {cartCount}
                </Badge>
              ) : null}
            </Button>

            <div className="mx-1 h-6 w-px bg-slate-200" />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-500"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:py-8">
        {children || <Outlet />}
      </main>
    </div>
  );
}
