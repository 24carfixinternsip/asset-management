import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Package, ArrowLeftRight, Wrench,
  AlertTriangle, Search, Box, AlertCircle,
  Filter, X, ImageIcon,
  ChevronLeft, ChevronRight,
  ArrowUpDown, ZoomIn, Plus, Upload,
  FileDown, FileSpreadsheet,
  RefreshCw, Bell, Truck,
  Eye, Pencil, Trash2, History,
  LayoutGrid, List, StickyNote
} from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";

import { useDashboardStats, useDashboardInventory } from "@/hooks/useDashboard"; 
import { useRecentTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useMasterData";
import { useDeleteProduct, useUpdateProduct, ProductWithStock } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";

import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function Dashboard() {
  type InvSortKey = "name" | "p_id" | "available" | "borrowed" | "issue" | "inactive" | "total";
  type InvSortDir = "asc" | "desc";
  type InventoryItem = {
    id: string;
    p_id: string;
    name: string;
    image?: string | null;
    category: string;
    brand: string | null;
    model: string | null;
    total: number;
    available: number;
    borrowed: number;
    issue: number;
    inactive: number;
    location?: string | null;
    location_name?: string | null;
  };

  // Fetch Data
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: inventorySummary, isLoading: inventoryLoading, refetch: refetchInventory } = useDashboardInventory();
  const { data: recentTransactions, isLoading: transactionsLoading } = useRecentTransactions(20);
  const { data: categoriesData } = useCategories();
  const categoryOptions = categoriesData?.map(c => c.name) || [];
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  // --- States ---
  const [searchParams, setSearchParams] = useSearchParams();
  const [inventorySearch, setInventorySearch] = useState(searchParams.get("q") || "");
  const [inventoryView, setInventoryView] = useState<"cards" | "table">(
    () => (searchParams.get("view") === "table" ? "table" : "cards")
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const raw = searchParams.get("cat");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    const raw = searchParams.get("status");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [selectedLocations, setSelectedLocations] = useState<string[]>(() => {
    const raw = searchParams.get("loc");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([]);
  const [autoRefreshInventory, setAutoRefreshInventory] = useState(searchParams.get("live") !== "0");
  const [invSort, setInvSort] = useState<{ key: InvSortKey; dir: InvSortDir }>(() => {
    const raw = searchParams.get("sort");
    if (!raw) return { key: "available", dir: "desc" };
    const [key, dir] = raw.split(":");
    const validKey = ["name", "p_id", "available", "borrowed", "issue", "inactive", "total"].includes(key);
    const validDir = dir === "asc" || dir === "desc";
    if (!validKey || !validDir) return { key: "available", dir: "desc" };
    return { key: key as InvSortKey, dir: dir as InvSortDir };
  });
  

  // Pagination States
  const [invPage, setInvPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");

  const INV_ITEMS_PER_PAGE = 12;
  const TX_ITEMS_PER_PAGE = 3;
  const LOW_STOCK_ITEMS_PER_PAGE = 5;

  // Dialog States
  const presetLowStockThresholds = [1, 3, 7] as const;
  const parsedLowStockThreshold = Number(searchParams.get("ls_th") || 1);
  const normalizedLowStockThreshold =
    Number.isFinite(parsedLowStockThreshold) && parsedLowStockThreshold >= 1
      ? Math.floor(parsedLowStockThreshold)
      : 1;
  const [isLowStockOpen, setIsLowStockOpen] = useState(searchParams.get("modal") === "lowstock");
  const [lowStockSearch, setLowStockSearch] = useState(searchParams.get("ls_q") || "");
  const [lowStockCategory, setLowStockCategory] = useState(searchParams.get("ls_cat") || "all");
  const [lowStockLocation, setLowStockLocation] = useState(searchParams.get("ls_loc") || "all");
  const [lowStockThreshold, setLowStockThreshold] = useState(normalizedLowStockThreshold);
  const [isCustomLowStockThreshold, setIsCustomLowStockThreshold] = useState(
    !presetLowStockThresholds.includes(normalizedLowStockThreshold as (typeof presetLowStockThresholds)[number])
  );
  const [customLowStockThresholdInput, setCustomLowStockThresholdInput] = useState(String(normalizedLowStockThreshold));
  const [lowStockSort, setLowStockSort] = useState(searchParams.get("ls_sort") || "available:asc");
  const [lowStockAutoRefresh, setLowStockAutoRefresh] = useState(searchParams.get("ls_auto") !== "0");
  const [lowStockSelected, setLowStockSelected] = useState<string[]>([]);
  const [lowStockOrderState, setLowStockOrderState] = useState<Record<string, "ordered" | "restock">>({});
  const [imagePreview, setImagePreview] = useState<{ open: boolean; src: string; name: string }>({
    open: false,
    src: "",
    name: "",
  });
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailProduct, setDetailProduct] = useState<ProductWithStock | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [focusNotes, setFocusNotes] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const [detailForm, setDetailForm] = useState({
    p_id: "",
    name: "",
    category: "",
    brand: "",
    model: "",
    description: "",
    notes: "",
    price: "",
    unit: "",
    image_url: "",
    initial_quantity: "",
  });

  const statusOptions = [
    { value: "available", label: "พร้อมใช้" },
    { value: "in_use", label: "กำลังใช้งาน" },
    { value: "out_of_stock", label: "หมดสต็อก" },
    { value: "damaged", label: "ต้องซ่อม/เสียหาย" },
    { value: "inactive", label: "เลิกใช้" },
  ];

  const thresholdOptions = [
    { value: "1", label: "ต่ำกว่า 1" },
    { value: "3", label: "ต่ำกว่า 3" },
    { value: "7", label: "ต่ำกว่า 7" },
    { value: "custom", label: "ระบุจำนวนที่น้อยกว่า" },
  ] as const;
  const lowStockThresholdSelectValue = isCustomLowStockThreshold ? "custom" : String(lowStockThreshold);

  const handleLowStockThresholdChange = (value: string) => {
    if (value === "custom") {
      setIsCustomLowStockThreshold(true);
      return;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const normalized = Math.floor(parsed);

    setIsCustomLowStockThreshold(false);
    setLowStockThreshold(normalized);
    setCustomLowStockThresholdInput(String(normalized));
  };

  const handleCustomLowStockThresholdChange = (value: string) => {
    setCustomLowStockThresholdInput(value);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    setLowStockThreshold(Math.floor(parsed));
  };

  const activeFilterCount =
    selectedCategories.length +
    selectedStatuses.length +
    selectedLocations.length +
    (inventorySearch.trim() ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;
  const activeChipClass =
    "group inline-flex max-w-[220px] items-center gap-1 rounded-full border bg-white px-2 py-1 text-[11px] text-foreground transition-shadow duration-200 hover:shadow-sm motion-reduce:transition-none";

  const getItemStatusKey = (item: InventoryItem) => {
    if (item.issue > 0) return "damaged";
    if (item.borrowed > 0) return "in_use";
    if (item.available > 0) return "available";
    if (item.inactive > 0) return "inactive";
    if (item.total > 0) return "out_of_stock";
    return "unknown";
  };

  const getItemStatusMeta = (item: InventoryItem) => {
    const key = getItemStatusKey(item);
    const statusMap: Record<string, { label: string; className: string }> = {
      available: {
        label: "พร้อมใช้",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      in_use: {
        label: "กำลังใช้งาน",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      },
      out_of_stock: {
        label: "หมดสต็อก",
        className: "bg-orange-50 text-orange-700 border-orange-200",
      },
      damaged: {
        label: "ต้องซ่อม/เสียหาย",
        className: "bg-rose-50 text-rose-700 border-rose-200",
      },
      inactive: {
        label: "เลิกใช้",
        className: "bg-slate-100 text-slate-600 border-slate-200",
      },
      unknown: {
        label: "ไม่ระบุ",
        className: "bg-muted text-muted-foreground border-border",
      },
    };
    return { key, ...statusMap[key] };
  };

  const getUsageStatusMeta = (item: InventoryItem) => {
    if (item.issue > 0) {
      return { label: "ส่งซ่อม", className: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    if (item.borrowed > 0) {
      return { label: "กำลังใช้งาน", className: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (item.available > 0) {
      return { label: "พร้อมใช้", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (item.inactive > 0) {
      return { label: "เสียหาย", className: "bg-rose-50 text-rose-700 border-rose-200" };
    }
    return { label: "เสียหาย", className: "bg-rose-50 text-rose-700 border-rose-200" };
  };

  const getLowStockMeta = (item: InventoryItem) => {
    if (item.total <= 0) {
      return { label: "ไม่มีสต็อก", className: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
    }
    if (item.available <= 0) {
      return { label: "วิกฤต", className: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" };
    }
    if (item.available <= Math.max(1, Math.floor(lowStockThreshold / 2))) {
      return { label: "ต่ำมาก", className: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" };
    }
    if (item.available <= lowStockThreshold) {
      return { label: "ใกล้หมด", className: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" };
    }
    return { label: "ปกติ", className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
  };

  const getStockPercent = (item: InventoryItem) => {
    if (!item.total) return 0;
    return Math.round((item.available / item.total) * 100);
  };

  const getActivityMeta = (status?: string) => {
    if (status === "Active") {
      return {
        label: "ยืม",
        tone: "bg-amber-100 text-amber-700",
        icon: ArrowLeftRight,
      };
    }
    if (status === "Completed") {
      return {
        label: "คืน",
        tone: "bg-emerald-100 text-emerald-700",
        icon: Package,
      };
    }
    if (status === "PendingReturn") {
      return {
        label: "รอคืน",
        tone: "bg-rose-100 text-rose-700",
        icon: AlertTriangle,
      };
    }
    return {
      label: status || "อัปเดต",
      tone: "bg-slate-100 text-slate-600",
      icon: Box,
    };
  };

  const locationOptions = useMemo(() => {
    const locations = new Set<string>();
    (inventorySummary || []).forEach((item) => {
      const locationValue = (item as InventoryItem).location || (item as InventoryItem).location_name;
      if (locationValue) locations.add(locationValue);
    });
    return Array.from(locations);
  }, [inventorySummary]);

  const hasLocationData = locationOptions.length > 0;
  const inventoryByPid = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    (inventorySummary || []).forEach((item) => {
      map.set(item.p_id, item);
    });
    return map;
  }, [inventorySummary]);

  const inventoryTotals = useMemo(() => {
    return (inventorySummary || []).reduce(
      (acc, item) => {
        acc.total += item.total || 0;
        acc.available += item.available || 0;
        acc.borrowed += item.borrowed || 0;
        acc.issue += item.issue || 0;
        acc.inactive += item.inactive || 0;
        return acc;
      },
      { total: 0, available: 0, borrowed: 0, issue: 0, inactive: 0 }
    );
  }, [inventorySummary]);

  const totalItems = stats?.totalItems ?? inventoryTotals.total;
  const availableItems = stats?.availableCount ?? inventoryTotals.available;
  const borrowedItems = stats?.borrowedCount ?? inventoryTotals.borrowed;
  const damagedItems = inventoryTotals.issue;
  const repairItems = stats?.repairCount ?? inventoryTotals.issue;

  const reportTotal = Math.max(
    totalItems || 0,
    availableItems + borrowedItems + damagedItems + repairItems
  );

  const statusReportData = [
    { name: "available", value: availableItems },
    { name: "borrowed", value: borrowedItems },
    { name: "damaged", value: damagedItems },
    { name: "repair", value: repairItems },
  ];

  const statusChartConfig = {
    available: { label: "คืนแล้ว/พร้อมใช้", color: "hsl(var(--chart-2))" },
    borrowed: { label: "กำลังยืม", color: "hsl(var(--chart-3))" },
    damaged: { label: "เสียหาย", color: "hsl(var(--chart-4))" },
    repair: { label: "รอซ่อม", color: "hsl(var(--chart-5))" },
  };

  const summaryCards = [
    {
      title: "รายการทั้งหมด",
      value: totalItems,
      helper: "รวมทั้งหมดในระบบ",
      icon: Package,
      tone: "bg-primary/10 text-primary",
    },
    {
      title: "กำลังยืม",
      value: borrowedItems,
      helper: "ใช้งานอยู่ตอนนี้",
      icon: ArrowLeftRight,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      title: "เสียหาย",
      value: damagedItems,
      helper: "รอประเมินสภาพ",
      icon: AlertTriangle,
      tone: "bg-rose-100 text-rose-700",
    },
    {
      title: "รอซ่อม",
      value: repairItems,
      helper: "ส่งซ่อม/ตรวจสอบ",
      icon: Wrench,
      tone: "bg-purple-100 text-purple-700",
    },
  ];

  const getReportPercent = (value: number) => {
    if (!reportTotal) return 0;
    return Math.round((value / reportTotal) * 100);
  };

  const openDetails = (item: InventoryItem, options?: { focusNotes?: boolean }) => {
    setSelectedItem(item);
    setDetailsOpen(true);
    setFocusNotes(Boolean(options?.focusNotes));
    if (isLowStockOpen) setIsLowStockOpen(false);
  };

  const escapeCsv = (value: string | number | null | undefined) => {
    const text = `${value ?? ""}`;
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/\"/g, "\"\"")}"`;
    }
    return text;
  };

  const exportInventory = (format: "csv" | "excel", items = sortedInventory) => {
    if (!items.length) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    const headers = [
      "Product ID",
      "Name",
      "Category",
      "Brand",
      "Model",
      "Total",
      "Available",
      "Borrowed",
      "Damaged",
      "Inactive",
      "Status",
    ];
    const rows = items.map((item) => [
      item.p_id,
      item.name,
      item.category,
      item.brand || "",
      item.model || "",
      item.total,
      item.available,
      item.borrowed,
      item.issue,
      item.inactive,
      getItemStatusMeta(item).label,
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: format === "csv" ? "text/csv;charset=utf-8;" : "application/vnd.ms-excel",
    });
    const link = document.createElement("a");
    const fileName = format === "csv" ? "inventory_export.csv" : "inventory_export.xls";
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success(`ส่งออกข้อมูล ${items.length.toLocaleString()} รายการ`);
  };

  const handleJumpToPage = () => {
    const target = Number(jumpPage);
    if (!Number.isFinite(target)) return;
    const safePage = Math.max(1, Math.min(totalInvPages || 1, target));
    setInvPage(safePage);
    setJumpPage("");
  };

  const toggleLowStockSelection = (id: string) => {
    setLowStockSelected((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleSelectAllLowStock = (items: InventoryItem[]) => {
    if (lowStockSelected.length === items.length) {
      setLowStockSelected([]);
      return;
    }
    setLowStockSelected(items.map((item) => item.id));
  };

  const handleBulkRestock = () => {
    if (!lowStockSelected.length) return;
    toast.success(`สร้างคำขอเติมสต็อก ${lowStockSelected.length} รายการ`);
  };

  const handleBulkNotify = () => {
    if (!lowStockSelected.length) return;
    toast.success(`ส่งแจ้งเตือนซัพพลายเออร์ ${lowStockSelected.length} รายการ`);
  };

  const handleBulkDelete = () => {
    if (!lowStockSelected.length) return;
    if (!confirm("ยืนยันการลบรายการที่เลือกหรือไม่?")) return;
    lowStockSelected.forEach((id) => deleteProduct.mutate(id));
    setLowStockSelected([]);
  };

  const handleCardRestock = (item: InventoryItem) => {
    setLowStockOrderState((prev) => ({ ...prev, [item.id]: "restock" }));
    openDetails(item);
    toast.success(`เริ่มต้นการเติมสต็อก: ${item.name}`);
  };

  const handleCardOrder = (item: InventoryItem) => {
    setLowStockOrderState((prev) => ({ ...prev, [item.id]: "ordered" }));
    toast.success(`สร้างคำสั่งซื้อสินค้า: ${item.name}`);
  };



  // --- Logic ---
  // Filter Inventory Table
  const filteredInventory = useMemo(() => {
    if (!inventorySummary) return [];

    return inventorySummary.filter((item) => {
      if (selectedCategories.length && !selectedCategories.includes(item.category)) return false;

      if (selectedStatuses.length) {
        const statusKey = getItemStatusKey(item);
        if (!selectedStatuses.includes(statusKey)) return false;
      }

      if (hasLocationData && selectedLocations.length) {
        const locationValue = (item as InventoryItem).location || (item as InventoryItem).location_name;
        if (locationValue && !selectedLocations.includes(locationValue)) return false;
      }

      if (!inventorySearch.trim()) return true;

      const searchTerms = inventorySearch.toLowerCase().split(/\s+/).filter(Boolean);
      const itemText = `${item.name} ${item.p_id} ${item.category} ${item.brand || ""} ${item.model || ""}`.toLowerCase();
      return searchTerms.every((term) => itemText.includes(term));
    });
  }, [
    inventorySummary,
    inventorySearch,
    selectedCategories,
    selectedStatuses,
    selectedLocations,
    hasLocationData,
  ]);

  // Filter Low Stock
  const filteredLowStock = useMemo(() => {
    if (!inventorySummary) return [];

    const lowStockItems = inventorySummary.filter((item) => item.available < lowStockThreshold);

    return lowStockItems.filter((item) => {
      if (lowStockCategory !== "all" && item.category !== lowStockCategory) return false;

      if (hasLocationData && lowStockLocation !== "all") {
        const locationValue = (item as InventoryItem).location || (item as InventoryItem).location_name;
        if (locationValue !== lowStockLocation) return false;
      }

      if (!lowStockSearch.trim()) return true;

      const searchTerms = lowStockSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const itemText = `${item.name} ${item.p_id} ${item.category} ${item.brand || ''} ${item.model || ''}`.toLowerCase();
      return searchTerms.every(term => itemText.includes(term));
    });
  }, [inventorySummary, lowStockSearch, lowStockCategory, lowStockLocation, lowStockThreshold, hasLocationData]);

  // --- Reset Pages ---
  useEffect(() => { 
    setInvPage(1); 
    setJumpPage("");
  }, [inventorySearch, selectedCategories, selectedStatuses, selectedLocations, invSort.key, invSort.dir]);
  useEffect(() => {
    setSelectedInventoryIds((prev) =>
      prev.filter((id) => filteredInventory.some((item) => item.id === id))
    );
  }, [filteredInventory]);
  useEffect(() => { 
    setLowStockPage(1); 
    setLowStockSelected([]); 
  }, [lowStockSearch, lowStockCategory, lowStockLocation, lowStockThreshold, lowStockSort]);
  useEffect(() => {
    if (isLowStockOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup function: คืนค่าเมื่อ component ถูก destroy
    return () => { document.body.style.overflow = 'unset'; };
  }, [isLowStockOpen]);

  useEffect(() => {
    if (!isLowStockOpen || !lowStockAutoRefresh) return;
    const interval = setInterval(() => {
      refetchInventory();
    }, 30000);
    return () => clearInterval(interval);
  }, [isLowStockOpen, lowStockAutoRefresh, refetchInventory]);

  useEffect(() => {
    if (!autoRefreshInventory) return;
    const interval = setInterval(() => {
      refetchInventory();
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefreshInventory, refetchInventory]);

  const openImagePreview = (src: string | null | undefined, name?: string) => {
    if (!src) return;
    setImagePreview({ open: true, src, name: name || "Image preview" });
  };

  useEffect(() => {
    if (!imagePreview.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImagePreview({ open: false, src: "", name: "" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imagePreview.open]);

  useEffect(() => {
    if (!detailsOpen || !selectedItem) return;
    let mounted = true;
    setDetailLoading(true);
    supabase
      .from("view_products_with_stock")
      .select(
        "id,p_id,name,category,brand,model,description,notes,price,unit,image_url,stock_total,stock_available"
      )
      .eq("id", selectedItem.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("Load product detail failed:", error);
          if (
            error.code === "PGRST116" ||
            error.message?.toLowerCase().includes("single json object") ||
            (error.message?.toLowerCase().includes("multiple") && error.message?.toLowerCase().includes("rows"))
          ) {
            toast.error("พบข้อมูลสินค้าซ้ำซ้อน กรุณาตรวจสอบข้อมูลในระบบ");
          } else {
            toast.error("โหลดรายละเอียดสินค้าไม่สำเร็จ");
          }
          setDetailProduct(null);
          return;
        }
        if (!data) {
          // maybeSingle() returns null for 0 rows; handle explicitly instead of coercion error.
          toast.error("ไม่พบรายละเอียดสินค้าที่ต้องการ");
          setDetailProduct(null);
          return;
        }
        const detail = data as ProductWithStock;
        setDetailProduct(detail);
        setDetailForm({
          p_id: detail.p_id,
          name: detail.name,
          category: detail.category,
          brand: detail.brand || "",
          model: detail.model || "",
          description: detail.description || "",
          notes: detail.notes || "",
          price: String(detail.price ?? 0),
          unit: detail.unit || "",
          image_url: detail.image_url || "",
          initial_quantity: String(detail.stock_total ?? 0),
        });
      })
      .finally(() => {
        if (mounted) setDetailLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [detailsOpen, selectedItem]);

  useEffect(() => {
    if (!detailsOpen) {
      setSelectedItem(null);
      setDetailProduct(null);
      setFocusNotes(false);
    }
  }, [detailsOpen]);

  useEffect(() => {
    if (detailsOpen && focusNotes && notesRef.current) {
      notesRef.current.focus();
    }
  }, [detailsOpen, focusNotes]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    // Filter ของหน้าหลัก
    if (inventorySearch) params.set("q", inventorySearch);
    else params.delete("q");

    if (selectedCategories.length) params.set("cat", selectedCategories.join(","));
    else params.delete("cat");

    if (selectedStatuses.length) params.set("status", selectedStatuses.join(","));
    else params.delete("status");

    if (selectedLocations.length) params.set("loc", selectedLocations.join(","));
    else params.delete("loc");

    if (inventoryView !== "cards") params.set("view", inventoryView);
    else params.delete("view");

    if (!autoRefreshInventory) params.set("live", "0");
    else params.delete("live");

    if (invSort.key !== "available" || invSort.dir !== "desc") params.set("sort", `${invSort.key}:${invSort.dir}`);
    else params.delete("sort");

    // Filter ของ Low Stock Modal
    if (isLowStockOpen) {
      params.set("modal", "lowstock");
      if (lowStockSearch) params.set("ls_q", lowStockSearch);
      else params.delete("ls_q");
      if (lowStockCategory !== "all") params.set("ls_cat", lowStockCategory);
      else params.delete("ls_cat");
      if (lowStockLocation !== "all") params.set("ls_loc", lowStockLocation);
      else params.delete("ls_loc");
      if (lowStockThreshold !== 1) params.set("ls_th", String(lowStockThreshold));
      else params.delete("ls_th");
      if (lowStockSort !== "available:asc") params.set("ls_sort", lowStockSort);
      else params.delete("ls_sort");
      if (!lowStockAutoRefresh) params.set("ls_auto", "0");
      else params.delete("ls_auto");
    } else {
      params.delete("modal");
      params.delete("ls_q");
      params.delete("ls_cat");
      params.delete("ls_loc");
      params.delete("ls_th");
      params.delete("ls_sort");
      params.delete("ls_auto");
    }

    setSearchParams(params, { replace: true });
    
  }, [
    inventorySearch,
    selectedCategories,
    selectedStatuses,
    selectedLocations,
    inventoryView,
    autoRefreshInventory,
    invSort.key,
    invSort.dir,
    isLowStockOpen,
    lowStockSearch,
    lowStockCategory,
    lowStockLocation,
    lowStockThreshold,
    lowStockSort,
    lowStockAutoRefresh,
    setSearchParams,
  ]);

    

  // Pagination
  const getPaginationItems = (currentPage: number, totalPages: number) => {
    // 1. ถ้ารวมทั้งหมดมีน้อยกว่า 7 หน้า ให้โชว์หมดเลย ไม่ต้องย่อ (เช่น 1 2 3 4 5 6)
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // 2. กรณีอยู่ช่วงต้น (หน้า 1-4): ให้โชว์ยาวไปถึง 5 แล้วค่อย ... หน้าสุดท้าย
    // แก้ปัญหา: อยู่หน้า 3 แล้วไม่เห็นหน้า 4
    // ผลลัพธ์: [1, 2, 3, 4, 5, ..., 100]
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
    }

    // 3. กรณีอยู่ช่วงท้าย (4 หน้าสุดท้าย): ให้โชว์หน้าแรก ... แล้วไล่ยาวจบ
    // ผลลัพธ์: [1, ..., 96, 97, 98, 99, 100]
    if (currentPage >= totalPages - 3) {
      return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    // 4. กรณีอยู่ตรงกลาง: โชว์หน้าแรก ... (หน้าก่อน)-(ปัจจุบัน)-(หน้าถัดไป) ... หน้าสุดท้าย
    // ผลลัพธ์ (สมมติอยู่หน้า 10): [1, ..., 9, 10, 11, ..., 100]
    return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
  };

  const renderPagination = (page: number, setPage: (p: number) => void, totalPages: number) => {
    if (totalPages <= 1) return null;
    return (
      <Pagination className="justify-center sm:justify-end w-auto mx-0">
        <PaginationContent className="gap-1">
          <PaginationItem>
            <PaginationPrevious 
              href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }} 
              className={cn("h-8 w-8 p-0 sm:w-auto sm:px-3 sm:py-2", page === 1 && "pointer-events-none opacity-50")}
            >
              <span className="sr-only sm:not-sr-only sm:ml-2">ก่อนหน้า</span>
            </PaginationPrevious>
          </PaginationItem>
          {getPaginationItems(page, totalPages).map((p, i) => (
            <PaginationItem key={i}>
              {p === 'ellipsis' ? <PaginationEllipsis className="h-8 w-4 sm:w-8" /> : (
                <PaginationLink 
                   href="#" 
                   isActive={page === p} 
                   onClick={(e) => { e.preventDefault(); setPage(p as number); }}
                   className="h-8 w-8 sm:w-9 sm:h-9 text-xs sm:text-sm"
                >
                  {p}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext 
              href="#" onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
              className={cn("h-8 w-8 p-0 sm:w-auto sm:px-3 sm:py-2", page === totalPages && "pointer-events-none opacity-50")}
            >
              <span className="sr-only sm:not-sr-only sm:mr-2">ถัดไป</span>
            </PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  // --- Pagination Slicing ---
  const sortedInventory = useMemo(() => {
    const items = [...filteredInventory];
    const dir = invSort.dir === "asc" ? 1 : -1;
    items.sort((a, b) => {
      if (invSort.key === "name") return dir * a.name.localeCompare(b.name, "th");
      if (invSort.key === "p_id") return dir * a.p_id.localeCompare(b.p_id, "th");
      const aNum = Number((a as any)[invSort.key] ?? 0);
      const bNum = Number((b as any)[invSort.key] ?? 0);
      return dir * (aNum - bNum);
    });
    return items;
  }, [filteredInventory, invSort.key, invSort.dir]);

  const paginatedInventory = sortedInventory.slice((invPage - 1) * INV_ITEMS_PER_PAGE, invPage * INV_ITEMS_PER_PAGE);
  const totalInvPages = Math.ceil(sortedInventory.length / INV_ITEMS_PER_PAGE);

  const selectedInventoryItems = useMemo(
    () => sortedInventory.filter((item) => selectedInventoryIds.includes(item.id)),
    [sortedInventory, selectedInventoryIds]
  );
  const isPageSelected =
    paginatedInventory.length > 0 &&
    paginatedInventory.every((item) => selectedInventoryIds.includes(item.id));

  const toggleSelectPage = () => {
    const pageIds = paginatedInventory.map((item) => item.id);
    if (isPageSelected) {
      setSelectedInventoryIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedInventoryIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleSortToggle = (key: InvSortKey) => {
    setInvSort((prev) => ({
      key,
      dir: prev.key === key ? (prev.dir === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleBulkInventoryRestock = () => {
    if (!selectedInventoryItems.length) return;
    toast.success(`สร้างคำขอเติมสต็อก ${selectedInventoryItems.length} รายการ`);
  };

  const handleBulkInventoryRepair = () => {
    if (!selectedInventoryItems.length) return;
    toast.success(`ส่งซ่อม ${selectedInventoryItems.length} รายการ`);
  };

  const paginatedTransactions = recentTransactions?.slice((txPage - 1) * TX_ITEMS_PER_PAGE, txPage * TX_ITEMS_PER_PAGE) || [];
  const totalTxPages = Math.ceil((recentTransactions?.length || 0) / TX_ITEMS_PER_PAGE);

  const sortedLowStock = useMemo(() => {
    const items = [...filteredLowStock];
    items.sort((a, b) => {
      const [key, dir] = lowStockSort.split(":");
      const direction = dir === "desc" ? -1 : 1;
      if (key === "available") {
        if (a.available !== b.available) return direction * (a.available - b.available);
        return direction * a.name.localeCompare(b.name, "th");
      }
      if (key === "name") {
        return direction * a.name.localeCompare(b.name, "th");
      }
      if (key === "category") {
        return direction * a.category.localeCompare(b.category, "th");
      }
      return direction * a.name.localeCompare(b.name, "th");
    });
    return items;
  }, [filteredLowStock, lowStockSort]);

  const paginatedLowStock = sortedLowStock.slice((lowStockPage - 1) * LOW_STOCK_ITEMS_PER_PAGE, lowStockPage * LOW_STOCK_ITEMS_PER_PAGE);
  const totalLowStockPages = Math.ceil(sortedLowStock.length / LOW_STOCK_ITEMS_PER_PAGE);
  const lowStockPreview = useMemo(() => sortedLowStock.slice(0, 4), [sortedLowStock]);

  const formatDate = (dateString: string) => format(new Date(dateString), 'd MMM HH:mm', { locale: th });

  const isInventoryLoading = inventoryLoading;

  const detailTransactions = useMemo(() => {
    if (!selectedItem) return [];
    return (recentTransactions || []).filter(
      (tx) => tx.product_serials?.products?.p_id === selectedItem.p_id
    );
  }, [recentTransactions, selectedItem]);

  const activeTransaction = detailTransactions.find(
    (tx) => tx.status === "Active" || tx.status === "PendingReturn"
  );

  const handleQuickUpdate = () => {
    if (!detailProduct) return;
    updateProduct.mutate(
      {
        id: detailProduct.id,
        current_quantity: detailProduct.stock_total || 0,
        p_id: detailForm.p_id,
        name: detailForm.name,
        category: detailForm.category,
        brand: detailForm.brand,
        model: detailForm.model,
        description: detailForm.description,
        notes: detailForm.notes,
        price: Number(detailForm.price) || 0,
        unit: detailForm.unit,
        image_url: detailForm.image_url,
        initial_quantity: Number(detailForm.initial_quantity) || 0,
      },
      {
        onSuccess: () => {
          setDetailProduct((prev) =>
            prev
              ? {
                  ...prev,
                  stock_total: Number(detailForm.initial_quantity) || prev.stock_total,
                  notes: detailForm.notes,
                }
              : prev
          );
        },
      }
    );
  };

  const handleDeleteItem = (item: InventoryItem) => {
    if (!confirm("ยืนยันการลบสินค้านี้หรือไม่?")) return;
    deleteProduct.mutate(item.id);
    if (selectedItem?.id === item.id) setDetailsOpen(false);
  };

  const lowStockAlertCard = (
    <Card className="rounded-2xl border-red-200 bg-red-50/20 shadow-sm">
      <div className="px-4 py-3 border-b border-red-100 bg-red-50/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" />
            เตือนสต็อกใกล้หมด
          </div>
          <div className="flex items-center gap-2">
            {!alertsDismissed && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700"
                onClick={() => setAlertsDismissed(true)}
              >
                ล้างแจ้งเตือน
              </Button>
            )}
            <Badge variant="destructive" className="h-5 px-1.5">
              {alertsDismissed ? 0 : filteredLowStock.length}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[10px] border-red-200 text-red-600"
              onClick={() => setIsLowStockOpen(true)}
            >
              ดูทั้งหมด
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3" onClick={(e) => e.stopPropagation()}>
          <Select value={lowStockCategory} onValueChange={setLowStockCategory}>
            <SelectTrigger className="h-8 text-[10px] bg-white">
              <SelectValue placeholder="หมวดหมู่" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lowStockThresholdSelectValue} onValueChange={handleLowStockThresholdChange}>
            <SelectTrigger className="h-8 text-[10px] bg-white">
              <SelectValue placeholder="เกณฑ์คงเหลือ" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              {thresholdOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isCustomLowStockThreshold && (
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className="h-8 text-[10px] bg-white"
              placeholder="ใส่จำนวน"
              value={customLowStockThresholdInput}
              onChange={(e) => handleCustomLowStockThresholdChange(e.target.value)}
            />
          )}
          <Select value={lowStockSort} onValueChange={setLowStockSort}>
            <SelectTrigger className="h-8 text-[10px] bg-white">
              <SelectValue placeholder="เรียงตาม" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="available:asc">คงเหลือน้อยสุด</SelectItem>
              <SelectItem value="available:desc">คงเหลือมากสุด</SelectItem>
              <SelectItem value="name:asc">ชื่อ (A-Z)</SelectItem>
              <SelectItem value="category:asc">หมวดหมู่ (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <CardContent className="p-0">
        <ScrollArea className="h-[260px]">
          {alertsDismissed ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8 text-xs">
              <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
              แจ้งเตือนถูกซ่อนแล้ว
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto p-0 text-[10px]"
                onClick={() => setAlertsDismissed(false)}
              >
                ยกเลิกการซ่อน
              </Button>
            </div>
          ) : lowStockPreview.length > 0 ? (
            <div className="grid gap-3 p-3">
              {lowStockPreview.map((item) => {
                const meta = getLowStockMeta(item);
                const percent = getStockPercent(item);
                return (
                  <div
                    key={item.id}
                    className="group rounded-xl border bg-white/90 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    onClick={() => openDetails(item)}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        className={cn(
                          "group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-white transition",
                          item.image ? "cursor-pointer hover:shadow-md" : "cursor-default"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          openImagePreview(item.image, item.name);
                        }}
                        aria-label="View product image"
                        disabled={!item.image}
                      >
                        {item.image ? (
                          <>
                            <img
                              src={item.image}
                              alt={item.name}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
                          </>
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-300" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono truncate">{item.p_id}</div>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] font-semibold", meta.className)}>
                            <span className={cn("mr-1 h-2 w-2 rounded-full", meta.dot)} />
                            {meta.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">คงเหลือ</span>
                          <span className="font-semibold text-rose-600">{item.available}</span>
                        </div>
                        <Progress value={percent} className="h-1.5" />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 transition-transform hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(item);
                        }}
                        title="View Product"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 transition-transform hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(item);
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 transition-transform hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardRestock(item);
                        }}
                        title="Restock"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 transition-transform hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardOrder(item);
                        }}
                        title="Reorder"
                      >
                        <Truck className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 transition-transform hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(item);
                        }}
                        title="History"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8 text-xs">
              <Package className="h-8 w-8 mb-2 opacity-20" />
              สต็อกเพียงพอทุกรายการ
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <MainLayout title="ภาพรวมระบบ">
      <div className="space-y-6 pb-24 sm:pb-10">
        
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-orange-50 via-white to-sky-50 p-5 shadow-sm sm:p-6">
          <div className="absolute -right-20 -top-16 h-40 w-40 rounded-full bg-orange-200/40 blur-3xl" />
          <div className="absolute -left-24 -bottom-16 h-40 w-40 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
                  <Box className="h-4 w-4" />
                  Inventory Pulse
                </div>
                <h2 className="text-xl font-semibold text-foreground">ภาพรวมคลังและการใช้งานล่าสุด</h2>
                <p className="text-sm text-muted-foreground">
                  ติดตามสถานะทรัพย์สินแบบเรียลไทม์ พร้อมการจัดการที่รวดเร็วขึ้น
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild className="h-11 rounded-full px-5 text-sm shadow-sm">
                  <Link to="/products?modal=import">
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="h-11 rounded-full px-5 text-sm shadow-sm">
                      <FileDown className="h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportInventory("csv")}>
                      <FileDown className="mr-2 h-4 w-4" />
                      Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportInventory("excel")}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Export Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {statsLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                  ))
                : summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.title} className="rounded-2xl border bg-white/80 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
                            <p className="mt-2 text-2xl font-semibold text-foreground">
                              {Number(card.value || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">{card.helper}</p>
                          </div>
                          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", card.tone)}>
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 items-stretch">
          <Card className="h-full overflow-hidden rounded-2xl border shadow-sm">
            <div className="border-b bg-muted/20 px-4 py-3 sm:px-6">
              <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Borrowing Status Report</CardTitle>
              <CardDescription className="text-[13px] leading-relaxed sm:text-sm">สรุปการยืม-คืนและสถานะทรัพย์สิน</CardDescription>
            </div>
            <CardContent className="grid gap-4 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-6">
              <div className="min-w-0 flex items-center justify-center">
                {reportTotal > 0 ? (
                  <ChartContainer config={statusChartConfig} className="h-[210px] w-full sm:h-[220px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={statusReportData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {statusReportData.map((entry) => (
                          <Cell key={entry.name} fill={`var(--color-${entry.name})`} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[220px] w-full items-center justify-center rounded-xl border border-dashed bg-muted/10 text-sm text-muted-foreground">
                    ไม่มีข้อมูลสถานะ
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-3 sm:space-y-3.5">
                {statusReportData.map((entry) => {
                  const label = statusChartConfig[entry.name as keyof typeof statusChartConfig]?.label || entry.name;
                  return (
                    <div key={entry.name} className="space-y-1.5">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <span className="block min-w-0 truncate text-[13px] font-semibold leading-5 sm:text-sm">{label}</span>
                        <span className="shrink-0 font-mono tabular-nums text-[12px] text-muted-foreground sm:text-sm">
                          {entry.value.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={getReportPercent(entry.value)} className="h-1.5 sm:h-2" />
                    </div>
                  );
                })}
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-[12px] sm:text-[13px]">
                {statusReportData.map((entry) => {
                  const itemConfig = statusChartConfig[entry.name as keyof typeof statusChartConfig];
                  const label = itemConfig?.label || entry.name;
                  return (
                    <div key={`legend-${entry.name}`} className="flex items-center gap-2 whitespace-nowrap text-foreground/90">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: itemConfig?.color || "hsl(var(--muted-foreground))" }}
                      />
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="h-full rounded-2xl border-red-200 bg-red-50/20 shadow-sm">
            <div className="px-4 py-3 border-b border-red-100 bg-red-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  เตือนสต็อกใกล้หมด
                </div>
                <div className="flex items-center gap-2">
                  {!alertsDismissed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700"
                      onClick={() => setAlertsDismissed(true)}
                    >
                      ล้างแจ้งเตือน
                    </Button>
                  )}
                  <Badge variant="destructive" className="h-5 px-1.5">
                    {alertsDismissed ? 0 : filteredLowStock.length}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[10px] border-red-200 text-red-600"
                    onClick={() => setIsLowStockOpen(true)}
                  >
                    ดูทั้งหมด
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3" onClick={(e) => e.stopPropagation()}>
                <Select value={lowStockCategory} onValueChange={setLowStockCategory}>
                  <SelectTrigger className="h-8 text-[10px] bg-white">
                    <SelectValue placeholder="หมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={lowStockThresholdSelectValue} onValueChange={handleLowStockThresholdChange}>
                  <SelectTrigger className="h-8 text-[10px] bg-white">
                    <SelectValue placeholder="เกณฑ์คงเหลือ" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {thresholdOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCustomLowStockThreshold && (
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className="h-8 text-[10px] bg-white"
                    placeholder="ใส่จำนวน"
                    value={customLowStockThresholdInput}
                    onChange={(e) => handleCustomLowStockThresholdChange(e.target.value)}
                  />
                )}
                <Select value={lowStockSort} onValueChange={setLowStockSort}>
                  <SelectTrigger className="h-8 text-[10px] bg-white">
                    <SelectValue placeholder="เรียงตาม" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="available:asc">คงเหลือน้อยสุด</SelectItem>
                    <SelectItem value="available:desc">คงเหลือมากสุด</SelectItem>
                    <SelectItem value="name:asc">ชื่อ (A-Z)</SelectItem>
                    <SelectItem value="category:asc">หมวดหมู่ (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CardContent className="p-0">
              <ScrollArea className="h-[220px] sm:h-[240px]">
                {alertsDismissed ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8 text-xs">
                    <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
                    แจ้งเตือนถูกซ่อนแล้ว
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2 h-auto p-0 text-[10px]"
                      onClick={() => setAlertsDismissed(false)}
                    >
                      ยกเลิกการซ่อน
                    </Button>
                  </div>
                ) : lowStockPreview.length > 0 ? (
                  <div className="grid gap-3 p-3">
                    {lowStockPreview.map((item) => {
                      const meta = getLowStockMeta(item);
                      const percent = getStockPercent(item);
                      return (
                        <div
                          key={item.id}
                          className="group rounded-xl border bg-white/90 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                          onClick={() => openDetails(item)}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              className={cn(
                                "group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-white transition",
                                item.image ? "cursor-pointer hover:shadow-md" : "cursor-default"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                openImagePreview(item.image, item.name);
                              }}
                              aria-label="View product image"
                              disabled={!item.image}
                            >
                              {item.image ? (
                                <>
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                  <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
                                </>
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-300" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{item.name}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono truncate">{item.p_id}</div>
                                </div>
                                <Badge variant="outline" className={cn("text-[10px] font-semibold", meta.className)}>
                                  <span className={cn("mr-1 h-2 w-2 rounded-full", meta.dot)} />
                                  {meta.label}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">คงเหลือ</span>
                                <span className="font-semibold text-rose-600">{item.available}</span>
                              </div>
                              <Progress value={percent} className="h-1.5" />
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 transition-transform hover:scale-105"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(item);
                              }}
                              title="View Product"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 transition-transform hover:scale-105"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(item);
                              }}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 transition-transform hover:scale-105"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardRestock(item);
                              }}
                              title="Restock"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 transition-transform hover:scale-105"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardOrder(item);
                              }}
                              title="Reorder"
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 transition-transform hover:scale-105"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(item);
                              }}
                              title="History"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8 text-xs">
                    <Package className="h-8 w-8 mb-2 opacity-20" />
                    สต็อกเพียงพอทุกรายการ
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-7 items-start">
          
          {/* Product Overview */}
          <div className="order-2 col-span-1 md:col-span-7 lg:col-span-7 space-y-4 min-w-0">
            <Card className="overflow-hidden rounded-2xl border shadow-sm">
              <Tabs
                value={inventoryView}
                onValueChange={(value) => setInventoryView(value as "cards" | "table")}
                className="w-full"
              >
              <div className="border-b bg-gradient-to-br from-white via-slate-50 to-slate-100/60 px-4 py-5 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1.5">
                    <CardTitle className="text-lg sm:text-xl font-semibold tracking-tight flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      Product Overview
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                      จัดการสินค้าแบบแฟลชการ์ด พร้อมฟิลเตอร์หลายเงื่อนไขและการดำเนินการทันที
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="h-7 px-3 text-xs font-semibold shadow-sm transition-colors">
                      {filteredInventory.length.toLocaleString()} รายการ
                    </Badge>
                    <div
                      className={cn(
                        "hidden sm:flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] transition-all",
                        autoRefreshInventory
                          ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                          : "bg-white text-muted-foreground"
                      )}
                    >
                      <span className="relative flex h-2 w-2">
                        {autoRefreshInventory && (
                          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping" />
                        )}
                        <span
                          className={cn(
                            "relative inline-flex h-2 w-2 rounded-full",
                            autoRefreshInventory ? "bg-emerald-500" : "bg-slate-300"
                          )}
                        />
                      </span>
                      <Switch checked={autoRefreshInventory} onCheckedChange={setAutoRefreshInventory} />
                      <span className="font-medium">{autoRefreshInventory ? "Live" : "Paused"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border bg-white/75 p-4 shadow-sm backdrop-blur">
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Search
                        </span>
                        <div className="relative w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="ค้นหาสินค้า, รหัส, หมวดหมู่..."
                            className="h-11 w-full rounded-xl border border-border/70 bg-white pl-10 text-sm shadow-sm transition-shadow duration-200 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
                            value={inventorySearch}
                            onChange={(e) => setInventorySearch(e.target.value)}
                          />
                          {inventorySearch && (
                            <button
                              type="button"
                              onClick={() => setInventorySearch("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors duration-200 motion-reduce:transition-none hover:bg-muted/70 hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl bg-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Filters
                          </span>
                          {hasActiveFilters && (
                            <Badge variant="secondary" className="h-6 px-2 text-[10px] animate-in fade-in-0">
                              ใช้งาน {activeFilterCount} ตัวกรอง
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "h-11 gap-2 rounded-xl border border-border/70 bg-white text-xs shadow-sm transition-[background-color,border-color,box-shadow,color] duration-200 motion-reduce:transition-none hover:bg-muted/20 hover:shadow-sm",
                                  selectedCategories.length > 0 && "border-primary/40 bg-primary/5 text-primary"
                                )}
                              >
                                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                หมวดหมู่
                                {selectedCategories.length > 0 && (
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                    {selectedCategories.length}
                                  </Badge>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">หมวดหมู่</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => setSelectedCategories([])}
                                >
                                  ล้าง
                                </Button>
                              </div>
                              <div className="mt-2 max-h-56 space-y-2 overflow-auto">
                                {categoryOptions.length > 0 ? (
                                  categoryOptions.map((cat) => (
                                    <label key={cat} className="flex items-center gap-2 text-xs">
                                      <Checkbox
                                        checked={selectedCategories.includes(cat)}
                                        onCheckedChange={(checked) => {
                                          const isChecked = checked === true;
                                          setSelectedCategories((prev) =>
                                            isChecked ? [...prev, cat] : prev.filter((c) => c !== cat)
                                          );
                                        }}
                                      />
                                      <span className="truncate">{cat}</span>
                                    </label>
                                  ))
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">ไม่มีข้อมูลหมวดหมู่</div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "h-11 gap-2 rounded-xl border border-border/70 bg-white text-xs shadow-sm transition-[background-color,border-color,box-shadow,color] duration-200 motion-reduce:transition-none hover:bg-muted/20 hover:shadow-sm",
                                  selectedStatuses.length > 0 && "border-primary/40 bg-primary/5 text-primary"
                                )}
                              >
                                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                สถานะ
                                {selectedStatuses.length > 0 && (
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                    {selectedStatuses.length}
                                  </Badge>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">สถานะสินค้า</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => setSelectedStatuses([])}
                                >
                                  ล้าง
                                </Button>
                              </div>
                              <div className="mt-2 max-h-56 space-y-2 overflow-auto">
                                {statusOptions.map((status) => (
                                  <label key={status.value} className="flex items-center gap-2 text-xs">
                                    <Checkbox
                                      checked={selectedStatuses.includes(status.value)}
                                      onCheckedChange={(checked) => {
                                        const isChecked = checked === true;
                                        setSelectedStatuses((prev) =>
                                          isChecked
                                            ? [...prev, status.value]
                                            : prev.filter((value) => value !== status.value)
                                        );
                                      }}
                                    />
                                    <span>{status.label}</span>
                                  </label>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "h-11 gap-2 rounded-xl border border-border/70 bg-white text-xs shadow-sm transition-[background-color,border-color,box-shadow,color] duration-200 motion-reduce:transition-none hover:bg-muted/20 hover:shadow-sm",
                                  !hasLocationData && "opacity-60",
                                  selectedLocations.length > 0 && "border-primary/40 bg-primary/5 text-primary"
                                )}
                                disabled={!hasLocationData}
                              >
                                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                ตำแหน่ง
                                {selectedLocations.length > 0 && (
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                    {selectedLocations.length}
                                  </Badge>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">ตำแหน่ง</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => setSelectedLocations([])}
                                >
                                  ล้าง
                                </Button>
                              </div>
                              <div className="mt-2 max-h-56 space-y-2 overflow-auto">
                                {hasLocationData ? (
                                  locationOptions.map((loc) => (
                                    <label key={loc} className="flex items-center gap-2 text-xs">
                                      <Checkbox
                                        checked={selectedLocations.includes(loc)}
                                        onCheckedChange={(checked) => {
                                          const isChecked = checked === true;
                                          setSelectedLocations((prev) =>
                                            isChecked ? [...prev, loc] : prev.filter((value) => value !== loc)
                                          );
                                        }}
                                      />
                                      <span>{loc}</span>
                                    </label>
                                  ))
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">ยังไม่มีข้อมูลตำแหน่ง</div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="border-t border-border/70 pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            View Options
                          </span>

                          <TabsList className="h-11 rounded-xl bg-muted/40 p-1 shadow-inner">
                            <TabsTrigger
                              value="cards"
                              className="h-9 gap-1 rounded-lg px-3 text-xs transition-[background-color,box-shadow,color] duration-200 motion-reduce:transition-none data-[state=active]:bg-white data-[state=active]:shadow-sm"
                            >
                              <LayoutGrid className="h-3.5 w-3.5" />
                              Cards
                            </TabsTrigger>
                            <TabsTrigger
                              value="table"
                              className="h-9 gap-1 rounded-lg px-3 text-xs transition-[background-color,box-shadow,color] duration-200 motion-reduce:transition-none data-[state=active]:bg-white data-[state=active]:shadow-sm"
                            >
                              <List className="h-3.5 w-3.5" />
                              List
                            </TabsTrigger>
                          </TabsList>

                          <Select
                            value={`${invSort.key}:${invSort.dir}`}
                            onValueChange={(value) => {
                              const [key, dir] = value.split(":");
                              setInvSort({ key: key as InvSortKey, dir: dir as InvSortDir });
                            }}
                          >
                            <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-white text-xs shadow-sm transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30 sm:w-auto sm:min-w-[220px] sm:text-sm">
                              <div className="flex items-center gap-2 truncate">
                                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="เรียงลำดับ" />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="available:desc">พร้อมใช้ (มาก-น้อย)</SelectItem>
                              <SelectItem value="available:asc">พร้อมใช้ (น้อย-มาก)</SelectItem>
                              <SelectItem value="name:asc">ชื่อ (A-Z)</SelectItem>
                              <SelectItem value="name:desc">ชื่อ (Z-A)</SelectItem>
                              <SelectItem value="p_id:asc">รหัส (A-Z)</SelectItem>
                              <SelectItem value="p_id:desc">รหัส (Z-A)</SelectItem>
                              <SelectItem value="borrowed:desc">ถูกยืม (มาก-น้อย)</SelectItem>
                              <SelectItem value="issue:desc">ซ่อม/เสีย (มาก-น้อย)</SelectItem>
                              <SelectItem value="inactive:desc">เลิกใช้ (มาก-น้อย)</SelectItem>
                              <SelectItem value="total:desc">ทั้งหมด (มาก-น้อย)</SelectItem>
                            </SelectContent>
                          </Select>

                          <div
                            className={cn(
                              "ml-auto flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] transition-colors duration-200 sm:hidden",
                              autoRefreshInventory
                                ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                                : "bg-white text-muted-foreground"
                            )}
                          >
                            <span className="relative flex h-2 w-2">
                              {autoRefreshInventory && (
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping" />
                              )}
                              <span
                                className={cn(
                                  "relative inline-flex h-2 w-2 rounded-full",
                                  autoRefreshInventory ? "bg-emerald-500" : "bg-slate-300"
                                )}
                              />
                            </span>
                            <Switch checked={autoRefreshInventory} onCheckedChange={setAutoRefreshInventory} />
                            <span className="font-medium">{autoRefreshInventory ? "Live" : "Paused"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-white/80 px-3 py-2 text-[11px] shadow-sm animate-in fade-in-0">
                      <span className="text-muted-foreground">ตัวกรองที่ใช้งาน</span>
                      {inventorySearch.trim() && (
                        <button
                          type="button"
                          className={activeChipClass}
                          onClick={() => setInventorySearch("")}
                        >
                          ค้นหา:
                          <span className="max-w-[140px] truncate font-medium">{inventorySearch}</span>
                          <X className="h-3 w-3 opacity-60 transition group-hover:opacity-100" />
                        </button>
                      )}
                      {selectedCategories.map((cat) => (
                        <button
                          key={`cat-${cat}`}
                          type="button"
                          className={activeChipClass}
                          onClick={() => setSelectedCategories((prev) => prev.filter((value) => value !== cat))}
                        >
                          หมวดหมู่:
                          <span className="max-w-[140px] truncate font-medium">{cat}</span>
                          <X className="h-3 w-3 opacity-60 transition group-hover:opacity-100" />
                        </button>
                      ))}
                      {selectedStatuses.map((status) => {
                        const statusLabel = statusOptions.find((option) => option.value === status)?.label || status;
                        return (
                          <button
                            key={`status-${status}`}
                            type="button"
                            className={activeChipClass}
                            onClick={() => setSelectedStatuses((prev) => prev.filter((value) => value !== status))}
                          >
                            สถานะ:
                            <span className="max-w-[140px] truncate font-medium">{statusLabel}</span>
                            <X className="h-3 w-3 opacity-60 transition group-hover:opacity-100" />
                          </button>
                        );
                      })}
                      {selectedLocations.map((loc) => (
                        <button
                          key={`loc-${loc}`}
                          type="button"
                          className={activeChipClass}
                          onClick={() => setSelectedLocations((prev) => prev.filter((value) => value !== loc))}
                        >
                          ตำแหน่ง:
                          <span className="max-w-[140px] truncate font-medium">{loc}</span>
                          <X className="h-3 w-3 opacity-60 transition group-hover:opacity-100" />
                        </button>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                          setSelectedCategories([]);
                          setSelectedStatuses([]);
                          setSelectedLocations([]);
                          setInventorySearch("");
                        }}
                      >
                        ล้างทั้งหมด
                      </Button>
                    </div>
                  )}

                  {selectedInventoryIds.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/80 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox checked={isPageSelected} onCheckedChange={() => toggleSelectPage()} />
                        เลือกหน้านี้
                        <span className="text-foreground font-medium">
                          เลือก {selectedInventoryIds.length} รายการ
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" className="h-8" onClick={handleBulkInventoryRestock}>
                          <Plus className="h-4 w-4" />
                          Restock
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={handleBulkInventoryRepair}>
                          <Wrench className="h-4 w-4" />
                          Send for repair
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8">
                              <FileDown className="h-4 w-4" />
                              Export Selected
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => exportInventory("csv", selectedInventoryItems)}>
                              <FileDown className="mr-2 h-4 w-4" />
                              Export CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportInventory("excel", selectedInventoryItems)}>
                              <FileSpreadsheet className="mr-2 h-4 w-4" />
                              Export Excel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedInventoryIds([])}>
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <CardContent className="p-4 sm:p-6">
                <TabsContent
                  value="cards"
                  className="mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2"
                >
                  {isInventoryLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-52 w-full rounded-2xl" />
                      ))}
                    </div>
                  ) : paginatedInventory.length > 0 ? (
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {paginatedInventory.map((item) => {
                        const statusMeta = getUsageStatusMeta(item);
                        return (
                          <Card
                            key={item.id}
                            className="group relative overflow-hidden rounded-2xl border bg-white/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                          >
                            <CardContent className="p-4 sm:p-5">
                              <button
                                type="button"
                                className={cn(
                                  "group relative w-full overflow-hidden rounded-2xl border bg-muted/10 transition",
                                  item.image ? "cursor-pointer hover:shadow-md" : "cursor-default"
                                )}
                                onClick={() => openDetails(item)}
                                aria-label={`View details for ${item.name}`}
                              >
                                <div className="w-full aspect-square flex items-center justify-center">
                                  {item.image ? (
                                    <>
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        loading="lazy"
                                        decoding="async"
                                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                      />
                                      <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                                    </>
                                  ) : (
                                    <Package className="h-8 w-8 text-muted-foreground/40" />
                                  )}
                                </div>
                              </button>

                              <div className="mt-3 space-y-1">
                                <button
                                  type="button"
                                  className="w-full text-left text-sm font-semibold text-foreground tracking-tight sm:text-base"
                                  onClick={() => openDetails(item)}
                                  title={item.name}
                                >
                                  {item.name}
                                </button>
                                <div className="text-xs text-muted-foreground font-mono">
                                  รหัสสินค้า: {item.p_id}
                                </div>
                                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold", statusMeta.className)}>
                                  {statusMeta.label}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10 p-10 text-sm text-muted-foreground">
                      <Package className="h-10 w-10 mb-2 opacity-20" />
                      ไม่พบรายการ
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="table"
                  className="mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2"
                >
                  {isInventoryLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : paginatedInventory.length > 0 ? (
                    <div className="rounded-2xl border bg-white/95 shadow-sm overflow-hidden">
                      <Table className="min-w-full">
                        <TableHeader className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 px-3">
                              <Checkbox checked={isPageSelected} onCheckedChange={() => toggleSelectPage()} />
                            </TableHead>
                            <TableHead className="px-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-[11px] font-semibold"
                                onClick={() => handleSortToggle("name")}
                              >
                                สินค้า
                                <ArrowUpDown className={cn("ml-1 h-3 w-3", invSort.key === "name" && "text-foreground")} />
                              </Button>
                            </TableHead>
                            <TableHead className="px-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-[11px] font-semibold"
                                onClick={() => handleSortToggle("p_id")}
                              >
                                รหัส
                                <ArrowUpDown className={cn("ml-1 h-3 w-3", invSort.key === "p_id" && "text-foreground")} />
                              </Button>
                            </TableHead>
                            <TableHead className="px-3">หมวดหมู่</TableHead>
                            <TableHead className="px-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-[11px] font-semibold"
                                onClick={() => handleSortToggle("available")}
                              >
                                พร้อมใช้
                                <ArrowUpDown className={cn("ml-1 h-3 w-3", invSort.key === "available" && "text-foreground")} />
                              </Button>
                            </TableHead>
                            <TableHead className="px-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-[11px] font-semibold"
                                onClick={() => handleSortToggle("total")}
                              >
                                ทั้งหมด
                                <ArrowUpDown className={cn("ml-1 h-3 w-3", invSort.key === "total" && "text-foreground")} />
                              </Button>
                            </TableHead>
                            <TableHead className="px-3 text-center">สถานะ</TableHead>
                            <TableHead className="px-3 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedInventory.map((item) => {
                            const statusMeta = getItemStatusMeta(item);
                            const isSelected = selectedInventoryIds.includes(item.id);
                            return (
                              <TableRow
                                key={item.id}
                                data-state={isSelected ? "selected" : undefined}
                                onClick={() => openDetails(item)}
                                className="cursor-pointer border-b last:border-b-0 hover:bg-muted/15 transition-colors"
                              >
                                <TableCell className="px-3 py-3.5">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const isChecked = checked === true;
                                      setSelectedInventoryIds((prev) =>
                                        isChecked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                                      );
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell className="px-3 py-3.5">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-11 w-11 overflow-hidden rounded-xl border border-muted/70 bg-muted/40 ring-1 ring-white">
                                      {item.image ? (
                                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                                          <Package className="h-4 w-4" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold leading-tight truncate">{item.name}</div>
                                      <div className="text-[11px] text-muted-foreground truncate">
                                        {[item.brand, item.model].filter(Boolean).join(" · ") || "-"}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-3 py-3.5 text-xs font-mono text-muted-foreground">{item.p_id}</TableCell>
                                <TableCell className="px-3 py-3.5 text-xs text-muted-foreground">{item.category}</TableCell>
                                <TableCell className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{item.available}</TableCell>
                                <TableCell className="px-3 py-3.5 text-right text-sm text-muted-foreground">{item.total}</TableCell>
                                <TableCell className="px-3 py-3.5 text-center">
                                  <StatusBadge status={statusMeta.label} className="h-7 px-3 text-[11px] font-semibold rounded-full" />
                                </TableCell>
                                <TableCell className="px-3 py-3.5 text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-full hover:bg-muted/70"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDetails(item);
                                      }}
                                      aria-label="View details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-full hover:bg-muted/70"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDetails(item);
                                      }}
                                      aria-label="Edit item"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-full hover:bg-muted/70"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDetails(item, { focusNotes: true });
                                      }}
                                      aria-label="Open notes"
                                    >
                                      <StickyNote className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10 p-10 text-sm text-muted-foreground">
                      <Package className="h-10 w-10 mb-2 opacity-20" />
                      ไม่พบรายการ
                    </div>
                  )}
                </TabsContent>
              </CardContent>

              <div className="border-t bg-muted/10 px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  หน้า {invPage} / {totalInvPages || 1} ({filteredInventory.length} รายการ)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderPagination(invPage, setInvPage, totalInvPages)}
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={totalInvPages || 1}
                      placeholder="ไปหน้า"
                      value={jumpPage}
                      onChange={(e) => setJumpPage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleJumpToPage();
                      }}
                      className="h-9 w-24 text-xs"
                    />
                    <Button variant="outline" className="h-9 px-3 text-xs" onClick={handleJumpToPage}>
                      ไปหน้า
                    </Button>
                  </div>
                </div>
              </div>
              </Tabs>
            </Card>
          </div>

          {/* Recent Transactions */}
          <div className="order-1 col-span-1 md:col-span-7 lg:col-span-7 space-y-4 flex flex-col min-w-0">
            {/* Recent Transactions */}
            <Card className="flex-1 flex flex-col rounded-2xl shadow-sm">
              <div className="px-4 py-3 border-b bg-muted/10 shrink-0 flex items-center justify-between">
                   <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-primary" /> รายการล่าสุด
                   </CardTitle>
                   <Button variant="link" size="sm" asChild className="h-auto p-0 text-[10px]">
                      <a href="/transactions?tab=active">ดูทั้งหมด</a>
                   </Button>
              </div>
              <CardContent className="p-0 flex-1 flex flex-col justify-between">
                 <div className="divide-y">
                    {transactionsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-3">
                          <Skeleton className="h-12 w-full" />
                        </div>
                      ))
                    ) : paginatedTransactions.length > 0 ? (
                      paginatedTransactions.map(tx => {
                        const meta = getActivityMeta(tx.status);
                        const Icon = meta.icon;
                        const txProduct = tx.product_serials?.products;
                        const inventoryItem = txProduct?.p_id ? inventoryByPid.get(txProduct.p_id) : undefined;
                        return (
                          <div
                            key={tx.id}
                            className="group p-3 transition-colors hover:bg-muted/30 animate-in fade-in-0 slide-in-from-top-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.tone)}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold truncate">{txProduct?.name || "-"}</div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span className={cn("px-1 rounded-[2px]", meta.tone)}>{meta.label}</span>
                                    <span className="truncate">โดย {tx.employees?.name || "-"}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatDate(tx.created_at)}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="truncate">
                                {txProduct?.p_id || "-"} · {tx.product_serials?.serial_code || "1 ชิ้น"}
                              </span>
                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => inventoryItem && openDetails(inventoryItem)}
                                  disabled={!inventoryItem}
                                  title="View Product"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => inventoryItem && openDetails(inventoryItem)}
                                  disabled={!inventoryItem}
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-xs text-muted-foreground">ไม่มีรายการเคลื่อนไหว</div>
                    )}
                 </div>
                 
                 <div className="p-2 px-4 border-t bg-muted/5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                        หน้า {txPage} / {totalTxPages || 1}
                     </span>
                     <div className="flex items-center gap-1">
                        <Button 
                           variant="outline" 
                           size="icon" 
                           className="h-6 w-6" 
                           onClick={() => setTxPage(p => Math.max(1, p - 1))}
                           disabled={txPage === 1}
                        >
                           <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button 
                           variant="outline" 
                           size="icon" 
                           className="h-6 w-6"
                           onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                           disabled={txPage === totalTxPages || totalTxPages === 0}
                        >
                           <ChevronRight className="h-3 w-3" />
                        </Button>
                     </div>
                  </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-lg font-semibold">
              {detailProduct?.name || selectedItem?.name || "รายละเอียดสินค้า"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ดูประวัติการยืม-คืน พร้อมแก้ไขจำนวนและข้อมูลสำคัญได้ทันที
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : detailProduct && selectedItem ? (
            <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-4">
                <div className="flex flex-col gap-4 rounded-2xl border bg-muted/10 p-4 sm:flex-row">
                  <button
                    type="button"
                    className={cn(
                      "group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border bg-white transition",
                      (detailProduct.image_url || selectedItem.image) ? "cursor-pointer" : "cursor-default"
                    )}
                    onClick={() => openImagePreview(detailProduct.image_url || selectedItem.image, detailProduct.name)}
                    disabled={!detailProduct.image_url && !selectedItem.image}
                  >
                    {detailProduct.image_url || selectedItem.image ? (
                      <>
                        <img
                          src={detailProduct.image_url || selectedItem.image || ""}
                          alt={detailProduct.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
                        <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-700">
                          <ZoomIn className="h-4 w-4" />
                        </span>
                      </>
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground/50" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px] font-semibold", getItemStatusMeta(selectedItem).className)}>
                        {getItemStatusMeta(selectedItem).label}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{detailProduct.p_id}</span>
                    </div>
                    <div className="grid gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>หมวดหมู่</span>
                        <span className="font-medium text-foreground">{detailProduct.category}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>แบรนด์</span>
                        <span className="font-medium text-foreground">{detailProduct.brand || "-"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>รุ่น</span>
                        <span className="font-medium text-foreground">{detailProduct.model || "-"}</span>
                      </div>
                      {(selectedItem.location || selectedItem.location_name) && (
                        <div className="flex items-center justify-between">
                          <span>ตำแหน่ง</span>
                          <span className="font-medium text-foreground">
                            {selectedItem.location || selectedItem.location_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-2xl border bg-emerald-50/70 p-3">
                    <div className="text-[10px] text-emerald-700">พร้อมใช้</div>
                    <div className="text-lg font-semibold text-emerald-700">{selectedItem.available}</div>
                  </div>
                  <div className="rounded-2xl border bg-amber-50/70 p-3">
                    <div className="text-[10px] text-amber-700">กำลังยืม</div>
                    <div className="text-lg font-semibold text-amber-700">{selectedItem.borrowed}</div>
                  </div>
                  <div className="rounded-2xl border bg-rose-50/70 p-3">
                    <div className="text-[10px] text-rose-700">เสียหาย</div>
                    <div className="text-lg font-semibold text-rose-700">{selectedItem.issue}</div>
                  </div>
                  <div className="rounded-2xl border bg-slate-50/80 p-3">
                    <div className="text-[10px] text-slate-600">เลิกใช้</div>
                    <div className="text-lg font-semibold text-slate-700">{selectedItem.inactive}</div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">ประวัติการยืม-คืน</h4>
                    <span className="text-[10px] text-muted-foreground">ล่าสุด {detailTransactions.length} รายการ</span>
                  </div>
                  <ScrollArea className="mt-3 h-40 pr-2">
                    {detailTransactions.length > 0 ? (
                      <div className="space-y-3">
                        {detailTransactions.slice(0, 6).map((tx) => {
                          const statusLabel = tx.status === "Active" ? "ยืม" : tx.status === "Completed" ? "คืน" : tx.status;
                          return (
                            <div key={tx.id} className="flex items-start justify-between gap-3 text-xs">
                              <div className="min-w-0 space-y-1">
                                <div className="font-medium text-foreground">{tx.employees?.name || "-"}</div>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                  <span className={cn("rounded px-1", tx.status === "Active" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                                    {statusLabel}
                                  </span>
                                  <span>ยืม: {tx.borrow_date ? formatDate(tx.borrow_date) : formatDate(tx.created_at)}</span>
                                  <span>คืน: {tx.return_date ? formatDate(tx.return_date) : "-"}</span>
                                </div>
                                {tx.note && <div className="text-[10px] text-muted-foreground">โน้ต: {tx.note}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">ยังไม่มีประวัติการยืม</div>
                    )}
                  </ScrollArea>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Quick Edit</h4>
                    <Badge variant="secondary" className="text-[10px]">อัปเดตทันที</Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">หมวดหมู่</Label>
                      <Select
                        value={detailForm.category}
                        onValueChange={(value) => setDetailForm((prev) => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger className="h-10 text-xs bg-background">
                          <SelectValue placeholder="เลือกหมวดหมู่" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {categoryOptions.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">จำนวนทั้งหมด</Label>
                      <Input
                        type="number"
                        min={0}
                        value={detailForm.initial_quantity}
                        onChange={(e) => setDetailForm((prev) => ({ ...prev, initial_quantity: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">หมายเหตุ</Label>
                      <Textarea
                        ref={notesRef}
                        autoFocus={focusNotes}
                        rows={3}
                        value={detailForm.notes}
                        onChange={(e) => setDetailForm((prev) => ({ ...prev, notes: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleQuickUpdate} disabled={updateProduct.isLoading}>
                        {updateProduct.isLoading ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                      </Button>
                      <Button variant="outline" asChild>
                        <Link to={`/serials?q=${detailForm.p_id}`}>จัดการ Serial/สถานะ</Link>
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-9"
                        onClick={() => toast.success(`เริ่มเติมสต็อก: ${detailForm.name}`)}
                      >
                        <Plus className="h-4 w-4" />
                        Restock
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9"
                        onClick={() => toast.message(`ทำเครื่องหมายเสียหาย: ${detailForm.name}`)}
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Mark Damaged
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9"
                        onClick={() => toast.message(`ส่งซ่อม: ${detailForm.name}`)}
                      >
                        <Wrench className="h-4 w-4" />
                        Send for Repair
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      สถานะคำนวณจาก Serial แต่ละชิ้น หากต้องการเปลี่ยนสถานะโปรดจัดการที่หน้า Serial
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/10 p-4 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>ผู้ใช้งานล่าสุด</span>
                    <span className="font-medium text-foreground">{activeTransaction?.employees?.name || "-"}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>สถานะล่าสุด</span>
                    <span className="font-medium text-foreground">{activeTransaction?.status || "-"}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>หมายเหตุล่าสุด</span>
                    <span className="font-medium text-foreground">{activeTransaction?.note || "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">ไม่พบข้อมูลสินค้า</div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Low Stock Dialog (PORTAL FIX) --- */}
      {isLowStockOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-0 sm:p-6 backdrop-blur-sm animate-in fade-in-0 duration-200">
          <div 
            className="w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col bg-white sm:rounded-xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} 
          >
            
            {/* Header Dialog */}
            <div className="px-4 py-4 sm:px-6 border-b bg-gradient-to-r from-rose-50 via-white to-amber-50 flex flex-col gap-4 shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="text-base sm:text-lg font-semibold flex items-center gap-2 text-rose-700">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    Stock Alert - สินค้าใกล้หมด
                  </div>
                  <div className="text-xs text-muted-foreground">
                    รายการคงเหลือน้อยกว่า {lowStockThreshold} ชิ้น · {filteredLowStock.length} รายการ
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-[11px] text-muted-foreground">
                    <Switch checked={lowStockAutoRefresh} onCheckedChange={setLowStockAutoRefresh} />
                    Auto refresh
                  </div>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => refetchInventory()}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsLowStockOpen(false)}
                    className="h-9 w-9 text-muted-foreground hover:bg-rose-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[190px_190px_190px_1fr_170px]">
                <Select value={lowStockCategory} onValueChange={setLowStockCategory}>
                  <SelectTrigger className="h-10 text-xs sm:text-sm bg-white">
                    <SelectValue placeholder="หมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={lowStockLocation} onValueChange={setLowStockLocation} disabled={!hasLocationData}>
                  <SelectTrigger className={cn("h-10 text-xs sm:text-sm bg-white", !hasLocationData && "opacity-60")}>
                    <SelectValue placeholder={hasLocationData ? "ตำแหน่ง" : "ไม่มีข้อมูลตำแหน่ง"} />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="all">ทุกตำแหน่ง</SelectItem>
                    {locationOptions.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={lowStockThresholdSelectValue} onValueChange={handleLowStockThresholdChange}>
                  <SelectTrigger className="h-10 text-xs sm:text-sm bg-white">
                    <SelectValue placeholder="เกณฑ์คงเหลือ" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {thresholdOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCustomLowStockThreshold && (
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className="h-10 text-xs sm:text-sm bg-white"
                    placeholder="ใส่จำนวน"
                    value={customLowStockThresholdInput}
                    onChange={(e) => handleCustomLowStockThresholdChange(e.target.value)}
                  />
                )}

                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาด้วยชื่อ, รหัส, หมวดหมู่..."
                    className="h-10 pl-9 text-sm bg-white"
                    value={lowStockSearch}
                    onChange={(e) => setLowStockSearch(e.target.value)}
                  />
                </div>

                <Select value={lowStockSort} onValueChange={setLowStockSort}>
                  <SelectTrigger className="h-10 text-xs sm:text-sm bg-white">
                    <SelectValue placeholder="เรียงลำดับ" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="available:asc">คงเหลือน้อยสุด</SelectItem>
                    <SelectItem value="available:desc">คงเหลือมากสุด</SelectItem>
                    <SelectItem value="name:asc">ชื่อ (A-Z)</SelectItem>
                    <SelectItem value="name:desc">ชื่อ (Z-A)</SelectItem>
                    <SelectItem value="category:asc">หมวดหมู่ (A-Z)</SelectItem>
                    <SelectItem value="category:desc">หมวดหมู่ (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-white/70 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={paginatedLowStock.length > 0 && lowStockSelected.length === paginatedLowStock.length}
                    onCheckedChange={() => handleSelectAllLowStock(paginatedLowStock as InventoryItem[])}
                  />
                  เลือกทั้งหมด
                  <span className="text-[11px] text-muted-foreground">
                    เลือก {lowStockSelected.length} รายการ
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-[11px]"
                    onClick={() => {
                      setLowStockSearch("");
                      setLowStockCategory("all");
                      setLowStockLocation("all");
                      setLowStockThreshold(3);
                      setLowStockSort("available:asc");
                    }}
                  >
                    รีเซ็ตฟิลเตอร์
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="h-8" onClick={handleBulkRestock} disabled={!lowStockSelected.length}>
                    <Plus className="h-4 w-4" />
                    Restock
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={handleBulkNotify} disabled={!lowStockSelected.length}>
                    <Bell className="h-4 w-4" />
                    Notify Supplier
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8" onClick={handleBulkDelete} disabled={!lowStockSelected.length}>
                    <Trash2 className="h-4 w-4" />
                    Delete Selection
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden bg-white flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4 sm:p-6">
                  {paginatedLowStock.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {paginatedLowStock.map((item) => {
                        const meta = getLowStockMeta(item);
                        const percent = getStockPercent(item);
                        const orderState = lowStockOrderState[item.id];
                        return (
                          <Card
                            key={item.id}
                            className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-3 min-w-0">
                                  <Checkbox
                                    checked={lowStockSelected.includes(item.id)}
                                    onCheckedChange={() => toggleLowStockSelection(item.id)}
                                  />
                                  <button
                                    type="button"
                                    className={cn(
                                      "group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted transition",
                                      item.image ? "cursor-pointer hover:shadow-md" : "cursor-default"
                                    )}
                                    onClick={() => openImagePreview(item.image, item.name)}
                                    aria-label="View product image"
                                    disabled={!item.image}
                                  >
                                    {item.image ? (
                                      <>
                                        <img
                                          src={item.image}
                                          alt={item.name}
                                          loading="lazy"
                                          decoding="async"
                                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                        />
                                        <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
                                        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/85 text-slate-700">
                                          <ZoomIn className="h-3 w-3" />
                                        </span>
                                      </>
                                    ) : (
                                      <ImageIcon className="h-5 w-5 opacity-50" />
                                    )}
                                  </button>
                                  <div className="min-w-0 space-y-1">
                                    <div className="font-semibold text-sm truncate">{item.name}</div>
                                    <div className="text-[11px] text-muted-foreground font-mono truncate">{item.p_id}</div>
                                    <div className="text-[11px] text-muted-foreground truncate">
                                      {[item.category, item.brand, item.model].filter(Boolean).join(" · ") || "-"}
                                    </div>
                                  </div>
                                </div>
                                <Badge variant="outline" className={cn("text-[10px] font-semibold", meta.className)}>
                                  <span className={cn("mr-1 h-2 w-2 rounded-full", meta.dot)} />
                                  {meta.label}
                                </Badge>
                              </div>

                              {orderState && (
                                <Badge variant="secondary" className="text-[10px] h-5 w-fit">
                                  <Truck className="mr-1 h-3 w-3" />
                                  {orderState === "ordered" ? "กำลังสั่งซื้อ" : "กำลังเติมสต็อก"}
                                </Badge>
                              )}

                              <div className="rounded-xl border bg-muted/10 p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">คงเหลือ</span>
                                  <span className="text-[10px] text-muted-foreground">ทั้งหมด {item.total}</span>
                                </div>
                                <div
                                  className="mt-1 text-2xl font-semibold text-rose-600"
                                  title={`คงเหลือ ${item.available} จาก ${item.total} • ${meta.label}`}
                                >
                                  {item.available}
                                </div>
                                <div className="mt-2">
                                  <Progress value={percent} className="h-2" />
                                  <div className="mt-1 text-[10px] text-muted-foreground">{percent}% stock remaining</div>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" className="h-8" onClick={() => handleCardRestock(item)}>
                                  <Plus className="h-4 w-4" />
                                  Restock
                                </Button>
                                <Button size="sm" variant="outline" className="h-8" onClick={() => openDetails(item)}>
                                  <Eye className="h-4 w-4" />
                                  View
                                </Button>
                                <Button size="sm" variant="outline" className="h-8" onClick={() => handleCardOrder(item)}>
                                  <Truck className="h-4 w-4" />
                                  Order Now
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10 p-10 text-sm text-muted-foreground">
                      <AlertTriangle className="h-10 w-10 mb-2 opacity-20" />
                      ไม่พบรายการสินค้าใกล้หมด
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t flex items-center justify-between bg-muted/5 shrink-0 fixed bottom-0 w-full sm:static bg-white sm:bg-transparent z-20 shadow-up sm:shadow-none">
                  <div className="text-xs text-muted-foreground hidden sm:block">
                     หน้า {lowStockPage} จาก {totalLowStockPages}
                  </div>
                  <div className="w-full sm:w-auto flex justify-center">
                     {renderPagination(lowStockPage, setLowStockPage, totalLowStockPages)}
                  </div>
              </div>
            </div>
          </div>
          {/* Background Overlay */}
          <div className="fixed inset-0 -z-10" onClick={() => setIsLowStockOpen(false)} />
        </div>,
        document.body
      )}

      {/* --- Image Preview (Lightbox) --- */}
      {imagePreview.open && createPortal(
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in-0 duration-200"
          onClick={() => setImagePreview({ open: false, src: "", name: "" })}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-black/90 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex max-h-[85vh] w-full items-center justify-center p-4">
              <img
                src={imagePreview.src}
                alt={imagePreview.name}
                className="max-h-[78vh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-9 w-9 rounded-full bg-white/90 text-slate-700 hover:bg-white"
              onClick={() => setImagePreview({ open: false, src: "", name: "" })}
              aria-label="Close image preview"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>,
        document.body
      )}
    </MainLayout>
  );
}

