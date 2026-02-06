import {
  Barcode,
  Boxes,
  Circle,
  LayoutDashboard,
  LayoutGrid,
  ListTree,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
} from "lucide-react";

export type NavRole = "admin" | "viewer";

export type NavItemConfig = {
  id: string;
  label: string;
  path: string;
  icon?: string | null;
  order_index: number;
  is_visible: boolean;
  roles: NavRole[];
  is_core?: boolean;
};

export type NavGroupConfig = {
  id: string;
  label: string;
  icon?: string | null;
  order_index: number;
  is_active: boolean;
  is_core?: boolean;
  items: NavItemConfig[];
};

export const NAV_ICON_MAP: Record<string, typeof LayoutDashboard> = {
  "layout-dashboard": LayoutDashboard,
  "shopping-cart": ShoppingCart,
  "package": Package,
  "barcode": Barcode,
  "users": Users,
  "user-cog": UserCog,
  "settings": Settings,
  "shield-check": ShieldCheck,
  "layout-grid": LayoutGrid,
  "boxes": Boxes,
  "list-tree": ListTree,
};

export const NAV_ICON_OPTIONS = [
  { value: "layout-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "shopping-cart", label: "Transactions", icon: ShoppingCart },
  { value: "package", label: "Products", icon: Package },
  { value: "barcode", label: "Serials", icon: Barcode },
  { value: "users", label: "Employees", icon: Users },
  { value: "user-cog", label: "Users", icon: UserCog },
  { value: "settings", label: "Settings", icon: Settings },
  { value: "shield-check", label: "System", icon: ShieldCheck },
  { value: "layout-grid", label: "Main", icon: LayoutGrid },
  { value: "boxes", label: "Management", icon: Boxes },
];

export const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Staff" },
] as const;

export function getNavIcon(iconName?: string | null) {
  if (!iconName) return Circle;
  return NAV_ICON_MAP[iconName] ?? Circle;
}

export const DEFAULT_NAV_GROUPS: NavGroupConfig[] = [
  {
    id: "main",
    label: "Main",
    icon: "layout-grid",
    order_index: 1,
    is_active: true,
    is_core: true,
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        path: "/",
        icon: "layout-dashboard",
        order_index: 1,
        is_visible: true,
        roles: ["admin", "viewer"],
        is_core: true,
      },
      {
        id: "transactions",
        label: "Transactions",
        path: "/transactions",
        icon: "shopping-cart",
        order_index: 2,
        is_visible: true,
        roles: ["admin", "viewer"],
        is_core: true,
      },
    ],
  },
  {
    id: "management",
    label: "Management",
    icon: "boxes",
    order_index: 2,
    is_active: true,
    is_core: true,
    items: [
      {
        id: "products",
        label: "Products",
        path: "/products",
        icon: "package",
        order_index: 1,
        is_visible: true,
        roles: ["admin", "viewer"],
        is_core: true,
      },
      {
        id: "serials",
        label: "Serials",
        path: "/serials",
        icon: "barcode",
        order_index: 2,
        is_visible: true,
        roles: ["admin", "viewer"],
        is_core: true,
      },
      {
        id: "employees",
        label: "Employees",
        path: "/employees",
        icon: "users",
        order_index: 3,
        is_visible: true,
        roles: ["admin", "viewer"],
        is_core: true,
      },
      {
        id: "users",
        label: "Users",
        path: "/users",
        icon: "user-cog",
        order_index: 4,
        is_visible: true,
        roles: ["admin"],
        is_core: false,
      },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: "shield-check",
    order_index: 3,
    is_active: true,
    is_core: true,
    items: [
      {
        id: "settings",
        label: "Settings",
        path: "/settings",
        icon: "settings",
        order_index: 1,
        is_visible: true,
        roles: ["admin"],
        is_core: true,
      },
    ],
  },
];
