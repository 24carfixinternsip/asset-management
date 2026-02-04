import {
  LayoutDashboard,
  Users,
  Package,
  Barcode,
  Settings,
  ShoppingCart,
  LogOut,
  UserCircle,
  ShieldCheck,
  ChevronUp,
  LayoutGrid, 
  Boxes,      
} from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useState, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { isMobile, setOpenMobile } = useSidebar();

  const [showAdminMenu, setShowAdminMenu] = useState(() => {
    return localStorage.getItem("app_is_admin") === "true";
  });

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem("app_is_admin", "true");
      setShowAdminMenu(true);
    } 
    else if (isAdmin === false) {
      localStorage.removeItem("app_is_admin");
      setShowAdminMenu(false);
    }
  }, [isAdmin]);

  const isActive = (url: string) => {
    if (url === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(url);
  };

  const menuGroups = useMemo(() => {
    const groups = [
      {
        label: "Main",
        icon: LayoutGrid, 
        items: [
          { title: "Dashboard", url: "/", icon: LayoutDashboard },
          { title: "Transactions", url: "/transactions", icon: ShoppingCart },
        ],
      },
      {
        label: "Management",
        icon: Boxes, 
        items: [
          { title: "Products", url: "/products", icon: Package },
          { title: "Serials", url: "/serials", icon: Barcode },
          { title: "Employees", url: "/employees", icon: Users },
        ],
      },
    ];

    if (showAdminMenu) {
      groups.push({
        label: "System",
        icon: ShieldCheck, 
        items: [
          { title: "Settings", url: "/settings", icon: Settings },
        ],
      });
    }

    return groups;
  }, [showAdminMenu]);

  const handleSafeLogout = async () => {
    try {
        if (isMobile) setOpenMobile(false);
        document.body.style.pointerEvents = "";
        
        await supabase.auth.signOut();
        localStorage.removeItem("app_is_admin");
        
        toast.success("ออกจากระบบเรียบร้อย");
        navigate("/login");
    } catch (error) {
        console.error("Logout error", error);
        navigate("/login");
    }
  };

  return (
    // ไม่ต้องใส่ h-[100dvh] ตรงนี้แล้ว เพราะเราไปแก้ที่ตัว sidebar.tsx แล้ว
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-1 py-2 transition-all group-data-[collapsible=icon]:justify-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-transparent">
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  className="h-full w-full object-contain rounded-[20px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.classList.add('bg-orange-500', 'shadow-sm', 'rounded-[30px]'); 
                      parent.innerHTML = '<span class="text-white font-bold">IM</span>';
                    }
                  }}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold text-base">24CARFIX</span>
                <span className="truncate text-xs text-muted-foreground">Stock Management</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ✅ SidebarContent: flex-1 ให้ขยายเต็มพื้นที่ที่เหลือ */}
      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden">
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="flex items-center gap-2 text-sidebar-foreground/70">
               {group.icon && <group.icon className="h-4 w-4 text-orange-500" />}
               <span className="font-medium">{group.label}</span>
            </SidebarGroupLabel>
            
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive(item.url)}
                      className="relative transition-all duration-200 hover:bg-orange-50 hover:text-orange-600 data-[active=true]:bg-orange-500/10 data-[active=true]:text-orange-600 data-[active=true]:font-semibold data-[active=true]:after:absolute data-[active=true]:after:left-2 data-[active=true]:after:right-2 data-[active=true]:after:bottom-1 data-[active=true]:after:h-0.5 data-[active=true]:after:rounded-full data-[active=true]:after:bg-orange-500"
                    >
                      <Link to={item.url}>
                        <item.icon className="h-5 w-5" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ✅ SidebarFooter: mt-auto ดันลงล่างสุด */}
      <SidebarFooter className="mt-auto pb-4 md:pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-orange-100">
                    <AvatarImage src="" alt="User" />
                    <AvatarFallback className="rounded-lg bg-orange-100 text-orange-600 font-bold">
                      {isAdmin ? "A" : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{isAdmin ? "Administrator" : "User"}</span>
                    <span className="truncate text-xs text-muted-foreground">{isAdmin ? "System Access" : "Employee Access"}</span>
                  </div>
                  <ChevronUp className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg">
                <DropdownMenuItem className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-50 cursor-pointer" onClick={handleSafeLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
