import { useState, useMemo, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Pencil, Barcode, Image as ImageIcon, Camera, MapPin, 
  Eye, Calendar as CalendarIcon, X, Box, Trash2,
  LayoutGrid, List, Settings
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
import { CardGrid } from "@/components/shared/CardGrid";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveFilters } from "@/components/shared/ResponsiveFilters";
import { ResponsiveTable } from "@/components/shared/ResponsiveTable";

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
type StatusOption = { value: string; label: string };

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
  pending: { label: "รอติดสติกเกอร์", className: "bg-amber-50 text-amber-700 border-amber-200" },
  done: { label: "ติดสติกเกอร์แล้ว", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  completed: { label: "ติดสติกเกอร์แล้ว", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  missing: { label: "ไม่มีสติกเกอร์", className: "bg-slate-50 text-slate-700 border-slate-200" },
  none: { label: "ไม่มีสติกเกอร์", className: "bg-slate-50 text-slate-700 border-slate-200" },
};

const defaultSerialStatusOptions: StatusOption[] = [
  { value: "ready", label: "พร้อมใช้" },
  { value: "in_use", label: "กำลังใช้งาน" },
  { value: "in_repair", label: "ส่งซ่อม" },
  { value: "damaged", label: "เสียหาย" },
  { value: "unavailable", label: "ไม่พร้อมใช้" },
  { value: "retired", label: "เลิกใช้" },
  { value: "lost", label: "สูญหาย" },
];

const defaultStickerStatusOptions: StatusOption[] = [
  { value: "pending", label: "รอติดสติกเกอร์" },
  { value: "done", label: "ติดสติกเกอร์แล้ว" },
  { value: "missing", label: "ไม่มีสติกเกอร์" },
];

const serialStatusAliases: Record<string, string> = {
  ready: "ready",
  "พร้อมใช้": "ready",
  in_use: "in_use",
  "in use": "in_use",
  borrowed: "in_use",
  "กำลังใช้งาน": "in_use",
  damaged: "damaged",
  "เสียหาย": "damaged",
  repair: "in_repair",
  in_repair: "in_repair",
  "ส่งซ่อม": "in_repair",
  retired: "retired",
  disposed: "retired",
  "เลิกใช้": "retired",
  lost: "lost",
  "สูญหาย": "lost",
  inactive: "unavailable",
  unavailable: "unavailable",
  "ไม่พร้อมใช้": "unavailable",
};

const stickerStatusAliases: Record<string, string> = {
  pending: "pending",
  "รอติดสติกเกอร์": "pending",
  done: "done",
  completed: "done",
  "ติดสติกเกอร์แล้ว": "done",
  missing: "missing",
  none: "missing",
  "ไม่มีสติกเกอร์": "missing",
};

const normalizeToOption = (
  value: string | null | undefined,
  options: StatusOption[],
  aliases: Record<string, string>,
  fallbackValue: string,
) => {
  const raw = (value ?? "").trim();
  const normalizedRaw = raw.toLowerCase();
  const resolved = aliases[normalizedRaw] ?? normalizedRaw;
  const matched =
    options.find((option) => option.value.toLowerCase() === resolved) ??
    options.find((option) => option.value.toLowerCase() === normalizedRaw);

  if (matched) return matched.value;
  return options.find((option) => option.value === fallbackValue)?.value ?? options[0]?.value ?? fallbackValue;
};

const getSerialStatusMeta = (status: string | null): BadgeMeta => {
  if (!status) return { label: "ไม่ทราบสถานะ", className: "bg-slate-50 text-slate-700 border-slate-200" };
  const key = status.toLowerCase();
  return serialStatusMetaMap[key] || { label: "ไม่ทราบสถานะ", className: "bg-slate-50 text-slate-700 border-slate-200" };
};

const getStickerStatusMeta = (status: string | null): BadgeMeta => {
  if (!status) return { label: "ไม่มีสติกเกอร์", className: "bg-slate-50 text-slate-700 border-slate-200" };
  const key = status.toLowerCase();
  return stickerStatusMetaMap[key] || { label: "ไม่มีสติกเกอร์", className: "bg-slate-50 text-slate-700 border-slate-200" };
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
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ productUrl?: string | null; stickerUrl?: string | null }>({});

  const initialView = (searchParams.get("view") as "list" | "cards" | null)
    || (localStorage.getItem("serials:view") as "list" | "cards" | null)
    || (isMobile ? "cards" : "list");
  const [viewMode, setViewMode] = useState<"list" | "cards">(initialView);

  const { data: serialStatuses } = useSerialStatuses();
  const { data: stickerStatuses } = useStickerStatuses();
  
  const serialStatusOptions = useMemo<StatusOption[]>(() => {
    const options = serialStatuses?.map((status) => ({
      value: status.status_code,
      label: status.display_name_th,
    })) || [];
    return options.length > 0 ? options : defaultSerialStatusOptions;
  }, [serialStatuses]);

  const stickerStatusOptions = useMemo<StatusOption[]>(() => {
    const options = stickerStatuses?.map((status) => ({
      value: status.status_code,
      label: status.display_name_th,
    })) || [];
    return options.length > 0 ? options : defaultStickerStatusOptions;
  }, [stickerStatuses]);

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
  const baseProductImage = selectedSerial?.products?.image_url || null;
  const displayedEditProductImage = editForm.image_url || selectedSerial?.image_url || baseProductImage || null;
  const showingBaseProductImage = !editForm.image_url && !!baseProductImage;

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
    setIsDetailsOpen(false);
    const normalizedStatus = normalizeToOption(
      serial.status,
      serialStatusOptions,
      serialStatusAliases,
      "ready",
    );
    const normalizedStickerStatus = normalizeToOption(
      serial.sticker_status,
      stickerStatusOptions,
      stickerStatusAliases,
      "pending",
    );
    setEditForm({
      status: normalizedStatus,
      sticker_status: normalizedStickerStatus,
      sticker_date:
        normalizedStickerStatus === "done" || normalizedStickerStatus === "completed"
          ? serial.sticker_date || ""
          : "",
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

  const openEditImagePreview = () => {
    if (!selectedSerial) return;
    setImagePreview({
      productUrl: displayedEditProductImage,
      stickerUrl: editForm.sticker_image_url || selectedSerial.sticker_image_url,
    });
    setIsImagePreviewOpen(true);
  };

  const isStickerCompleted =
    editForm.sticker_status === "done" || editForm.sticker_status === "completed";

  const handleStickerStatusChange = (value: string) => {
    setEditForm((prev) => ({ ...prev, sticker_status: value }));
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

    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`อัปโหลดล้มเหลว: ${message}`);
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
    if (!editForm.status) {
      toast.error("กรุณาเลือกสถานะ");
      return;
    }
    if (!editForm.sticker_status) {
      toast.error("กรุณาเลือกสถานะสติ๊กเกอร์");
      return;
    }

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
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="รายการทรัพย์สิน"
          description={`ทั้งหมด ${totalItems} รายการ`}
        />

        <ResponsiveFilters
          sticky
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="ค้นหาชื่อสินค้า..."
          searchAriaLabel="ค้นหาชื่อสินค้า"
          actions={
            <>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as "list" | "cards")}
                className="hidden rounded-full border bg-background/70 p-1 md:flex"
              >
                <ToggleGroupItem
                  value="list"
                  aria-label="List view"
                  className="h-9 w-9 rounded-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="cards"
                  aria-label="Card view"
                  className="h-9 w-9 rounded-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as "list" | "cards")}
                className="grid w-full grid-cols-2 rounded-lg border bg-background/70 p-1 md:hidden"
              >
                <ToggleGroupItem
                  value="list"
                  aria-label="List view"
                  className="h-10 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  รายการ
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="cards"
                  aria-label="Cards view"
                  className="h-10 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  การ์ด
                </ToggleGroupItem>
              </ToggleGroup>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 md:h-10 md:w-10"
                aria-label="System settings"
                asChild
              >
                <Link to="/settings">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
            </>
          }
          filters={
            <>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-10 w-[180px] text-sm focus:ring-0 focus:ring-offset-0">
                  <div className="flex items-center gap-2 truncate">
                    <Box className="h-4 w-4 text-muted-foreground" />
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
                <SelectTrigger className="h-10 w-[160px] text-sm focus:ring-0 focus:ring-offset-0">
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
                <SelectTrigger className="h-10 w-[170px] text-sm focus:ring-0 focus:ring-offset-0">
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
                <SelectTrigger className="h-10 w-[160px] text-sm focus:ring-0 focus:ring-offset-0">
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
                  <Button
                    variant="outline"
                    className="h-10 w-auto justify-start text-left text-sm font-normal focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
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
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>

              {(filterStatus !== "all" ||
                filterLocation !== "all" ||
                filterSticker !== "all" ||
                filterCategory !== "all" ||
                dateRange) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-10 px-3 text-muted-foreground hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  ล้างตัวกรอง
                </Button>
              )}
            </>
          }
          mobileFilters={
            <>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-11 w-full text-sm focus:ring-0 focus:ring-offset-0">
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
                <SelectTrigger className="h-11 w-full text-sm focus:ring-0 focus:ring-offset-0">
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
                <SelectTrigger className="h-11 w-full text-sm focus:ring-0 focus:ring-offset-0">
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
                <SelectTrigger className="h-11 w-full text-sm focus:ring-0 focus:ring-offset-0">
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
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start text-left text-sm font-normal focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
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
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            </>
          }
          onClear={clearFilters}
        />

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
              {viewMode === "list" && (
                <ResponsiveTable
                  table={
                    <div className="overflow-x-auto flex-1">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead className="w-[80px]">รูป</TableHead>
                            <TableHead>ชื่อทรัพย์สิน</TableHead>
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
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <button type="button" onClick={() => openDetails(serial)} className="text-left">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="line-clamp-2 text-sm font-semibold leading-5" title={serial.products?.name || "-"}>
                                        {serial.products?.name || "-"}
                                      </span>
                                      <span className="line-clamp-1 text-[11px] text-muted-foreground">
                                        {serial.products?.brand || "-"}
                                        {serial.products?.model ? ` · ${serial.products.model}` : ""}
                                      </span>
                                    </div>
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <StatusPill meta={getSerialStatusMeta(serial.status)} />
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {serial.locations?.name || "-"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-0.5">
                                    <StatusPill meta={getStickerStatusMeta(serial.sticker_status)} />
                                    {serial.sticker_date && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatDate(serial.sticker_date)}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => openDetails(serial)}>
                                      <Eye className="h-4 w-4" />
                                      รายละเอียด
                                    </Button>
                                    <Button variant="default" size="sm" className="h-9 rounded-lg" onClick={() => openEditDialog(serial)}>
                                      <Pencil className="h-4 w-4" />
                                      แก้ไข
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
                                      onClick={() => {
                                        if (confirm(`ยืนยันลบรายการนี้?\n(สต็อกรวมจะลดลง 1)`)) {
                                          deleteSerial.mutate(serial.id);
                                        }
                                      }}
                                      aria-label="ลบรายการ"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  }
                  stacked={
                    <div className="divide-y flex-1">
                      {paginatedSerials.map((serial) => {
                        const imageUrl = getSerialImage(serial);
                        return (
                          <div key={serial.id} className="p-4 flex gap-3 active:bg-muted/50 transition-colors">
                            <button
                              type="button"
                              onClick={() => openImagePreview(serial)}
                              className="h-16 w-16 rounded-lg bg-muted border flex items-center justify-center overflow-hidden shrink-0"
                              aria-label="ดูรูปสินค้า"
                            >
                              {imageUrl ? (
                                <img
                                  src={getOptimizedUrl(imageUrl, 150) || ""}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <button
                                  type="button"
                                  onClick={() => openDetails(serial)}
                                  className="font-semibold text-sm line-clamp-2 leading-tight text-foreground/90 text-left"
                                  title={serial.products?.name}
                                >
                                  {serial.products?.name}
                                </button>
                                <StatusPill meta={getSerialStatusMeta(serial.status)} className="shrink-0" />
                              </div>

                              <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 opacity-70" />
                                  <span className="truncate">{serial.locations?.name || "-"}</span>
                                </div>
                                <StatusPill meta={getStickerStatusMeta(serial.sticker_status)} className="w-fit text-[11px]" />
                              </div>
                            </div>

                            <div className="flex flex-col justify-center gap-2 border-l pl-2 ml-1 shrink-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-full bg-blue-50 text-blue-600"
                                    onClick={() => openDetails(serial)}
                                    aria-label="ดูรายละเอียด"
                                  >
                                    <Eye className="h-5 w-5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">รายละเอียด</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-full bg-orange-50 text-orange-600"
                                    onClick={() => openEditDialog(serial)}
                                    aria-label="แก้ไข"
                                  >
                                    <Pencil className="h-5 w-5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">แก้ไข</TooltipContent>
                              </Tooltip>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-full bg-red-50 text-red-600"
                                onClick={() => {
                                  if (confirm("ยืนยันลบรายการนี้?")) deleteSerial.mutate(serial.id);
                                }}
                                aria-label="ลบรายการ"
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  }
                />
              )}

              {viewMode === "cards" && (
                <CardGrid className="p-4">
                  {paginatedSerials.map((serial) => {
                    const imageUrl = getSerialImage(serial);
                    return (
                      <Card
                        key={serial.id}
                        className="h-full border-border/60 bg-background/90 shadow-sm transition hover:shadow-md"
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
                        <CardContent className="flex h-full flex-col p-4">
                          <button
                            type="button"
                            onClick={() => openImagePreview(serial)}
                            className="group w-full"
                            aria-label="ดูรูปสินค้า"
                            onClickCapture={(event) => event.stopPropagation()}
                          >
                            <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-lg border bg-muted">
                              {imageUrl ? (
                                <img
                                  src={getOptimizedUrl(imageUrl, 320) || ""}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  alt={serial.products?.name || "asset"}
                                />
                              ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                                  <ImageIcon className="h-6 w-6" />
                                  <span className="text-xs">ไม่มีรูปภาพ</span>
                                </div>
                              )}
                            </AspectRatio>
                          </button>

                          <div className="mt-3 space-y-2">
                            <div className="line-clamp-2 text-base font-semibold leading-6" title={serial.products?.name || "-"}>
                              {serial.products?.name || "-"}
                            </div>
                            {(serial.products?.brand || serial.products?.model) && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {serial.products?.brand || "-"}
                                {serial.products?.model ? ` · ${serial.products?.model}` : ""}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <StatusPill meta={getSerialStatusMeta(serial.status)} className="text-xs" />
                              <StatusPill meta={getStickerStatusMeta(serial.sticker_status)} className="text-xs" />
                            </div>
                          </div>

                          <div className="mt-auto flex gap-2 pt-4">
                            <Button
                              className="h-11 w-11 sm:flex-1"
                              onClick={() => openDetails(serial)}
                              onClickCapture={(event) => event.stopPropagation()}
                              aria-label="ดูรายละเอียด"
                              title="ดูรายละเอียด"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">รายละเอียด</span>
                            </Button>
                            <Button
                              variant="outline"
                              className="h-11 w-11 sm:flex-1"
                              onClick={() => openEditDialog(serial)}
                              onClickCapture={(event) => event.stopPropagation()}
                              aria-label="แก้ไข"
                              title="แก้ไข"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="hidden sm:inline">แก้ไข</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </CardGrid>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="border-t p-4 mt-auto">
                  <div className="w-full flex flex-col items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      กำลังแสดง {startItem}–{endItem} จาก {totalItems}
                    </div>
                    <div className="flex w-full items-center justify-between gap-2 md:hidden">
                      <Button
                        variant="outline"
                        className="h-11 flex-1"
                        onClick={() => currentPage > 1 && setCurrentPage((prev) => prev - 1)}
                        disabled={currentPage === 1}
                      >
                        ก่อนหน้า
                      </Button>
                      <div className="text-xs font-medium text-muted-foreground">
                        {currentPage} / {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        className="h-11 flex-1"
                        onClick={() => currentPage < totalPages && setCurrentPage((prev) => prev + 1)}
                        disabled={currentPage === totalPages}
                      >
                        ถัดไป
                      </Button>
                    </div>
                    <div className="hidden md:block">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) setCurrentPage((p) => p - 1);
                              }}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>

                          {getPaginationItems().map((page, index) => {
                            if (page === "ellipsis") {
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
                                if (currentPage < totalPages) setCurrentPage((p) => p + 1);
                              }}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
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
      
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"} className="w-full sm:max-w-xl p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-xl">รายละเอียดทรัพย์สิน</SheetTitle>
          </SheetHeader>
          {selectedSerial && (
            <div className="flex h-full flex-col overflow-y-auto px-6 py-5">
              <div className="rounded-2xl border bg-muted/20 p-3">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openImagePreview(selectedSerial)}
                    className="h-52 w-full shrink-0 rounded-xl border bg-background sm:h-36 sm:w-36"
                    aria-label="ดูรูปภาพทรัพย์สิน"
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
                    <p className="line-clamp-2 text-xl font-semibold leading-7">{selectedSerial.products?.name || "-"}</p>
                    <p className="mt-1 text-xs font-mono text-muted-foreground">{selectedSerial.serial_code}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill meta={getSerialStatusMeta(selectedSerial.status)} className="text-xs" />
                      <StatusPill meta={getStickerStatusMeta(selectedSerial.sticker_status)} className="text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <section className="rounded-xl border bg-background p-4">
                  <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">ข้อมูลพื้นฐาน</div>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">สถานที่</Label>
                      <div className="font-medium">{selectedSerial.locations?.name || "-"}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Serial</Label>
                      <div className="font-mono">{selectedSerial.serial_code}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">สถานะ</Label>
                      <StatusPill meta={getSerialStatusMeta(selectedSerial.status)} className="w-fit text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">สติ๊กเกอร์</Label>
                      <StatusPill meta={getStickerStatusMeta(selectedSerial.sticker_status)} className="w-fit text-xs" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">วันที่ติดสติ๊กเกอร์</Label>
                      <div>{formatDate(selectedSerial.sticker_date)}</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border bg-background p-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">หมายเหตุ</div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{selectedSerial.notes || "-"}</p>
                </section>
              </div>

              <div className="sticky bottom-0 mt-5 border-t bg-background/95 pb-1 pt-4 backdrop-blur">
                <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => openImagePreview(selectedSerial)}>
                  ดูรูปภาพ
                </Button>
                <Button className="flex-1" onClick={() => openEditDialog(selectedSerial)}>
                  แก้ไขข้อมูล
                </Button>
                </div>
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
        <DialogContent className="w-[96vw] max-w-[980px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-xl">แก้ไขข้อมูล</DialogTitle>
            <DialogDescription>{selectedSerial?.serial_code}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-1 flex-col overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              void handleUpdate();
            }}
          >
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
                <aside className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <button
                      type="button"
                      onClick={openEditImagePreview}
                      className="group relative flex min-h-[240px] w-full items-center justify-center overflow-hidden rounded-lg border bg-background p-3"
                      aria-label="ดูรูปภาพแบบขยาย"
                    >
                      {displayedEditProductImage ? (
                        <>
                          <img src={displayedEditProductImage} alt={selectedSerial?.products?.name || "asset"} className="h-full w-full object-contain" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                            คลิกเพื่อดูรูปใหญ่
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Camera className="h-8 w-8" />
                          <span className="text-xs">ยังไม่มีรูปภาพสินค้า</span>
                        </div>
                      )}
                    </button>
                    <div className="mt-3">
                      <p className="line-clamp-2 text-base font-semibold">{selectedSerial?.products?.name || "-"}</p>
                      <p className="text-xs font-mono text-muted-foreground">{selectedSerial?.serial_code}</p>
                      {showingBaseProductImage && (
                        <p className="mt-1 text-[11px] text-muted-foreground">กำลังแสดงรูปเดิมจากสินค้า</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusPill meta={getSerialStatusMeta(editForm.status)} className="text-xs" />
                        <StatusPill meta={getStickerStatusMeta(editForm.sticker_status)} className="text-xs" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-background p-3">
                    <Label className="text-xs text-muted-foreground">รูปภาพสินค้า</Label>
                    <Input
                      id="serial-product-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUpload(e, "image_url")}
                      disabled={isUploading}
                    />
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={isUploading} asChild>
                        <label htmlFor="serial-product-image-upload" className="cursor-pointer">
                          {isUploading ? "กำลังอัปโหลด..." : "อัปโหลด / เปลี่ยนรูป"}
                        </label>
                      </Button>
                      {editForm.image_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveImage("image_url")}>
                          ลบรูป
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">รองรับ JPG/PNG, ระบบบีบอัดอัตโนมัติ</p>
                    {baseProductImage && (
                      <div className="mt-3 rounded-lg border bg-muted/20 p-2">
                        <p className="text-[11px] text-muted-foreground">รูปเดิมของสินค้า (อ้างอิง)</p>
                        <button
                          type="button"
                          className="mt-2 h-20 w-full overflow-hidden rounded-md border bg-background"
                          onClick={() => {
                            setImagePreview((prev) => ({
                              ...prev,
                              productUrl: baseProductImage,
                            }));
                            setIsImagePreviewOpen(true);
                          }}
                        >
                          <img src={baseProductImage} alt="base product" className="h-full w-full object-cover" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border bg-background p-3">
                    <Label className="text-xs text-muted-foreground">รูปถ่ายการติดสติ๊กเกอร์</Label>
                    <button
                      type="button"
                      onClick={openEditImagePreview}
                      disabled={!editForm.sticker_image_url}
                      className="mt-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/20 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="ดูรูปภาพสติ๊กเกอร์"
                    >
                      {editForm.sticker_image_url ? (
                        <img src={editForm.sticker_image_url} alt="sticker" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <Barcode className="h-6 w-6" />
                          <span className="text-xs">ยังไม่มีรูปสติ๊กเกอร์</span>
                        </div>
                      )}
                    </button>

                    <Input
                      id="serial-sticker-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUpload(e, "sticker_image_url")}
                      disabled={isUploading}
                    />
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={isUploading} asChild>
                        <label htmlFor="serial-sticker-image-upload" className="cursor-pointer">
                          {isUploading ? "กำลังอัปโหลด..." : "อัปโหลดรูปสติ๊กเกอร์"}
                        </label>
                      </Button>
                      {editForm.sticker_image_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveImage("sticker_image_url")}>
                          ลบรูป
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">รูปสติ๊กเกอร์เป็นข้อมูลเสริม สามารถบันทึกได้แม้ไม่ระบุวันที่ติด</p>
                  </div>
                </aside>

                <div className="space-y-4">
                  <section className="rounded-xl border bg-background p-4">
                    <div className="mb-3 text-sm font-semibold">สถานะและสถานที่</div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="serial-status">สถานะ</Label>
                        <Select value={editForm.status} onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}>
                          <SelectTrigger id="serial-status">
                            <SelectValue placeholder="เลือกสถานะ" />
                          </SelectTrigger>
                          <SelectContent>
                            {serialStatusOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="serial-location">สถานที่</Label>
                        <Select
                          value={editForm.location_id || "__none__"}
                          onValueChange={(value) =>
                            setEditForm((prev) => ({
                              ...prev,
                              location_id: value === "__none__" ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger id="serial-location">
                            <SelectValue placeholder="เลือกสถานที่" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">ไม่ระบุสถานที่</SelectItem>
                            {locations?.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border bg-background p-4">
                    <div className="mb-3 text-sm font-semibold">สถานะสติ๊กเกอร์</div>
                    <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                      <div className="space-y-2">
                        <Label htmlFor="serial-sticker-status">สถานะสติ๊กเกอร์</Label>
                        <Select value={editForm.sticker_status} onValueChange={handleStickerStatusChange}>
                          <SelectTrigger id="serial-sticker-status">
                            <SelectValue placeholder="เลือกสถานะสติ๊กเกอร์" />
                          </SelectTrigger>
                          <SelectContent>
                            {stickerStatusOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="serial-sticker-date">วันที่ติด</Label>
                        <Input
                          id="serial-sticker-date"
                          type="date"
                          value={editForm.sticker_date}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, sticker_date: e.target.value }))}
                          disabled={!isStickerCompleted}
                        />
                      </div>
                    </div>
                    {!isStickerCompleted && (
                      <p className="mt-3 text-xs text-muted-foreground">เมื่อยังไม่ติดสติ๊กเกอร์ ระบบจะไม่บันทึกวันที่และรูปสติ๊กเกอร์</p>
                    )}
                  </section>

                  <section className="rounded-xl border bg-background p-4">
                    <div className="mb-3 text-sm font-semibold">หมายเหตุ</div>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="ระบุอาการเสีย หรือข้อมูลเพิ่มเติม..."
                      rows={5}
                    />
                  </section>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={updateSerial.isPending || isUploading}>
                {updateSerial.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}













