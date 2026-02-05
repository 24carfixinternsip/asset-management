import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { DEFAULT_NAV_GROUPS, NavGroupConfig, NavRole } from "@/lib/navigation";

export type NavigationGroupRow = Tables<"navigation_groups">;
export type NavigationItemRow = Tables<"navigation_items">;
export type NavigationGroupWithItems = NavigationGroupRow & {
  navigation_items: NavigationItemRow[];
};

const ROLE_SET = new Set<NavRole>(["admin", "viewer"]);

function normalizeRoles(roles: string[] | null | undefined): NavRole[] {
  if (!roles || roles.length === 0) return ["admin", "viewer"];
  const filtered = roles.filter((role): role is NavRole => ROLE_SET.has(role as NavRole));
  return filtered.length > 0 ? filtered : ["admin", "viewer"];
}

export function normalizeNavigationConfig(
  groups: NavigationGroupWithItems[] | null | undefined,
  options: { fallbackToDefault?: boolean } = {},
): NavGroupConfig[] {
  if (!groups || groups.length === 0) {
    return options.fallbackToDefault ? DEFAULT_NAV_GROUPS : [];
  }

  return groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      icon: group.icon,
      order_index: group.order_index ?? 0,
      is_active: group.is_active ?? true,
      is_core: group.is_core ?? false,
      items: (group.navigation_items || [])
        .map((item) => ({
          id: item.id,
          label: item.label,
          path: item.path,
          icon: item.icon,
          order_index: item.order_index ?? 0,
          is_visible: item.is_visible ?? true,
          roles: normalizeRoles(item.roles),
          is_core: item.is_core ?? false,
        }))
        .sort((a, b) => a.order_index - b.order_index),
    }))
    .sort((a, b) => a.order_index - b.order_index);
}

export function useNavigationConfig() {
  return useQuery({
    queryKey: ["navigation-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("navigation_groups")
        .select("*, navigation_items (*)")
        .order("order_index")
        .order("order_index", { foreignTable: "navigation_items" });

      if (error) throw error;
      return data as NavigationGroupWithItems[];
    },
  });
}
