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
  LayoutGrid, // เพิ่มไอคอน Main
  Boxes,      // เพิ่มไอคอน Management
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
  const { state } = useSidebar();

  // ✅ FIX 1: แก้เรื่องกระพริบแบบถาวร
  // อ่านค่าจาก localStorage ก่อนเลย เพื่อให้สถานะเป็นจริงทันทีตั้งแต่เสี้ยววินาทีแรกที่โหลด
  const [showAdminMenu, setShowAdminMenu] = useState(() => {
    return localStorage.getItem("app_is_admin") === "true";
  });

  useEffect(() => {
    // เมื่อโหลดข้อมูลเสร็จ ถ้าเป็น Admin ให้บันทึกสถานะลงเครื่องไว้
    if (isAdmin) {
      localStorage.setItem("app_is_admin", "true");
      setShowAdminMenu(true);
    } 
    // ถ้าชัดเจนแล้วว่าไม่ใช่ Admin ถึงค่อยลบออก (ป้องกันการลบตอนกำลัง Loading)
    else if (isAdmin === false) {
      localStorage.removeItem("app_is_admin");
      setShowAdminMenu(false);
    }
  }, [isAdmin]);

  const isActive = (url: string) => {
    if (url === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(url);
  };

  // ✅ FIX 2: เพิ่มไอคอนให้หัวข้อ Main และ Management
  const menuGroups = useMemo(() => {
    const groups = [
      {
        label: "Main",
        icon: LayoutGrid, // ไอคอนสวยๆ สำหรับ Main
        items: [
          { title: "Dashboard", url: "/", icon: LayoutDashboard },
          { title: "Transactions", url: "/transactions", icon: ShoppingCart },
        ],
      },
      {
        label: "Management",
        icon: Boxes, // ไอคอนสวยๆ สำหรับ Management
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
        icon: ShieldCheck, // ไอคอนเดิม
        items: [
          { title: "Settings", url: "/settings", icon: Settings },
        ],
      });
    }

    return groups;
  }, [showAdminMenu]);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-1 py-2 transition-all group-data-[collapsible=icon]:justify-center">
              
              {/* ✅ FIX 3: ปรับโลโก้ให้ขอบมน 30px */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-transparent">
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  // ใส่ rounded-[30px] ตามที่ขอ
                  className="h-full w-full object-contain rounded-[15px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.classList.add('bg-orange-500', 'shadow-sm', 'rounded-[30px]'); // ใส่ที่ fallback ด้วย
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

      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {/* ส่วนแสดงหัวข้อพร้อมไอคอน */}
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
                {/* เพิ่ม onclick เพื่อล้าง localStorage ตอน Logout ไม่งั้นเมนู System จะค้าง */}
                <DropdownMenuItem 
                  className="text-red-500 focus:text-red-500 focus:bg-red-50"
                  onClick={() => {
                    localStorage.removeItem("app_is_admin");
                    // เพิ่มโค้ด Logout จริงๆ ตรงนี้ถ้ามี function logout
                  }}
                >
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