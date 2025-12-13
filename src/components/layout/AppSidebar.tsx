import { 
  LayoutDashboard, 
  Package, 
  Barcode, 
  ArrowLeftRight, 
  Users, 
  Settings,
  Building2,
  LogOut
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const menuItems = [
  { title: "แดชบอร์ด", url: "/", icon: LayoutDashboard },
  { title: "สินค้า/ทรัพย์สิน", url: "/products", icon: Package },
  { title: "ติดตามรายการ", url: "/serials", icon: Barcode },
  { title: "เบิก-คืน", url: "/transactions", icon: ArrowLeftRight },
  { title: "พนักงาน", url: "/employees", icon: Users },
  { title: "ตั้งค่า", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/login");
    } catch (error) {
      toast.error("เกิดข้อผิดพลาด");
    }
  };
  
  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="gradient-sidebar border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-sidebar-foreground">ระบบจัดการทรัพย์สิน</span>
            <span className="text-xs text-sidebar-foreground/70">Asset Management</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gradient-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider px-4">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url || 
                  (item.url !== "/" && location.pathname.startsWith(item.url));
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`mx-2 rounded-lg transition-all duration-200 ${
                        isActive 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      }`}
                    >
                      <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gradient-sidebar border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 mx-2 mb-2"
            >
              <LogOut className="h-4 w-4" />
              <span>ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <div className="text-xs text-sidebar-foreground/50 text-center">
          v1.0.20 © 2025
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}