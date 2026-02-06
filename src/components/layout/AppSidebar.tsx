import {
  ChevronDown,
  ChevronUp,
  LogOut,
  UserCircle,
} from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useMemo, useState } from "react";
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
  SidebarSeparator,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigationConfig, normalizeNavigationConfig } from "@/hooks/useNavigationConfig";
import { getNavIcon } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const GROUP_STATE_KEY = "sidebar:groups";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: navConfig } = useNavigationConfig();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(GROUP_STATE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });
  }, []);

  const isActive = (url: string) => {
    if (url === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(url);
  };

  const normalizedGroups = useMemo(
    () => normalizeNavigationConfig(navConfig, { fallbackToDefault: true }),
    [navConfig],
  );

  const role = isAdmin ? "admin" : "viewer";

  const visibleGroups = useMemo(() => {
    return normalizedGroups
      .filter((group) => group.is_active)
      .map((group) => {
        const items = group.items.filter((item) => {
          if (item.id === "navigation-items" || item.path === "/navigation-items") return false;
          if (!item.is_visible) return false;
          if (!item.roles.includes(role)) return false;
          return true;
        });
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);
  }, [normalizedGroups, role]);

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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/70 bg-sidebar">
      <SidebarHeader className="gap-3 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-1 py-2 transition-all group-data-[collapsible=icon]:justify-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-transparent">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-full w-full rounded-[20px] object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.classList.add("bg-orange-500", "shadow-sm", "rounded-[30px]");
                      parent.innerHTML = '<span class="text-white font-bold">IM</span>';
                    }
                  }}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-base font-semibold">24CARFIX</span>
                <span className="truncate text-xs text-muted-foreground">Stock Management</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden">
        {visibleGroups.length === 0 ? (
          <div className="px-4 py-6 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            No navigation items match your search.
          </div>
        ) : (
          visibleGroups.map((group) => {
            const GroupIcon = getNavIcon(group.icon);
            const isOpen = !collapsedGroups[group.id];

            return (
              <SidebarGroup key={group.id} className="py-1">
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) =>
                    setCollapsedGroups((prev) => ({
                      ...prev,
                      [group.id]: !open,
                    }))
                  }
                >
                  <SidebarGroupLabel asChild className="px-2 text-[11px] uppercase tracking-widest">
                    <CollapsibleTrigger
                      className={cn(
                        "flex w-full items-center justify-between text-sidebar-foreground/70",
                        "hover:text-sidebar-foreground",
                        "group-data-[collapsible=icon]:hidden",
                      )}
                      aria-label={`Toggle ${group.label} section`}
                    >
                      <div className="flex items-center gap-2">
                        <GroupIcon className="h-4 w-4 text-orange-400" />
                        <span className="font-medium">{group.label}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isOpen ? "rotate-0" : "-rotate-90",
                        )}
                      />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>

                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-1">
                        {group.items.map((item) => {
                          const ItemIcon = getNavIcon(item.icon);
                          const active = isActive(item.path);

                          return (
                            <SidebarMenuItem key={item.id}>
                              <SidebarMenuButton
                                asChild
                                tooltip={item.label}
                                size="lg"
                                isActive={active}
                                className={cn(
                                  "relative h-11 gap-3 rounded-lg px-3 text-sidebar-foreground/80",
                                  "hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                                  "data-[active=true]:bg-orange-500/10 data-[active=true]:text-orange-400 data-[active=true]:font-semibold",
                                  "data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1 data-[active=true]:before:bottom-1 data-[active=true]:before:w-1 data-[active=true]:before:rounded-r-md data-[active=true]:before:bg-orange-500",
                                  "[&>svg]:text-sidebar-foreground/70 data-[active=true]:[&>svg]:text-orange-400",
                                )}
                              >
                                <Link
                                  to={item.path}
                                  onClick={() => {
                                    if (isMobile) setOpenMobile(false);
                                  }}
                                  className="flex w-full items-center gap-3"
                                >
                                  <ItemIcon className="h-5 w-5" />
                                  <span className="truncate text-sm">{item.label}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            );
          })
        )}
      </SidebarContent>

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
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail ?? (isAdmin ? "System Access" : "Employee Access")}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg">
                <DropdownMenuItem className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-red-500 focus:bg-red-50 focus:text-red-500"
                  onClick={handleSafeLogout}
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
