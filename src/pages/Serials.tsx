import { useState, useMemo, useEffect } from "react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Search, Pencil, Barcode, Image as ImageIcon, Camera, MapPin, 
  Eye, Calendar as CalendarIcon, X, Box, Trash2
} from "lucide-react";
import { useSerials, useUpdateSerial, useDeleteSerial, ProductSerial } from "@/hooks/useSerials";
import { useLocations, useCategories } from "@/hooks/useMasterData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns"; 
import { th } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import imageCompression from 'browser-image-compression';
import { useSearchParams } from "react-router-dom";

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
  useStickerStatuses,
  getSerialStatusDisplay,
  getStickerStatusDisplay
} from '@/hooks/useStatuses';

const getOptimizedUrl = (url: string | null, width = 100) => {
  if (!url) return null;
  if (url.includes('supabase.co')) {
    return `${url}?width=${width}&resize=contain&quality=60`;
  }
  return url;
};

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
  const itemsPerPage = 6; 

  // Debounce Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params: Record<string, string> = {};

    // ถ้าค่าไม่ใช่ค่า Default ให้ใส่เข้าไปใน params
    if (search) params.q = search;
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterLocation !== "all") params.location = filterLocation;
    if (filterSticker !== "all") params.sticker = filterSticker;
    if (filterCategory !== "all") params.category = filterCategory;
    
    // จัดการ Date Range
    if (dateRange?.from) params.from = dateRange.from.toISOString();
    if (dateRange?.to) params.to = dateRange.to.toISOString();

    // สั่งอัปเดต URL (replace: true เพื่อไม่ให้ History รกเกินไปเวลากด Back)
    setSearchParams(params, { replace: true });
    
    // รีเซ็ตหน้ากลับไปหน้า 1 เสมอเมื่อ Filter เปลี่ยน
    setCurrentPage(1);

  }, [search, filterStatus, filterLocation, filterSticker, filterCategory, dateRange, setSearchParams]);

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
  const [isViewOpen, setIsViewOpen] = useState(false);
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
    // ถ้ายังโหลดไม่เสร็จ หรือไม่มีข้อมูล ให้เป็น array ว่าง
    const data = serials || []; 
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [serials, currentPage]);

  // คำนวณหน้าทั้งหมดจาก serials ที่ส่งกลับมาจาก Server
  const totalPages = Math.ceil((serials?.length || 0) / itemsPerPage);

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
      sticker_status: serial.sticker_status || 'รอติดสติ๊กเกอร์',
      sticker_date: serial.sticker_date || '',
      sticker_image_url: serial.sticker_image_url || '',
      image_url: serial.image_url || '',
      notes: serial.notes || '',
      location_id: serial.location_id || '',
    });
    setIsEditOpen(true);
  };

  const openViewDialog = (serial: ProductSerial) => {
    setSelectedSerial(serial);
    setIsViewOpen(true);
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

  return (
    <MainLayout title="รายการทรัพย์สิน (Serials)">
      <div className="space-y-4 relative z-0">
        
        {/* --- Filters --- */}
        <Card className="border-none shadow-sm bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหา (Serial, ชื่อ, ยี่ห้อ)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background focus-visible:ring-0 focus-visible:ring-offset-0" 
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
              
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs focus:ring-0 focus:ring-offset-0">
                  <div className="flex items-center gap-2 truncate">
                    <Box className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="หมวดหมู่" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                  {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs focus:ring-0 focus:ring-offset-0">
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
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="สถานที่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานที่</SelectItem>
                  {locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterSticker} onValueChange={setFilterSticker}>
                <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="สติกเกอร์" />
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
                  <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal h-9 text-xs px-3 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dateRange?.from ? (
                      dateRange.to ? `${format(dateRange.from, "d MMM", { locale: th })} - ${format(dateRange.to, "d MMM", { locale: th })}` : format(dateRange.from, "d MMM", { locale: th })
                    ) : <span>วันที่ติด</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus mode="range" defaultMonth={dateRange?.from}
                    selected={dateRange} onSelect={setDateRange} numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>

              {(filterStatus !== "all" || filterLocation !== "all" || filterSticker !== "all" || filterCategory !== "all" || dateRange) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- Content Area --- */}
        <div className="bg-background rounded-lg border shadow-sm min-h-[500px] flex flex-col">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : (serials && serials.length > 0) ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto flex-1">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[80px]">รูป</TableHead>
                      <TableHead>รายละเอียด (Serial)</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>สถานที่</TableHead>
                      <TableHead>สติกเกอร์</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSerials.map((serial) => (
                      <TableRow key={serial.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="h-10 w-10 rounded bg-muted border flex items-center justify-center overflow-hidden">
                            {serial.image_url ? (
                              <img 
                                src={getOptimizedUrl(serial.image_url, 100) || ""}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                alt="product"
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-muted-foreground"/>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{serial.products?.name}</span>
                            <span className="text-xs font-mono text-muted-foreground">{serial.serial_code}</span>
                            <span className="text-[10px] text-muted-foreground">{serial.products?.brand} {serial.products?.model}</span>
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={serial.status} /></TableCell>
                        <TableCell>
                           <div className="text-xs flex items-center gap-1 text-muted-foreground" title={serial.locations?.name}>
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-[100px]">{serial.locations?.name || '-'}</span>
                           </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge status={serial.sticker_status} />
                            {serial.sticker_date && <span className="text-[10px] text-muted-foreground">{formatDate(serial.sticker_date)}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openViewDialog(serial)}><Eye className="h-4 w-4 text-blue-500"/></Button>
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
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile List View */}
              <div className="md:hidden divide-y flex-1">
                {paginatedSerials.map((serial) => (
                  <div key={serial.id} className="p-4 flex gap-3 active:bg-muted/50 transition-colors">
                    <div className="h-14 w-14 rounded bg-muted border flex items-center justify-center overflow-hidden shrink-0 mt-1">
                      {serial.image_url ? (
                        <img 
                          src={getOptimizedUrl(serial.image_url, 150) || ""}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground"/>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="font-semibold text-sm line-clamp-2 leading-tight text-foreground/90" title={serial.products?.name}>
                          {serial.products?.name}
                        </div>
                        <StatusBadge status={serial.status} className="shrink-0 scale-90 origin-top-right" />
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
                       <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-blue-50 text-blue-600" onClick={() => openViewDialog(serial)}><Eye className="h-4 w-4"/></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-orange-50 text-orange-600" onClick={() => openEditDialog(serial)}><Pencil className="h-4 w-4"/></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-red-50 text-red-600" onClick={() => {
                          if(confirm('ยืนยันลบรายการนี้?')) deleteSerial.mutate(serial.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4"/>
                        </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center p-4 border-t mt-auto">
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
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground flex-1">
              <Barcode className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">ไม่พบรายการ</p>
            </div>
          )}
        </div>
      </div>
      
      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5 text-primary"/> 
              รายละเอียดทรัพย์สิน
            </DialogTitle>
          </DialogHeader>
          {selectedSerial && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="aspect-video bg-muted rounded-lg border flex items-center justify-center overflow-hidden">
                   {selectedSerial.image_url ? <img src={selectedSerial.image_url} className="w-full h-full object-contain"/> : <span className="text-xs text-muted-foreground">ไม่มีรูปสินค้า</span>}
                </div>
                <div className="aspect-video bg-muted rounded-lg border flex items-center justify-center overflow-hidden">
                   {selectedSerial.sticker_image_url ? <img src={selectedSerial.sticker_image_url} className="w-full h-full object-contain"/> : <span className="text-xs text-muted-foreground">ไม่มีรูปสติกเกอร์</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div><Label className="text-xs text-muted-foreground">Serial Code</Label><div className="font-mono font-bold">{selectedSerial.serial_code}</div></div>
                <div><Label className="text-xs text-muted-foreground">สินค้า</Label><div>{selectedSerial.products?.name}</div></div>
                <div><Label className="text-xs text-muted-foreground">สถานะ</Label><div className="mt-1"><StatusBadge status={selectedSerial.status}/></div></div>
                <div><Label className="text-xs text-muted-foreground">สถานที่</Label><div>{selectedSerial.locations?.name || '-'}</div></div>
              </div>
            </div>
          )}
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
                   <Label>รูปภาพสภาพสินค้า</Label>
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
                   <Label>สถานะสติกเกอร์</Label>
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
                      {editForm.sticker_status === 'ติดแล้ว' && (
                         <Input type="date" className="w-[140px] focus-visible:ring-0" value={editForm.sticker_date} onChange={(e) => setEditForm(prev => ({...prev, sticker_date: e.target.value}))}/>
                      )}
                   </div>
                </div>

                {editForm.sticker_status === 'ติดแล้ว' && (
                  <div className="space-y-2">
                      <Label>รูปถ่ายการติดสติกเกอร์</Label>
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