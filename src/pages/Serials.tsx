import { useState, useMemo, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  Search, Pencil, Barcode, Image as ImageIcon, Camera, MapPin, 
  Eye, Calendar as CalendarIcon, X, Box, Trash2,
  SlidersHorizontal, LayoutGrid, List, UserCircle
} from "lucide-react";
import { useSerials, useUpdateSerial, useDeleteSerial, ProductSerial } from "@/hooks/useSerials";
import { useLocations, useCategories } from "@/hooks/useMasterData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns"; 
import { th } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import imageCompression from 'browser-image-compression';
import { Link, useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

// Pagination Components
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { 
  useSerialStatuses, 
  useStickerStatuses
} from '@/hooks/useStatuses';

const getOptimizedUrl = (url: string | null, width = 100) => {
  if (!url) return null;
  if (url.includes('supabase.co')) {
    return `${url}?width=${width}&resize=contain&quality=60`;
  }
  return url;
};

const getSerialImage = (serial: ProductSerial) =>
  serial.image_url || serial.products?.image_url || null;

type BadgeMeta = { label: string; className: string };

const serialStatusMetaMap: Record<string, BadgeMeta> = {
  ready: { label: "พร้อมใช้", className: "bg-green-50 text-green-700 border-green-200" },
  in_use: { label: "กำลังใช้งาน", className: "bg-blue-50 text-blue-700 border-blue-200" },
  borrowed: { label: "กำลังใช้งาน", className: "bg-blue-50 text-blue-700 border-blue-200" },
  damaged: { label: "เสียหาย", className: "bg-red-50 text-red-700 border-red-200" },
  repair: { label: "ส่งซ่อม", className: "bg-purple-50 text-purple-700 border-purple-200" },
  in_repair: { label: "ส่งซ่อม", className: "bg-purple-50 text-purple-700 border-purple-200" },
  retired: { label: "เลิกใช้", className: "bg-slate-50 text-slate-700 border-slate-200" },
  disposed: { label: "เลิกใช้", className: "bg-slate-50 text-slate-700 border-slate-200" },
  lost: { label: "สูญหาย", className: "bg-rose-50 text-rose-700 border-rose-200" },
  inactive: { label: "ไม่พร้อมใช้", className: "bg-amber-50 text-amber-700 border-amber-200" },
  unavailable: { label: "ไม่พร้อมใช้", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

const stickerStatusMetaMap: Record<string, BadgeMeta> = {
  pending: { label: "รอติดสติ๊กเกอร์", className: "bg-amber-50 text-amber-700 border-amber-200" },
  done: { label: "ติดสติ๊กเกอร์แล้ว", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  completed: { label: "ติดสติ๊กเกอร์แล้ว", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  missing: { label: "ไม่มีสติ๊กเกอร์", className: "bg-slate-50 text-slate-700 border-slate-200" },
  none: { label: "ไม่มีสติ๊กเกอร์", className: "bg-slate-50 text-slate-700 border-slate-200" },
};

const getSerialStatusMeta = (status: string | null): BadgeMeta => {
  if (!status) return { label: "ไม่ทราบสถานะ", className: "bg-slate-50 text-slate-700 border-slate-200" };
  const key = status.toLowerCase();
  return serialStatusMetaMap[key] || { label: "ไม่ทราบสถานะ", className: "bg-slate-50 text-slate-700 border-slate-200" };
};

const getStickerStatusMeta = (status: string | null): BadgeMeta => {
  if (!status) return { label: "ไม่มีสติ๊กเกอร์", className: "bg-slate-50 text-slate-700 border-slate-200" };
  const key = status.toLowerCase();
  return stickerStatusMetaMap[key] || { label: "ไม่มีสติ๊กเกอร์", className: "bg-slate-50 text-slate-700 border-slate-200" };
};

const StatusPill = ({ meta, className }: { meta: BadgeMeta; className?: string }) => (
  <Badge variant="outline" className={`border font-medium ${meta.className} ${className || ""}`}>
    {meta.label}
  </Badge>
);

export default function Serials() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") || "");
 
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get("status") || "all");
  const [filterLocation, setFilterLocation] = useState<string>(searchParams.get("location") || "all");
  const [filterSticker, setFilterSticker] = useState<string>(searchParams.get("sticker") || "all");
  const [filterCategory, setFilterCategory] = useState<string>(searchParams.get("category") || "all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    if (fromStr) {
      return {
        from: new Date(fromStr),
        to: toStr ? new Date(toStr) : undefined
      };
    }
    return undefined;
  });
  const isMobile = useIsMobile();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ productUrl?: string | null; stickerUrl?: string | null }>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const initialView = (searchParams.get("view") as "list" | "cards" | null)
    || (localStorage.getItem("serials:view") as "list" | "cards" | null)
    || (isMobile ? "cards" : "list");
  const [viewMode, setViewMode] = useState<"list" | "cards">(initialView);

  const { data: serialStatuses } = useSerialStatuses();
  const { data: stickerStatuses } = useStickerStatuses();
  
  const serialStatusOptions = useMemo(
    () => serialStatuses?.map((s) => ({
      value: s.status_code,
      label: s.display_name_th
    })) || [],
    [serialStatuses]
  );

  const stickerStatusOptions = useMemo(
    () => stickerStatuses?.map((s) => ({
      value: s.status_code,
      label: s.display_name_th
    })) || [],
    [stickerStatuses]
  );

  const deleteSerial = useDeleteSerial();

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15; 

  // Debounce Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params: Record<string, string> = {};

    if (search) params.q = search;
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterLocation !== "all") params.location = filterLocation;
    if (filterSticker !== "all") params.sticker = filterSticker;
    if (filterCategory !== "all") params.category = filterCategory;
    if (dateRange?.from) params.from = dateRange.from.toISOString();
    if (dateRange?.to) params.to = dateRange.to.toISOString();
    if (viewMode) params.view = viewMode;

    setSearchParams(params, { replace: true });
  }, [search, filterStatus, filterLocation, filterSticker, filterCategory, dateRange, viewMode, setSearchParams]);

  useEffect(() => {
    localStorage.setItem("serials:view", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      const sanity = "รายการทรัพย์สิน ค้นหา สติ๊กเกอร์";
      if (/[Ã�]/.test(sanity) || /\?\?\?/.test(sanity)) {
        console.warn("Thai text encoding looks corrupted. Check file encoding (UTF-8) and font loading.");
      }
    }
  }, []);

  const { data: serials, isLoading } = useSerials({
    search: debouncedSearch || undefined,
    status: filterStatus,
    location: filterLocation,
    sticker: filterSticker,
    category: filterCategory,
    dateRange: dateRange
  });

  const { data: locations } = useLocations();
  const { data: categoriesData } = useCategories();
  const CATEGORIES = categoriesData?.map(c => c.name) || [];
  const updateSerial = useUpdateSerial();
  
  // Dialog States
  const [selectedSerial, setSelectedSerial] = useState<ProductSerial | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Edit Form State
  const [editForm, setEditForm] = useState({
    status: '',
    sticker_status: '',
    sticker_date: '',
    sticker_image_url: '',
    image_url: '', 
    notes: '',     
    location_id: '',
  });

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStatus, filterLocation, filterSticker, filterCategory, dateRange]);

  const paginatedSerials = useMemo(() => {
    // If data not loaded yet, fallback to empty array
    const data = serials || []; 
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [serials, currentPage]);

  // Total pages from server result length
  const totalPages = Math.ceil((serials?.length || 0) / itemsPerPage);
  const totalItems = serials?.length || 0;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) items.push(i);
        items.push('ellipsis');
        items.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        items.push(1);
        items.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) items.push(i);
      } else {
        items.push(1);
        items.push('ellipsis');
        items.push(currentPage - 1);
        items.push(currentPage);
        items.push(currentPage + 1);
        items.push('ellipsis');
        items.push(totalPages);
      }
    }
    return items;
  };

  // --- Actions ---
  const openEditDialog = (serial: ProductSerial) => {
    setSelectedSerial(serial);
    setEditForm({
      status: serial.status || 'ready',
      sticker_status: serial.sticker_status || 'pending',
      sticker_date: serial.sticker_date || '',
      sticker_image_url: serial.sticker_image_url || '',
      image_url: serial.image_url || '',
      notes: serial.notes || '',
      location_id: serial.location_id || '',
    });
    setIsEditOpen(true);
  };

  const openDetails = (serial: ProductSerial) => {
    setSelectedSerial(serial);
    setIsDetailsOpen(true);
  };

  const openImagePreview = (serial: ProductSerial) => {
    setImagePreview({
      productUrl: getSerialImage(serial),
      stickerUrl: serial.sticker_image_url
    });
    setIsImagePreviewOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'image_url' | 'sticker_image_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1000,
        useWebWorker: true,
        initialQuality: 0.8
      };
      
      const compressedFile = await imageCompression(file, options);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${field}_${Date.now()}.${fileExt}`;
      const filePath = `serials/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('asset-images').upload(filePath, compressedFile);
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('asset-images').getPublicUrl(filePath);
      
      setEditForm(prev => ({ ...prev, [field]: publicUrl }));
      toast.success('อัปโหลดและบีบอัดรูปสำเร็จ');

    } catch (error: any) {
      console.error(error);
      toast.error('อัปโหลดล้มเหลว: ' + (error.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (field: 'image_url' | 'sticker_image_url') => {
    setEditForm(prev => ({ ...prev, [field]: '' }));
  };

  const handleUpdate = async () => {
    if (!selectedSerial) return;

    await updateSerial.mutateAsync({
      id: selectedSerial.id,
      status: editForm.status,
      sticker_status: editForm.sticker_status,
      sticker_date: editForm.sticker_date ? editForm.sticker_date : null,
      sticker_image_url: editForm.sticker_image_url || null,
      image_url: editForm.image_url || null,
      notes: editForm.notes || null,
      location_id: (editForm.location_id && editForm.location_id !== "all") ? editForm.location_id : null,
    });
    setIsEditOpen(false);
    setSelectedSerial(null);
  };

  const clearFilters = () => {
    setFilterStatus("all"); 
    setFilterLocation("all"); 
    setFilterSticker("all");
    setFilterCategory("all");
    setDateRange(undefined); 
    setSearch("");
  };

  const formatDate = (dateStr: string | null) => dateStr ? format(new Date(dateStr), "d MMM yy", { locale: th }) : "-";

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (search) chips.push({ key: "q", label: `ค้นหา: ${search}`, onClear: () => setSearch("") });
    if (filterCategory !== "all") chips.push({ key: "category", label: `หมวดหมู่: ${filterCategory}`, onClear: () => setFilterCategory("all") });
    if (filterStatus !== "all") {
      const label = serialStatusOptions.find((opt) => opt.value === filterStatus)?.label || filterStatus;
      chips.push({ key: "status", label: `สถานะ: ${label}`, onClear: () => setFilterStatus("all") });
    }
    if (filterLocation !== "all") {
      const label = locations?.find((l) => l.id === filterLocation)?.name || filterLocation;
      chips.push({ key: "location", label: `สถานที่: ${label}`, onClear: () => setFilterLocation("all") });
    }
    if (filterSticker !== "all") {
      const label = stickerStatusOptions.find((opt) => opt.value === filterSticker)?.label || filterSticker;
      chips.push({ key: "sticker", label: `สติ๊กเกอร์: ${label}`, onClear: () => setFilterSticker("all") });
    }
    if (dateRange?.from) {
      const label = dateRange.to
        ? `${format(dateRange.from, "d MMM", { locale: th })} - ${format(dateRange.to, "d MMM", { locale: th })}`
        : format(dateRange.from, "d MMM", { locale: th });
      chips.push({ key: "date", label: `วันที่ติด: ${label}`, onClear: () => setDateRange(undefined) });
    }
    return chips;
  }, [
    search,
    filterCategory,
    filterStatus,
    filterLocation,
    filterSticker,
    dateRange,
    serialStatusOptions,
    stickerStatusOptions,
    locations,
  ]);

  return (
    <MainLayout title="รายการทรัพย์สิน (Serials)">
      <div className="space-y-4 relative z-0 text-[15px] leading-6">
        <div className="md:hidden sticky top-0 z-20 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">รายการทรัพย์สิน</div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="ค้นหา" onClick={() => searchInputRef.current?.focus()}>
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="ตัวกรอง" onClick={() => setIsFilterOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="โปรไฟล์" asChild>
                <Link to="/settings">
                  <UserCircle className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center justify-between sticky top-0 z-20 bg-background/90 backdrop-blur border-b -mx-4 px-4 py-3">
          <div>
            <h1 className="text-[22px] font-semibold leading-7">รายการทรัพย์สิน (Serials)</h1>
            <p className="text-xs text-muted-foreground mt-1">ทั้งหมด {totalItems} รายการ</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="ค้นหา (Serial, ชื่อ, ยี่ห้อ)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label="ค้นหารายการ"
              />
            </div>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as "list" | "cards")}
              className="flex"
            >
              <ToggleGroupItem value="list" aria-label="List view">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="cards" aria-label="Card view">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        
        {/* --- Filters --- */}
        <Card className="border-none shadow-sm bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:sticky md:top-20 md:z-10">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 md:hidden">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="ค้นหา (Serial, ชื่อ, ยี่ห้อ)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                  aria-label="ค้นหารายการ"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="md:hidden" onClick={() => setIsFilterOpen(true)}>
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  ตัวกรอง
                </Button>
              </div>
            </div>

                <div className="md:hidden">
                  <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(value) => value && setViewMode(value as "list" | "cards")}
                    className="grid grid-cols-2 w-full"
                  >
                <ToggleGroupItem value="cards" aria-label="Cards view">
                  การ์ด
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view">
                  รายการ
                </ToggleGroupItem>
                  </ToggleGroup>
                </div>

            <div className="hidden md:flex flex-wrap gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[170px] h-9 text-xs focus:ring-0 focus:ring-offset-0">
                  <div className="flex items-center gap-2 truncate">
                    <Box className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="หมวดหมู่" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] h-9 text-xs focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {serialStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[150px] h-9 text-xs focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="สถานที่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานที่</SelectItem>
                  {locations?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSticker} onValueChange={setFilterSticker}>
                <SelectTrigger className="w-[150px] h-9 text-xs focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="สติ๊กเกอร์" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {stickerStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-auto justify-start text-left font-normal h-9 text-xs px-3 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dateRange?.from ? (
                      dateRange.to
                        ? `${format(dateRange.from, "d MMM", { locale: th })} - ${format(dateRange.to, "d MMM", { locale: th })}`
                        : format(dateRange.from, "d MMM", { locale: th })
                    ) : (
                      <span>วันที่ติด</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={1} />
                </PopoverContent>
              </Popover>

              {(filterStatus !== "all" || filterLocation !== "all" || filterSticker !== "all" || filterCategory !== "all" || dateRange) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-3 text-muted-foreground hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0">
                  ล้างตัวกรอง
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((chip) => (
              <Badge key={chip.key} variant="outline" className="gap-1 bg-background border border-muted text-xs">
                {chip.label}
                <button type="button" onClick={chip.onClear} className="rounded hover:bg-muted px-1" aria-label={`ลบตัวกรอง ${chip.label}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
              ล้างตัวกรองทั้งหมด
            </Button>
          </div>
        )}

        {/* --- Content Area --- */}
        <div className="bg-background rounded-lg border shadow-sm min-h-[500px] flex flex-col">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : (serials && serials.length > 0) ? (
            <>
              {/* Desktop Table View */}
              {viewMode === "list" && (
                <>
                  <div className="hidden md:block overflow-x-auto flex-1">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="w-[80px]">รูป</TableHead>
                          <TableHead>รายละเอียด (Serial)</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead>สถานที่</TableHead>
                          <TableHead>สติ๊กเกอร์</TableHead>
                          <TableHead className="text-right">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedSerials.map((serial) => {
                          const imageUrl = getSerialImage(serial);
                          return (
                          <TableRow key={serial.id} className="hover:bg-muted/30">
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => openImagePreview(serial)}
                                className="h-10 w-10 rounded bg-muted border flex items-center justify-center overflow-hidden"
                                aria-label="ดูรูปสินค้า"
                              >
                                {imageUrl ? (
                                  <img
                                    src={getOptimizedUrl(imageUrl, 100) || ""}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    alt="product"
                                  />
                                ) : (
                                  <ImageIcon className="h-4 w-4 text-muted-foreground"/>
                                )}
                              </button>
                            </TableCell>
                            <TableCell>
                              <button type="button" onClick={() => openDetails(serial)} className="text-left">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm">{serial.products?.name}</span>
                                  <span className="text-xs font-mono text-muted-foreground">{serial.serial_code}</span>
                                  <span className="text-[11px] text-muted-foreground">{serial.products?.brand} · {serial.products?.model}</span>
                                </div>
                              </button>
                            </TableCell>
                            <TableCell><StatusPill meta={getSerialStatusMeta(serial.status)} /></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{serial.locations?.name || '-'}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <StatusPill meta={getStickerStatusMeta(serial.sticker_status)} />
                                {serial.sticker_date && <span className="text-[10px] text-muted-foreground">{formatDate(serial.sticker_date)}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openDetails(serial)}><Eye className="h-4 w-4 text-blue-500"/></Button>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(serial)}><Pencil className="h-4 w-4 text-orange-500"/></Button>
                              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    if(confirm(`ยืนยันลบรายการ ${serial.serial_code}?\n(สต็อกรวมจะลดลง 1)`)) {
                                      deleteSerial.mutate(serial.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4"/>
                                </Button>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="md:hidden divide-y flex-1">
                    {paginatedSerials.map((serial) => {
                      const imageUrl = getSerialImage(serial);
                      return (
                      <div key={serial.id} className="p-4 flex gap-3 active:bg-muted/50 transition-colors">
                        <button
                          type="button"
                          onClick={() => openImagePreview(serial)}
                          className="h-14 w-14 rounded bg-muted border flex items-center justify-center overflow-hidden shrink-0 mt-1"
                          aria-label="ดูรูปสินค้า"
                        >
                          {imageUrl ? (
                            <img 
                              src={getOptimizedUrl(imageUrl, 150) || ""}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground"/>
                          )}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <button type="button" onClick={() => openDetails(serial)} className="font-semibold text-sm line-clamp-2 leading-tight text-foreground/90 text-left" title={serial.products?.name}>
                              {serial.products?.name}
                            </button>
                            <StatusPill meta={getSerialStatusMeta(serial.status)} className="shrink-0" />
                          </div>

                          <div className="text-xs text-muted-foreground space-y-0.5">
                             <div className="flex items-center gap-1">
                                <Barcode className="h-3 w-3 opacity-70"/> 
                                <span className="font-mono text-foreground/80">{serial.serial_code}</span>
                             </div>
                             <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 mt-1 bg-muted/20 p-1.5 rounded text-[11px]">
                                <div className="flex justify-between w-full">
                                   <span className="opacity-70">ยี่ห้อ:</span>
                                   <span className="font-medium text-foreground/90 truncate max-w-[120px]">{serial.products?.brand || '-'}</span>
                                </div>
                                <div className="flex justify-between w-full">
                                   <span className="opacity-70">รุ่น:</span>
                                   <span className="font-medium text-foreground/90 truncate max-w-[120px]">{serial.products?.model || '-'}</span>
                                </div>
                             </div>
                             
                             <div className="flex items-center gap-1 pt-1">
                                <MapPin className="h-3 w-3 opacity-70"/>
                                <span className="truncate">{serial.locations?.name || '-'}</span>
                             </div>
                          </div>
                        </div>

                        <div className="flex flex-col justify-center gap-2 border-l pl-2 ml-1 shrink-0">
                           <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-blue-50 text-blue-600" onClick={() => openDetails(serial)}><Eye className="h-4 w-4"/></Button>
                           <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-orange-50 text-orange-600" onClick={() => openEditDialog(serial)}><Pencil className="h-4 w-4"/></Button>
                           <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-red-50 text-red-600" onClick={() => {
                              if(confirm('ยืนยันลบรายการนี้?')) deleteSerial.mutate(serial.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4"/>
                            </Button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </>
              )}

              {viewMode === "cards" && (
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                  {paginatedSerials.map((serial) => {
                    const imageUrl = getSerialImage(serial);
                    return (
                    <div
                      key={serial.id}
                      className="relative rounded-xl border bg-background/90 p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition cursor-pointer h-full flex flex-col"
                      onClick={() => openDetails(serial)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetails(serial);
                        }
                      }}
                    >
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <button
                          type="button"
                          onClick={() => openImagePreview(serial)}
                          className="h-44 w-full md:h-24 md:w-24 rounded-lg bg-muted border flex items-center justify-center overflow-hidden shrink-0"
                          aria-label="ดูรูปสินค้า"
                          onClickCapture={(e) => e.stopPropagation()}
                        >
                          {imageUrl ? (
                            <img src={getOptimizedUrl(imageUrl, 240) || ""} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1 pr-24">
                          <div className="font-semibold text-[16px] leading-6 line-clamp-2 break-words">
                            {serial.products?.name || "-"}
                          </div>
                          {(serial.products?.brand || serial.products?.model) && (
                            <div className="text-[12px] text-muted-foreground line-clamp-1">
                              {serial.products?.brand || "-"}{serial.products?.model ? ` · ${serial.products?.model}` : ""}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                        <StatusPill meta={getSerialStatusMeta(serial.status)} />
                        {serial.sticker_status === "pending" && (
                          <StatusPill meta={getStickerStatusMeta(serial.sticker_status)} />
                        )}
                      </div>

                      <div className="mt-3 text-[12px] text-muted-foreground">
                        ผู้ถือครอง: -
                      </div>

                      <div className="mt-auto pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                        <Button size="sm" onClick={() => openDetails(serial)} onClickCapture={(e) => e.stopPropagation()}>
                          รายละเอียด
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(serial)} onClickCapture={(e) => e.stopPropagation()}>
                          แก้ไข
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center p-4 border-t mt-auto">
                  <div className="w-full flex flex-col items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      กำลังแสดง {startItem}–{endItem} จาก {totalItems}
                    </div>
                    <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) setCurrentPage(p => p - 1);
                          }}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      
                      {getPaginationItems().map((page, index) => {
                        if (page === 'ellipsis') {
                          return (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === page}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page as number);
                              }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      <PaginationItem>
                        <PaginationNext 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) setCurrentPage(p => p + 1);
                          }}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground flex-1">
              <Barcode className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">ไม่พบรายการที่ตรงกับตัวกรอง</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>
                ล้างตัวกรอง
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* View Dialog */}
      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>ตัวกรอง</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full h-10 text-sm focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="หมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full h-10 text-sm focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {serialStatusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="w-full h-10 text-sm focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="สถานที่" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานที่</SelectItem>
                {locations?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSticker} onValueChange={setFilterSticker}>
              <SelectTrigger className="w-full h-10 text-sm focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="สติ๊กเกอร์" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {stickerStatusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal h-10 text-sm px-3 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to
                      ? `${format(dateRange.from, "d MMM", { locale: th })} - ${format(dateRange.to, "d MMM", { locale: th })}`
                      : format(dateRange.from, "d MMM", { locale: th })
                  ) : (
                    <span>วันที่ติด</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={1} />
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={clearFilters}>
                ล้างทั้งหมด
              </Button>
              <Button className="flex-1" onClick={() => setIsFilterOpen(false)}>
                ใช้ตัวกรอง
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"} className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>รายละเอียดทรัพย์สิน</SheetTitle>
          </SheetHeader>
          {selectedSerial && (
            <div className="mt-4 space-y-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => openImagePreview(selectedSerial)}
                  className="h-52 w-full sm:h-36 sm:w-36 rounded-xl bg-muted border flex items-center justify-center overflow-hidden"
                >
                  {(() => {
                    const detailImage = getSerialImage(selectedSerial);
                    return detailImage ? (
                      <img src={getOptimizedUrl(detailImage, 240) || ""} className="w-full h-full object-cover" alt="product" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    );
                  })()}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[18px] leading-6">{selectedSerial.products?.name}</div>
                  <div className="text-xs font-mono text-muted-foreground">{selectedSerial.serial_code}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusPill meta={getSerialStatusMeta(selectedSerial.status)} />
                    <StatusPill meta={getStickerStatusMeta(selectedSerial.sticker_status)} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[12px] font-medium text-muted-foreground mb-2">ข้อมูลพื้นฐาน</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">สถานที่</Label>
                      <div>{selectedSerial.locations?.name || "-"}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ผู้ใช้งาน</Label>
                      <div>-</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[12px] font-medium text-muted-foreground mb-2">สถานะ</div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill meta={getSerialStatusMeta(selectedSerial.status)} />
                    <StatusPill meta={getStickerStatusMeta(selectedSerial.sticker_status)} />
                  </div>
                </div>

                <div>
                  <div className="text-[12px] font-medium text-muted-foreground mb-2">หมายเหตุ</div>
                  <div className="text-sm text-muted-foreground">{selectedSerial.notes || "-"}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => openEditDialog(selectedSerial)}>
                  แก้ไขข้อมูล
                </Button>
                <Button className="flex-1" onClick={() => openEditDialog(selectedSerial)}>
                  อัปเดตสถานะ
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>ดูรูปภาพ</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="product" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="product">รูปสินค้า</TabsTrigger>
              <TabsTrigger value="sticker">รูปสติ๊กเกอร์</TabsTrigger>
            </TabsList>
            <TabsContent value="product">
              <div className="mt-3 aspect-video bg-muted rounded-lg border flex items-center justify-center overflow-hidden">
                {imagePreview.productUrl ? (
                  <img src={imagePreview.productUrl} className="w-full h-full object-contain" alt="product" />
                ) : (
                  <span className="text-xs text-muted-foreground">ไม่มีรูปสินค้า</span>
                )}
              </div>
            </TabsContent>
            <TabsContent value="sticker">
              <div className="mt-3 aspect-video bg-muted rounded-lg border flex items-center justify-center overflow-hidden">
                {imagePreview.stickerUrl ? (
                  <img src={imagePreview.stickerUrl} className="w-full h-full object-contain" alt="sticker" />
                ) : (
                  <span className="text-xs text-muted-foreground">ไม่มีรูปสติ๊กเกอร์</span>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>แก้ไขข้อมูล</DialogTitle>
            <DialogDescription>{selectedSerial?.serial_code}</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6">
             <div className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label>สถานะ</Label>
                      <Select value={editForm.status} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v }))}>
                        <SelectTrigger className="focus-visible:ring-0 focus-visible:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {/* ใช้ serialStatusOptions */}
                          {serialStatusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-2">
                      <Label>สถานที่</Label>
                      <Select value={editForm.location_id} onValueChange={(v) => setEditForm(prev => ({...prev, location_id: v}))}>
                        <SelectTrigger className="focus-visible:ring-0 focus-visible:ring-offset-0"><SelectValue placeholder="เลือกสถานที่"/></SelectTrigger>
                        <SelectContent>{locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                </div>

                <div className="space-y-2">
                   <Label>รูปภาพสินค้า</Label>
                   <div className="flex gap-4 items-center p-3 border rounded-lg border-dashed relative">
                      <div className="relative group h-16 w-16 shrink-0">
                        <div className="h-16 w-16 bg-muted rounded flex items-center justify-center overflow-hidden border">
                           {editForm.image_url ? (
                             <img src={editForm.image_url} className="w-full h-full object-cover"/>
                           ) : (
                             <Camera className="h-6 w-6 text-muted-foreground"/>
                           )}
                        </div>
                        {editForm.image_url && (
                          <button
                            type="button"
                            onClick={() => handleRemoveImage('image_url')}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                            title="ลบรูปภาพ"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          className="text-xs focus-visible:ring-0" 
                          onChange={(e) => handleUpload(e, 'image_url')} 
                          disabled={isUploading}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">อัปโหลดรูปใหม่เพื่อแทนที่ หรือกด X ที่รูปเพื่อลบออก</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-2">
                   <Label>สถานะสติ๊กเกอร์</Label>
                   <div className="flex gap-2">
                      <Select value={editForm.sticker_status} onValueChange={(v) => setEditForm(prev => ({...prev, sticker_status: v}))}>
                        <SelectTrigger className="flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {stickerStatusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {editForm.sticker_status === 'done' && (
                         <Input type="date" className="w-[140px] focus-visible:ring-0" value={editForm.sticker_date} onChange={(e) => setEditForm(prev => ({...prev, sticker_date: e.target.value}))}/>
                      )}
                   </div>
                </div>

                {editForm.sticker_status === 'done' && (
                  <div className="space-y-2">
                      <Label>รูปถ่ายการติดสติ๊กเกอร์</Label>
                      <div className="flex gap-4 items-center p-3 border rounded-lg border-dashed">
                         <div className="relative group h-16 w-16 shrink-0">
                           <div className="h-16 w-16 bg-muted rounded flex items-center justify-center overflow-hidden border">
                              {editForm.sticker_image_url ? (
                                <img src={editForm.sticker_image_url} className="w-full h-full object-cover"/>
                              ) : (
                                <Barcode className="h-6 w-6 text-muted-foreground"/>
                              )}
                           </div>
                           {editForm.sticker_image_url && (
                            <button
                              type="button"
                              onClick={() => handleRemoveImage('sticker_image_url')}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                              title="ลบรูปภาพ"
                            >
                              <X className="h-3 w-3" />
                            </button>
                           )}
                         </div>

                         <div className="flex-1">
                            <Input 
                              type="file" 
                              accept="image/*" 
                              className="text-xs focus-visible:ring-0" 
                              onChange={(e) => handleUpload(e, 'sticker_image_url')} 
                              disabled={isUploading}
                            />
                         </div>
                      </div>
                  </div>
                )}
                
                <div className="space-y-2">
                   <Label>หมายเหตุ</Label>
                   <Textarea className="focus-visible:ring-0" value={editForm.notes} onChange={(e) => setEditForm(prev => ({...prev, notes: e.target.value}))} placeholder="ระบุอาการเสีย หรือข้อมูลเพิ่มเติม..."/>
                </div>
             </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleUpdate} disabled={updateSerial.isPending || isUploading}>
              {updateSerial.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}













