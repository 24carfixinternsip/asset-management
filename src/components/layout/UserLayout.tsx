import { ReactNode } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom"; // เพิ่ม useNavigate
import { ShoppingCart, Package, LogOut } from "lucide-react"; // เพิ่ม icon LogOut
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client"; // เพิ่ม supabase
import { toast } from "sonner"; // เพิ่ม toast

interface UserLayoutProps {
  cartCount: number;
  onOpenCart: () => void;
  children?: ReactNode;
}

export function UserLayout({ cartCount, onOpenCart, children }: UserLayoutProps) {
  const navigate = useNavigate();

  // ฟังก์ชัน Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("ออกจากระบบเรียบร้อย");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/portal" className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:inline-block text-slate-800">
              ระบบเบิกทรัพย์สิน (Portal)
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* ปุ่มประวัติ */}
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/portal/history">ประวัติของฉัน</Link>
            </Button>
            
            {/* ปุ่มตะกร้า */}
            <Button onClick={onOpenCart} className="relative" variant="outline">
              <ShoppingCart className="h-5 w-5 mr-2" />
              รายการเบิก
              {cartCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 rounded-full"
                >
                  {cartCount}
                </Badge>
              )}
            </Button>

            {/* Separator */}
            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            {/* ปุ่ม Logout (เพิ่มใหม่) */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              title="ออกจากระบบ"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 flex-1">
        {children || <Outlet />} 
      </main>
      <Toaster />
    </div>
  );
}