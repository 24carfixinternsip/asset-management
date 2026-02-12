import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Package,
  SlidersHorizontal,
  ArrowLeftRight,
  AlertTriangle,
  Wrench,
  Clock,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { usePortalContext } from "./PortalContainer";
import { useProducts, Product } from "@/hooks/useProducts"; 
import { ProductSerial, useSerialsWithPagination } from "@/hooks/useSerials";
import { useDashboardInventory } from "@/hooks/useDashboard";
import { useRecentTransactions } from "@/hooks/useTransactions";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { toast } from "sonner";
import { PaginationControl } from "@/components/ui/pagination-control";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { th } from "date-fns/locale";

const SerialPickerModal = ({ 
  product, 
  isOpen, 
  onClose, 
  onSelect 
}: { 
  product: Product | null, 
  isOpen: boolean, 
  onClose: () => void, 
  onSelect: (serial: ProductSerial) => void 
}) => {
  const [searchSerial, setSearchSerial] = useState("");
  const [serialPage, setSerialPage] = useState(1);

  const { data: serialsResponse, isLoading } = useSerialsWithPagination({
    productId: product?.id,
    status: 'ready',
    search: searchSerial,
    page: serialPage,
    pageSize: 10
  });

  const serials = serialsResponse?.data || [];
  const totalPages = serialsResponse?.totalPages || 0;

  // Reset search + page เมื่อปิด Modal
  useEffect(() => {
    if (!isOpen) {
      setSearchSerial("");
      setSerialPage(1);
    }
  }, [isOpen]);

  // Reset search เมื่อปิด Modal
  useEffect(() => {
    if (!isOpen) {
      setSearchSerial("");
    }
  }, [isOpen]);

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg bg-slate-100 border overflow-hidden shrink-0 flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-8 w-8 text-slate-300" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl">{product.name}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-col gap-1">
                <span>{product.brand} {product.model}</span>
                <span className="text-xs text-muted-foreground">รหัสสินค้า: {product.p_id}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 bg-slate-50 border-b">
           <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="ค้นหาเลข Serial (เช่น NB-001)..." 
              value={searchSerial}
              onChange={(e) => setSearchSerial(e.target.value)}
              className="pl-9 bg-white"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-4 min-h-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : serials && serials.length > 0 ? (
            <div className="grid gap-2">
              {serials.map((serial) => (
                <div 
                  key={serial.id} 
                  className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all group"
                  onClick={() => onSelect(serial)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 px-2 py-1 rounded text-sm font-mono font-medium text-slate-700 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {serial.serial_code}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">
                        {serial.location_id ? `📍 ${serial.locations?.name || 'ไม่ระบุชื่อจุด'}` : 'ไม่ระบุจุด'}
                      </span>
                      {serial.notes && <span className="text-[10px] text-slate-400">{serial.notes}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              {searchSerial ? "ไม่พบเลข Serial ที่ค้นหา" : "สินค้าหมดชั่วคราว"}
            </div>
          )}
        </ScrollArea>
        {totalPages > 1 && (
          <div className="p-4 border-t bg-slate-50">
            <PaginationControl
              currentPage={serialPage}
              totalPages={totalPages}
              onPageChange={setSerialPage}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- Main Component ---
const PortalCatalog = () => {
  const { addToCart } = usePortalContext();
  
  // URL Params Management
  const [searchParams, setSearchParams] = useSearchParams();
  
  const searchTerm = searchParams.get("search") || "";
  const page = Number(searchParams.get("page")) || 1;

  const setSearchTerm = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.delete("page"); // Reset page เมื่อค้นหาใหม่
    setSearchParams(params, { replace: true });
  };

  const setPage = (value: number) => {
    const params = new URLSearchParams(searchParams);
    if (value > 1) {
      params.set("page", value.toString());
    } else {
      params.delete("page");
    }
    setSearchParams(params, { replace: true });
  };
  
  const { data: categoriesData } = useCategoriesQuery();
  const categoryOptions = useMemo(
    () =>
      (categoriesData ?? []).map((category) => ({
        id: category.id,
        label: category.code ? `${category.name} (${category.code})` : category.name,
      })),
    [categoriesData],
  );
  const { data: inventorySummary } = useDashboardInventory();
  const { data: recentTransactions, isLoading: activityLoading } = useRecentTransactions(8);

  // Filter + Sort State
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState("name:asc");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSerialPickerOpen, setIsSerialPickerOpen] = useState(false);
  const [detailTransactions, setDetailTransactions] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeAssignments, setActiveAssignments] = useState<Record<string, string>>({});
  const activeFilterCount =
    selectedCategories.length + selectedStatuses.length + (onlyAvailable ? 1 : 0);
  const resetFilters = () => {
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setOnlyAvailable(false);
    setSortBy("name:asc");
  };

  // Fetch Products (pull more and paginate client-side)
  const fetchSize = 200;
  const pageSize = 12;
  const { data: productsResponse, isLoading } = useProducts(
    1,
    fetchSize,
    { search: searchTerm }
  );

  const productsData = productsResponse?.data || [];

  const inventoryMap = useMemo(() => {
    const map = new Map<string, any>();
    (inventorySummary || []).forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [inventorySummary]);

  const statusOptions = [
    { value: "available", label: "พร้อมใช้", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { value: "in_use", label: "กำลังใช้งาน", className: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "repair", label: "ส่งซ่อม", className: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "damaged", label: "เสียหาย", className: "bg-rose-50 text-rose-700 border-rose-200" },
  ];

  const getUsageStatus = (product: Product) => {
    const inventory = inventoryMap.get(product.id);
    const available = inventory?.available ?? product.stock_available ?? 0;
    const borrowed = inventory?.borrowed ?? Math.max(0, (product.stock_total ?? 0) - (product.stock_available ?? 0));
    const issue = inventory?.issue ?? 0;
    const inactive = inventory?.inactive ?? 0;

    if (issue > 0) return statusOptions[2];
    if (borrowed > 0) return statusOptions[1];
    if (available > 0) return statusOptions[0];
    if (inactive > 0) return statusOptions[3];
    return statusOptions[3];
  };

  const getAvailableCount = (product: Product) => {
    const inventory = inventoryMap.get(product.id);
    return inventory?.available ?? product.stock_available ?? 0;
  };

  const getQuantityTone = (value: number) => {
    if (value <= 0) return "text-rose-600";
    if (value <= 2) return "text-amber-600";
    return "text-emerald-600";
  };

  const lowStockThreshold = 2;
    const lowStockItems = useMemo(() => {
    return (inventorySummary || []).filter((item) => item.available <= lowStockThreshold);
  }, [inventorySummary]);

  const repairItems = useMemo(() => {
    return (inventorySummary || []).filter((item) => item.issue > 0);
  }, [inventorySummary]);

  const getActivityMeta = (status?: string) => {
    if (status === "Active") {
      return { label: "ยืม", className: "bg-blue-50 text-blue-700", icon: ArrowLeftRight };
    }
    if (status === "Completed") {
      return { label: "คืน", className: "bg-emerald-50 text-emerald-700", icon: Package };
    }
    if (status === "Pending") {
      return { label: "รออนุมัติ", className: "bg-slate-100 text-slate-700", icon: Clock };
    }
    return { label: status || "อัปเดต", className: "bg-slate-100 text-slate-600", icon: Clock };
  };
    const filteredProducts = useMemo(() => {
    return productsData.filter((product) => {
      if (selectedCategories.length > 0) {
        const productCategoryId = product.category_id ?? product.categories?.id ?? "";
        if (!selectedCategories.includes(productCategoryId)) return false;
      }
      if (selectedStatuses.length) {
        const status = getUsageStatus(product).value;
        if (!selectedStatuses.includes(status)) return false;
      }
      if (onlyAvailable && getAvailableCount(product) <= 0) return false;
      return true;
    });
  }, [productsData, selectedCategories, selectedStatuses, onlyAvailable, inventoryMap]);

  const sortedProducts = useMemo(() => {
    const items = [...filteredProducts];
    const [key, dir] = sortBy.split(":");
    const direction = dir === "desc" ? -1 : 1;
    items.sort((a, b) => {
      if (key === "name") return direction * a.name.localeCompare(b.name, "th");
      if (key === "available") return direction * (getAvailableCount(a) - getAvailableCount(b));
      if (key === "status") {
        return direction * getUsageStatus(a).label.localeCompare(getUsageStatus(b).label, "th");
      }
      return direction * a.name.localeCompare(b.name, "th");
    });
    return items;
  }, [filteredProducts, sortBy, inventoryMap]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const paginatedProducts = sortedProducts.slice((page - 1) * pageSize, page * pageSize);
    useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategories, selectedStatuses, onlyAvailable, sortBy]);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("transactions")
      .select(
        `
        id,
        status,
        created_at,
        employees ( name ),
        product_serials ( product_id )
      `
      )
      .eq("status", "Active")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error || !mounted) return;
        const map: Record<string, string> = {};
        (data || []).forEach((tx: any) => {
          const productId = tx.product_serials?.product_id;
          if (productId && !map[productId]) {
            map[productId] = tx.employees?.name || "-";
          }
        });
        setActiveAssignments(map);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isDetailOpen || !selectedProduct) return;
    let mounted = true;
    setDetailLoading(true);
    supabase
      .from("transactions")
      .select(
        `
        id,
        status,
        borrow_date,
        return_date,
        created_at,
        note,
        employees ( name ),
        product_serials!inner ( serial_code, product_id )
      `
      )
      .eq("product_serials.product_id", selectedProduct.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!mounted) return;
        setDetailTransactions(data || []);
      })
      .finally(() => {
        if (mounted) setDetailLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isDetailOpen, selectedProduct]);
    // Handle Product Selection -> Open Modal
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  };

  const handleOpenSerialPicker = (product: Product) => {
    if (getAvailableCount(product) <= 0) {
      toast.error("สินค้าหมดสต็อก");
      return;
    }
    setSelectedProduct(product);
    setIsSerialPickerOpen(true);
  };

  // Handle Serial Selection from Modal
  const handleSelectSerial = (serial: ProductSerial) => {
    // แปลงข้อมูลเพื่อใส่ตะกร้า
    const productForCart: Product = {
      id: serial.product_id,
      p_id: serial.products?.p_id || '',
      name: serial.products?.name || '',
      category: serial.products?.category || '',
      brand: serial.products?.brand || null,
      model: serial.products?.model || null,
      description: null,
      notes: null,
      price: serial.products?.price || 0,
      unit: serial.products?.unit || 'ea',
      image_url: serial.products?.image_url || null,
      created_at: serial.products?.created_at || new Date().toISOString(),
      updated_at: null,
      stock_total: 1,
      stock_available: 1,
      // เพิ่ม fields พิเศษสำหรับระบุ Serial (ต้องแก้ Type Product ด้วย)
      selected_serial_id: serial.id,
      selected_serial_code: serial.serial_code
    } as Product & { selected_serial_id: string; selected_serial_code: string };

    addToCart(productForCart);
    setIsSerialPickerOpen(false);
    setIsDetailOpen(false);
  };

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      <section className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">พอร์ทัลสินค้า</h2>
            <p className="text-sm text-muted-foreground">
              ค้นหาและขอเบิกสินค้าได้อย่างรวดเร็ว พร้อมตัวกรองที่ใช้งานง่าย
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="relative flex-1 sm:min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาสินค้า (ชื่อ, รหัส, หมวดหมู่)..."
                className="pl-9 h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="lg:hidden"
                onClick={() => setIsFilterOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                ตัวกรอง
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 h-5 rounded-full px-2 text-[11px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
              {activeFilterCount > 0 && (
                <Button variant="ghost" onClick={resetFilters}>
                  ล้างตัวกรอง
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-3 rounded-2xl border bg-white/80 p-3 shadow-sm lg:flex">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between gap-2">
                หมวดหมู่
                {selectedCategories.length > 0 && (
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                    {selectedCategories.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                {categoryOptions.length ? (
                  categoryOptions.map((category) => (
                    <label key={category} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) => {
                          setSelectedCategories((prev) =>
                            checked ? [...prev, category] : prev.filter((item) => item !== category)
                          );
                        }}
                      />
                      {category}
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">ยังไม่มีหมวดหมู่สินค้า</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between gap-2">
                สถานะ
                {selectedStatuses.length > 0 && (
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                    {selectedStatuses.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60">
              <div className="space-y-2">
                {statusOptions.map((status) => (
                  <label key={status.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedStatuses.includes(status.value)}
                      onCheckedChange={(checked) => {
                        setSelectedStatuses((prev) =>
                          checked ? [...prev, status.value] : prev.filter((item) => item !== status.value)
                        );
                      }}
                    />
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs", status.className)}>
                      {status.label}
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <Checkbox checked={onlyAvailable} onCheckedChange={(checked) => setOnlyAvailable(Boolean(checked))} />
            <span className="text-sm">เฉพาะสินค้าที่พร้อมใช้</span>
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="เรียงลำดับ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name:asc">ชื่อสินค้า (A-Z)</SelectItem>
              <SelectItem value="name:desc">ชื่อสินค้า (Z-A)</SelectItem>
              <SelectItem value="available:desc">คงเหลือมาก → น้อย</SelectItem>
              <SelectItem value="available:asc">คงเหลือน้อย → มาก</SelectItem>
              <SelectItem value="status:asc">สถานะสินค้า</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto text-xs text-muted-foreground">
            ทั้งหมด {sortedProducts.length} รายการ
          </div>
        </div>
      </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
              ))}
            </div>
          ) : sortedProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedProducts.map((product) => {
                const status = getUsageStatus(product);
                const available = getAvailableCount(product);
                const assignedTo = activeAssignments[product.id];

                return (
                  <Card
                    key={product.id}
                    className="group h-full border-slate-200/70 bg-white/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <CardContent className="flex h-full flex-col gap-4 p-4">
                      <button
                        type="button"
                        className="relative w-full overflow-hidden rounded-2xl border bg-slate-50/70 transition hover:border-primary/40"
                        onClick={() => handleProductClick(product)}
                      >
                        <div className="aspect-square w-full">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-100">
                              <Package className="h-12 w-12 text-slate-300" />
                            </div>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        className="space-y-1 text-left"
                        onClick={() => handleProductClick(product)}
                      >
                        <div className="text-base font-semibold text-slate-900">{product.name}</div>
                        <div className="text-xs text-muted-foreground">รหัสสินค้า: {product.p_id}</div>
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", status.className)}>
                          {status.label}
                        </span>
                        <span className={cn("text-xs font-semibold", getQuantityTone(available))}>
                          คงเหลือ {available}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        {assignedTo ? `ผู้ใช้งาน: ${assignedTo}` : "ยังไม่มีผู้ใช้งาน"}
                      </div>

                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleProductClick(product)}>
                          ดูรายละเอียด
                        </Button>
                        <Button size="sm" onClick={() => handleOpenSerialPicker(product)} disabled={available <= 0}>
                          ขอเบิก
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="col-span-2"
                          onClick={() => toast.message("ส่งคำขอเติมสต็อกแล้ว")}
                        >
                          ขอเติมสต็อก
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-slate-50/60 p-12 text-center text-muted-foreground">
              <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="text-lg font-medium text-slate-800">ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
              <p className="text-sm">ลองเปลี่ยนตัวกรอง หรือลองคำค้นหาอื่น</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center">
              <PaginationControl currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle className="text-base">แจ้งเตือนสำคัญ</CardTitle>
              <CardDescription>สินค้าใกล้หมดหรือรอซ่อม</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium text-rose-600">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    สต็อกต่ำ
                  </div>
                  <Badge variant="outline" className="border-rose-200 text-rose-600">
                    {lowStockItems.length}
                  </Badge>
                </div>
                {lowStockItems.length ? (
                  lowStockItems.slice(0, 4).map((item) => {
                    const product = productsData.find((p) => p.id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-800">{product?.name || "สินค้า"}</p>
                          <p className="text-xs text-rose-600">คงเหลือ {item.available}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => toast.message("ส่งคำขอเติมสต็อกแล้ว")}>
                          เติมสต็อก
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">ไม่มีสินค้าที่สต็อกต่ำ</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium text-amber-700">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    รอซ่อม
                  </div>
                  <Badge variant="outline" className="border-amber-200 text-amber-700">
                    {repairItems.length}
                  </Badge>
                </div>
                {repairItems.length ? (
                  repairItems.slice(0, 4).map((item) => {
                    const product = productsData.find((p) => p.id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-800">{product?.name || "สินค้า"}</p>
                          <p className="text-xs text-amber-700">ต้องซ่อม {item.issue}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => toast.message("ปิดแจ้งเตือนแล้ว")}>
                          ปิดแจ้งเตือน
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">ยังไม่มีรายการที่ต้องซ่อม</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle className="text-base">กิจกรรมล่าสุด</CardTitle>
              <CardDescription>อัปเดตการยืม-คืนล่าสุด</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activityLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : recentTransactions && recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => {
                  const meta = getActivityMeta(tx.status);
                  const Icon = meta.icon;
                  const productName = tx.product_serials?.products?.name || tx.product_serials?.serial_code || "สินค้า";
                  const timeLabel = format(new Date(tx.created_at), "dd MMM yyyy • HH:mm", { locale: th });
                  return (
                    <div key={tx.id} className="rounded-xl border p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", meta.className)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{productName}</span>
                            <Badge variant="secondary" className="text-[11px]">
                              {meta.label}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {tx.employees?.name || tx.departments?.name || "ไม่ระบุผู้ใช้งาน"} • {timeLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่มีกิจกรรมล่าสุด</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          {selectedProduct && (
            <div className="flex flex-col">
              <DialogHeader className="border-b p-6 pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border bg-slate-50">
                    {selectedProduct.image_url ? (
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100">
                        <Package className="h-10 w-10 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">{selectedProduct.name}</DialogTitle>
                    <DialogDescription className="mt-1">
                      รหัสสินค้า: {selectedProduct.p_id}
                    </DialogDescription>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge
                        variant="secondary"
                        className={cn("rounded-full border px-3 py-1 text-xs", getUsageStatus(selectedProduct).className)}
                      >
                        {getUsageStatus(selectedProduct).label}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        คงเหลือ {getAvailableCount(selectedProduct)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6">
                <Tabs defaultValue="details" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">รายละเอียด</TabsTrigger>
                    <TabsTrigger value="history">ประวัติการใช้งาน</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border bg-slate-50/60 p-4">
                        <p className="text-xs text-muted-foreground">หมวดหมู่</p>
                        <p className="text-sm font-medium">{selectedProduct.category || "-"}</p>
                      </div>
                      <div className="rounded-2xl border bg-slate-50/60 p-4">
                        <p className="text-xs text-muted-foreground">ผู้รับผิดชอบ</p>
                        <p className="text-sm font-medium">
                          {activeAssignments[selectedProduct.id] || "ยังไม่มีผู้ใช้งาน"}
                        </p>
                      </div>
                      <div className="rounded-2xl border bg-slate-50/60 p-4">
                        <p className="text-xs text-muted-foreground">แบรนด์ / รุ่น</p>
                        <p className="text-sm font-medium">
                          {selectedProduct.brand || "-"} {selectedProduct.model || ""}
                        </p>
                      </div>
                      <div className="rounded-2xl border bg-slate-50/60 p-4">
                        <p className="text-xs text-muted-foreground">หมายเหตุ</p>
                        <p className="text-sm font-medium">{selectedProduct.notes || "-"}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => handleOpenSerialPicker(selectedProduct)}>ขอเบิกสินค้า</Button>
                      <Button variant="outline" onClick={() => toast.message("ส่งคำขอเติมสต็อกแล้ว")}>
                        ขอเติมสต็อก
                      </Button>
                      <Button variant="outline" onClick={() => toast.message("ส่งคำขอซ่อมแล้ว")}>
                        ส่งซ่อม
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="space-y-3">
                    {detailLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full rounded-xl" />
                        ))}
                      </div>
                    ) : detailTransactions.length > 0 ? (
                      detailTransactions.map((tx) => {
                        const meta = getActivityMeta(tx.status);
                        const Icon = meta.icon;
                        const timeLabel = format(new Date(tx.created_at), "dd MMM yyyy • HH:mm", { locale: th });
                        return (
                          <div key={tx.id} className="flex items-start gap-3 rounded-xl border p-3">
                            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", meta.className)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-slate-800">{meta.label}</span>
                                <span className="text-xs text-muted-foreground">{timeLabel}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ผู้ใช้งาน: {tx.employees?.name || "ไม่ระบุ"}
                              </div>
                              {tx.note && <div className="text-xs text-slate-500">หมายเหตุ: {tx.note}</div>}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                        ยังไม่มีประวัติการทำรายการ
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SerialPickerModal
        product={selectedProduct}
        isOpen={isSerialPickerOpen}
        onClose={() => setIsSerialPickerOpen(false)}
        onSelect={handleSelectSerial}
      />

      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[360px]">
          <SheetHeader>
            <SheetTitle>ตัวกรอง</SheetTitle>
            <SheetDescription>ปรับการค้นหาให้ตรงกับความต้องการ</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">หมวดหมู่</p>
                {selectedCategories.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCategories([])}>
                    ล้าง
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {categoryOptions.length ? (
                  categoryOptions.map((category) => (
                    <label key={category} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) => {
                          setSelectedCategories((prev) =>
                            checked ? [...prev, category] : prev.filter((item) => item !== category)
                          );
                        }}
                      />
                      {category}
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">ยังไม่มีหมวดหมู่สินค้า</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">สถานะการใช้งาน</p>
                {selectedStatuses.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStatuses([])}>
                    ล้าง
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {statusOptions.map((status) => (
                  <label key={status.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedStatuses.includes(status.value)}
                      onCheckedChange={(checked) => {
                        setSelectedStatuses((prev) =>
                          checked ? [...prev, status.value] : prev.filter((item) => item !== status.value)
                        );
                      }}
                    />
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs", status.className)}>
                      {status.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <p className="text-sm font-medium">เฉพาะสินค้าที่พร้อมใช้</p>
                <p className="text-xs text-muted-foreground">แสดงเฉพาะรายการที่ยังมีสต็อก</p>
              </div>
              <Checkbox checked={onlyAvailable} onCheckedChange={(checked) => setOnlyAvailable(Boolean(checked))} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">เรียงลำดับ</p>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกการเรียงลำดับ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name:asc">ชื่อสินค้า (A-Z)</SelectItem>
                  <SelectItem value="name:desc">ชื่อสินค้า (Z-A)</SelectItem>
                  <SelectItem value="available:desc">คงเหลือมาก → น้อย</SelectItem>
                  <SelectItem value="available:asc">คงเหลือน้อย → มาก</SelectItem>
                  <SelectItem value="status:asc">สถานะสินค้า</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" className="w-full" onClick={resetFilters} disabled={!activeFilterCount}>
              ล้างตัวกรองทั้งหมด
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
  
};

export default PortalCatalog;







