import { ReactNode } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Package, LogOut, User as UserIcon, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserLayoutProps {
  cartCount: number;
  onOpenCart: () => void;
  children?: ReactNode;
}

export function UserLayout({ cartCount, onOpenCart, children }: UserLayoutProps) {
  const navigate = useNavigate();
  // เรียกใช้ Hook ที่เราแก้แล้ว
  const { data: employee, isLoading } = useCurrentEmployee(); 

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("ออกจากระบบเรียบร้อย");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo Section */}
          <Link to="/portal" className="flex items-center gap-2">
            <div className="bg-[#F15A24] p-2 rounded-lg shadow-sm">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
                <span className="font-bold text-lg leading-none text-slate-800"><span className="text-[#F15A24]">24</span>CAR<span className="text-[#F15A24]">FIX</span></span>
                <span className="text-[10px] text-muted-foreground tracking-wider">PORTAL SYSTEM</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* User Profile Section */}
            {!isLoading && employee && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-full border transition-all hover:bg-slate-100">
                  <Avatar className="h-8 w-8 border bg-white">
                      {/* ใช้ image_url ได้อย่างสบายใจ เพราะ Type ถูกต้องแล้ว */}
                      <AvatarImage src={employee.image_url || undefined} className="object-cover" />
                      <AvatarFallback className="bg-[#F15A24]/10 text-[#F15A24]">
                          {employee.name ? employee.name.substring(0, 2).toUpperCase() : <UserIcon className="h-4 w-4" />}
                      </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-right mr-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {employee.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {employee.email || 'No Email'}
                      </span>
                  </div>
              </div>
            )}

            {/* History Button */}
            <Button variant="ghost" size="icon" asChild className="sm:hidden text-slate-600 hover:text-[#F15A24] hover:bg-[#F15A24]/5">
              <Link to="/portal/history">
                <ClipboardList className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="ghost" asChild className="hidden sm:inline-flex text-slate-600 hover:text-[#F15A24] hover:bg-[#F15A24]/5">
              <Link to="/portal/history">
                <ClipboardList className="h-5 w-5 mr-2" />
                ประวัติการเบิก
              </Link>
            </Button>
            
            {/* Cart Button */}
            <Button onClick={onOpenCart} className="relative bg-[#F15A24] hover:bg-[#d94e1d] text-white border-0 shadow-sm transition-all active:scale-95">
              <ShoppingCart className="h-5 w-5 mr-2" />
              <span className="hidden sm:inline">ตะกร้า</span>
              {cartCount > 0 && (
                <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 min-w-5 px-1 flex items-center justify-center rounded-full bg-red-600 text-white border-2 border-white shadow-sm">
                  {cartCount}
                </Badge>
              )}
            </Button>

            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            {/* Logout Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout} 
              className="text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-8 flex-1">
        {children || <Outlet />} 
      </main>
    </div>
  );
}