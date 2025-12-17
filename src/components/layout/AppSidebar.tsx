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
} from "lucide-react";
import { useLocation, Link } from "react-router-dom";
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

export function AppSidebar() {
  const location = useLocation();
  const { isAdmin } = useUserRole();
  const { state } = useSidebar(); // เรียกใช้เพื่อให้ Sidebar ทำงานสมบูรณ์

  // ✅ FIX 1: แก้ปัญหากระพริบ
  // ใช้ State ช่วยจำค่า isAdmin เพื่อไม่ให้เมนูหายไปตอนเปลี่ยนหน้า (Loading ชั่วขณะ)
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  useEffect(() => {
    // ถ้าตรวจสอบแล้วว่าเป็น Admin ให้โชว์เมนูค้างไว้เลย ไม่ต้องรอโหลดใหม่
    if (isAdmin) {
      setShowAdminMenu(true);
    }
  }, [isAdmin]);

  const isActive = (url: string) => {
    if (url === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(url);
  };

  // ใช้ useMemo เพื่อป้องกันการคำนวณเมนูซ้ำโดยไม่จำเป็น
  const menuGroups = useMemo(() => {
    const groups = [
      {
        label: "Main",
        items: [
          { title: "Dashboard", url: "/", icon: LayoutDashboard },
          { title: "Transactions", url: "/transactions", icon: ShoppingCart },
        ],
      },
      {
        label: "Management",
        items: [
          { title: "Products", url: "/products", icon: Package },
          { title: "Serials", url: "/serials", icon: Barcode },
          { title: "Employees", url: "/employees", icon: Users },
        ],
      },
    ];

    // เพิ่ม Admin Group ต่อเมื่อ showAdminMenu เป็น true (นิ่งกว่า isAdmin เพียวๆ)
    if (showAdminMenu) {
      groups.push({
        label: "System",
        items: [
          { title: "Settings", url: "/settings", icon: Settings },
        ],
      });
    }

    return groups;
  }, [showAdminMenu]); // อัปเดตเมนูเฉพาะตอนสถานะ Admin เปลี่ยนจริงๆ เท่านั้น

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-sidebar">
      {/* --- Header / Logo Area --- */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-1 py-2 transition-all group-data-[collapsible=icon]:justify-center">
              
              {/* ✅ FIX 2: ส่วนใส่รูปโลโก้ */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-transparent">
                {/* ดึงรูปจาก /public/logo.png */}
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    // Fallback: ถ้ารูปโหลดไม่ได้ ให้แสดงเป็นตัวหนังสือ IM ในกรอบส้มแทน
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.classList.add('bg-orange-500', 'shadow-sm');
                      parent.innerHTML = '<span class="text-white font-bold">IM</span>';
                    }
                  }}
                />
              </div>

              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold text-base">24CARFIX</span>
                <span className="truncate text-xs text-muted-foreground">
                  Stock Management
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* --- Content Area --- */}
      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="flex items-center gap-2">
               {/* ใส่ไอคอนหน้าหัวข้อ System ให้ดูสวยงาม */}
               {group.label === "System" && <ShieldCheck className="h-3 w-3 text-orange-500" />}
               <span>{group.label}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive(item.url)}
                      // ✅ FIX 3: ปรับสีธีมส้ม (Orange-500) และตัวหนังสือขาวเมื่อ Active
                      className="
                        transition-all duration-200
                        hover:bg-orange-50 hover:text-orange-600
                        data-[active=true]:bg-orange-500 
                        data-[active=true]:text-white
                        data-[active=true]:shadow-md
                        data-[active=true]:font-medium
                      "
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* --- Footer / User Profile --- */}
      <SidebarFooter>
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
                    <span className="truncate font-semibold">
                      {isAdmin ? "Administrator" : "User"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isAdmin ? "System Access" : "Employee Access"}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              >
                <DropdownMenuItem>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-50">
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