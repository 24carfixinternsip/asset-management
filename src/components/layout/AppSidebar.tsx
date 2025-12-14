import { 
  LayoutDashboard, 
  Package, 
  Barcode, 
  ArrowLeftRight, 
  Users, 
  Settings,
  LogOut,
  Wrench
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
import { cn } from "@/lib/utils";

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
    <Sidebar className="border-r-0 bg-sidebar" collapsible="icon">
      {/* --- ส่วน Header Logo --- */}
      {/* ใช้พื้นหลังสีส้ม (#F15A24) เพื่อให้ตัวอักษรสีดำและขาวมองเห็นชัดเจนทั้งคู่ */}
      <SidebarHeader className="h-20 flex items-center justify-center border-b border-white/10 bg-[#F15A24] px-4 shadow-md z-10 relative overflow-hidden">
        
        {/* Decorative Background Pattern (Optional: ลายจางๆ ด้านหลัง) */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '16px 16px' }} 
        />

        <div className="flex items-center gap-2 w-full transition-all duration-300 group-data-[collapsible=icon]:justify-center relative z-10">
          
          {/* Logo Text: 24CARFIX */}
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <div className="text-3xl font-black tracking-wider italic leading-none drop-shadow-sm flex items-baseline">
              {/* 2 (ดำ) */}
              <span className="text-black [-webkit-text-stroke:1px_black]">2</span>
              {/* 4 (ขาว) */}
              <span className="text-white [-webkit-text-stroke:1px_white]">4</span>
              {/* CAR (ดำ) */}
              <span className="text-black ml-0.5 [-webkit-text-stroke:1px_black]">CAR</span>
              {/* FIX (ขาว) */}
              <span className="text-white [-webkit-text-stroke:1px_white]">FIX</span>
            </div>
            <span className="text-[10px] font-bold text-black/80 uppercase tracking-[0.4em] mt-1 pl-0.5">
              Asset System
            </span>
          </div>

          {/* Icon สำหรับตอนพับเมนู (แสดงเฉพาะตอนพับ) */}
          <div className="hidden group-data-[collapsible=icon]:flex h-10 w-10 items-center justify-center rounded-lg bg-black/20 text-white">
             <span className="font-black italic text-lg">24</span>
          </div>
        </div>
      </SidebarHeader>

      {/* --- ส่วนเนื้อหาเมนู --- */}
      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider px-2 mb-2 group-data-[collapsible=icon]:hidden">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {menuItems.map((item) => {
                // ตรวจสอบว่าเมนูนี้ถูกเลือกอยู่หรือไม่
                const isActive = location.pathname === item.url || 
                  (item.url !== "/" && location.pathname.startsWith(item.url));
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className={cn(
                        "h-11 transition-all duration-200 rounded-lg group font-medium relative overflow-hidden",
                        isActive 
                          ? "bg-[#F15A24] text-white shadow-lg shadow-orange-900/20 hover:bg-[#F15A24]/90" // Active: สีส้ม
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" // Inactive
                      )}
                    >
                      <NavLink to={item.url} className="flex items-center gap-3 px-3 relative z-10">
                        <item.icon className={cn(
                          "h-5 w-5 transition-transform duration-300", 
                          isActive ? "scale-110" : "group-hover:scale-110"
                        )} />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* --- ส่วน Footer --- */}
      <SidebarFooter className="p-4 border-t border-sidebar-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              tooltip="ออกจากระบบ"
              className="h-10 text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors justify-start"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        {/* Status Indicator */}
        <div className="mt-4 flex items-center justify-center gap-2 px-2 py-1 rounded-full bg-sidebar-accent/50 border border-sidebar-border group-data-[collapsible=icon]:hidden">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
          <span className="text-[10px] font-medium text-sidebar-foreground/50">System Online</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}