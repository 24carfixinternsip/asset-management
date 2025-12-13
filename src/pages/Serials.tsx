import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Search, Pencil, Barcode, Image as ImageIcon, Camera, MapPin, 
  Eye, Filter, Calendar as CalendarIcon, X 
} from "lucide-react";
import { useSerials, useUpdateSerial, ProductSerial } from "@/hooks/useSerials";
import { useLocations } from "@/hooks/useMasterData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

// รายการสถานะสำหรับ Filter
const STATUS_OPTIONS = ["พร้อมใช้", "ถูกยืม", "ไม่พร้อมใช้", "ส่งซ่อม", "ไม่ใช้แล้ว", "หาย", "ทิ้งแล้ว", "ไม่เปิดใช้งาน"];
const STICKER_OPTIONS = ["รอติดสติ๊กเกอร์", "ติดแล้ว"];

export default function Serials() {
  const [search, setSearch] = useState("");
  // Filter States
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterSticker, setFilterSticker] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Data Fetching
  const { data: serials, isLoading } = useSerials(search || undefined);
  const { data: locations } = useLocations();
  const updateSerial = useUpdateSerial();
  
  // Dialog States
  const [selectedSerial, setSelectedSerial] = useState<ProductSerial | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form State
  const [editForm, setEditForm] = useState({
    status: '',
    sticker_status: '',
    sticker_date: '',
    sticker_image_url: '',
    image_url: '', 
    notes: '',     
    location_id: '',
  });

  // --- Filtering Logic (Client-Side) ---
  const filteredSerials = useMemo(() => {
    if (!serials) return [];

    return serials.filter(item => {
      // 1. Status Filter
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      
      // 2. Location Filter
      if (filterLocation !== "all" && item.location_id !== filterLocation) return false;
      
      // 3. Sticker Status Filter
      if (filterSticker !== "all" && item.sticker_status !== filterSticker) return false;

      // 4. Date Range Filter (Sticker Date)
      if (dateRange?.from) {
        if (!item.sticker_date) return false;
        const sDate = new Date(item.sticker_date);
        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        
        if (!isWithinInterval(sDate, { start, end })) return false;
      }

      return true;
    });
  }, [serials, filterStatus, filterLocation, filterSticker, dateRange]);

  // --- Handlers ---

  const openEditDialog = (serial: ProductSerial) => {
    setSelectedSerial(serial);
    setEditForm({
      status: serial.status || 'พร้อมใช้',
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${field}_${Date.now()}.${fileExt}`;
      const filePath = `serials/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('asset-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('asset-images')
        .getPublicUrl(filePath);

      setEditForm(prev => ({ ...prev, [field]: publicUrl }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      console.error(error);
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedSerial) return;

    await updateSerial.mutateAsync({
      id: selectedSerial.id,
      status: editForm.status,
      sticker_status: editForm.sticker_status,
      sticker_date: editForm.sticker_date || null,
      sticker_image_url: editForm.sticker_image_url || null,
      image_url: editForm.image_url || null,
      notes: editForm.notes || null,
      location_id: editForm.location_id || null,
    });

    setIsEditOpen(false);
    setSelectedSerial(null);
  };

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterLocation("all");
    setFilterSticker("all");
    setDateRange(undefined);
    setSearch("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "d MMM yy", { locale: th });
  };

  return (
    <MainLayout title="ติดตามรายการทรัพย์สิน (Serials)">
      <div className="space-y-4">
        
        {/* --- Filter Section --- */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Search Top */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาด้วยรหัสซีเรียล, ชื่อสินค้า..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col lg:flex-row gap-3">
              
              {/* Status Filter */}
              <div className="w-full lg:w-[200px]">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="สถานะทรัพย์สิน" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div className="w-full lg:w-[200px]">
                <Select value={filterLocation} onValueChange={setFilterLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="สถานที่" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานที่</SelectItem>
                    {locations?.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sticker Status Filter */}
              <div className="w-full lg:w-[180px]">
                <Select value={filterSticker} onValueChange={setFilterSticker}>
                  <SelectTrigger>
                    <SelectValue placeholder="สถานะสติกเกอร์" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {STICKER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter (Sticker Date) */}
              <div className="w-full lg:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full lg:w-[260px] justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "d MMM", { locale: th })} -{" "}
                            {format(dateRange.to, "d MMM", { locale: th })}
                          </>
                        ) : (
                          format(dateRange.from, "d MMM yyyy", { locale: th })
                        )
                      ) : (
                        <span>วันที่ติดสติกเกอร์</span>
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
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Clear Filters */}
              {(filterStatus !== "all" || filterLocation !== "all" || filterSticker !== "all" || dateRange || search) && (
                <Button variant="ghost" onClick={clearFilters} className="px-2 lg:px-4">
                  <X className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">ล้างตัวกรอง</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- Table Section --- */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredSerials && filteredSerials.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รูป</TableHead>
                      <TableHead>รหัสซีเรียล</TableHead>
                      <TableHead>สินค้า / ยี่ห้อ / รุ่น</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>สถานที่</TableHead>
                      <TableHead>สติกเกอร์</TableHead>
                      <TableHead>วันที่ติด</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSerials.map((serial) => (
                      <TableRow key={serial.id}>
                        {/* Image */}
                        <TableCell>
                          {serial.image_url ? (
                            <img src={serial.image_url} alt="Item" className="h-10 w-10 rounded object-cover border" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </TableCell>
                        
                        {/* Serial Code */}
                        <TableCell className="font-mono text-sm font-medium">
                          {serial.serial_code}
                        </TableCell>
                        
                        {/* Product Details (Name, Brand, Model) */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{serial.products?.name}</span>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              {serial.products?.brand && (
                                <span className="bg-muted px-1 rounded">{serial.products.brand}</span>
                              )}
                              {serial.products?.model && (
                                <span>{serial.products.model}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        {/* Status */}
                        <TableCell>
                          <StatusBadge status={serial.status} />
                        </TableCell>
                        
                        {/* Location */}
                        <TableCell className="text-muted-foreground text-sm">
                          {serial.locations ? (
                            <div className="flex items-center gap-1" title={`${serial.locations.name} ${serial.locations.building || ''}`}>
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[120px]">{serial.locations.name}</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        
                        {/* Sticker Status */}
                        <TableCell>
                          <StatusBadge status={serial.sticker_status} />
                        </TableCell>

                        {/* Sticker Date */}
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(serial.sticker_date)}
                        </TableCell>
                        
                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="ดูรายละเอียด"
                              onClick={() => openViewDialog(serial)}
                            >
                              <Eye className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="แก้ไข"
                              onClick={() => openEditDialog(serial)}
                            >
                              <Pencil className="h-4 w-4 text-orange-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Barcode className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  {search || filterStatus !== 'all' ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการในระบบ'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- View Dialog (Read Only) --- */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[700px] overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>รายละเอียดทรัพย์สิน</DialogTitle>
            <DialogDescription>รหัส: {selectedSerial?.serial_code}</DialogDescription>
          </DialogHeader>
          
          {selectedSerial && (
            <div className="flex-1 overflow-y-auto p-1 space-y-6">
              {/* Top Section: Images */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 text-center">
                  <Label className="text-xs text-muted-foreground">สภาพทรัพย์สิน</Label>
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden border">
                    {selectedSerial.image_url ? (
                      <img src={selectedSerial.image_url} alt="Item" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground/50">
                        <ImageIcon className="h-8 w-8 mb-2" />
                        <span className="text-xs">ไม่มีรูป</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-center">
                  <Label className="text-xs text-muted-foreground">หลักฐานการติดสติกเกอร์</Label>
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden border">
                    {selectedSerial.sticker_image_url ? (
                      <img src={selectedSerial.sticker_image_url} alt="Sticker" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground/50">
                        <Barcode className="h-8 w-8 mb-2" />
                        <span className="text-xs">ไม่มีรูป</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                <div>
                  <Label className="text-muted-foreground text-xs">ชื่อสินค้า</Label>
                  <div className="font-medium">{selectedSerial.products?.name}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">หมวดหมู่</Label>
                  <div>{selectedSerial.products?.category}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">ยี่ห้อ</Label>
                  <div>{selectedSerial.products?.brand || '-'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">รุ่น</Label>
                  <div>{selectedSerial.products?.model || '-'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">สถานะ</Label>
                  <div className="mt-1"><StatusBadge status={selectedSerial.status} /></div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">สถานที่เก็บ</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {selectedSerial.locations?.name || '-'} {selectedSerial.locations?.building ? `(${selectedSerial.locations.building})` : ''}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">สถานะสติกเกอร์</Label>
                  <div className="mt-1"><StatusBadge status={selectedSerial.sticker_status} /></div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">วันที่ติดสติกเกอร์</Label>
                  <div>{formatDate(selectedSerial.sticker_date)}</div>
                </div>
              </div>

              {/* Notes */}
              {selectedSerial.notes && (
                <div className="bg-muted/50 p-3 rounded-md border text-sm">
                  <Label className="text-xs text-muted-foreground mb-1 block">หมายเหตุ</Label>
                  <p>{selectedSerial.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Edit Dialog (Existing functionality + UI Tweaks) --- */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขรายละเอียดทรัพย์สิน</DialogTitle>
          </DialogHeader>
          {selectedSerial && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-4 border">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Barcode className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-mono text-lg font-bold text-primary">{selectedSerial.serial_code}</p>
                  <p className="font-medium">{selectedSerial.products?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[selectedSerial.products?.brand, selectedSerial.products?.model].filter(Boolean).join(' - ')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Status & Location */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>สถานะทรัพย์สิน</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>สถานที่เก็บ (Location)</Label>
                    <Select
                      value={editForm.location_id}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, location_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="ระบุตำแหน่งจัดเก็บ" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations?.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name} {loc.building && `(${loc.building})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>รูปถ่ายสภาพสินค้าจริง</Label>
                    <div className="flex items-start gap-4 p-4 border rounded-lg border-dashed">
                      {editForm.image_url ? (
                        <div className="relative group">
                          <img
                            src={editForm.image_url}
                            alt="Item"
                            className="h-24 w-24 rounded-lg object-cover border"
                          />
                          <button 
                            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setEditForm(prev => ({ ...prev, image_url: '' }))}
                          >
                            <span className="sr-only">Delete</span>
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                          <Camera className="h-8 w-8 mb-1" />
                          <span className="text-xs">No Image</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUpload(e, 'image_url')}
                          disabled={isUploading}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          อัปโหลดรูปสภาพปัจจุบัน
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Sticker & Notes */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>การติดสติกเกอร์</Label>
                    <div className="flex gap-4">
                      <Select
                        value={editForm.sticker_status}
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, sticker_status: value }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STICKER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      
                      {editForm.sticker_status === 'ติดแล้ว' && (
                        <Input
                          type="date"
                          className="w-40"
                          value={editForm.sticker_date}
                          onChange={(e) => setEditForm(prev => ({ ...prev, sticker_date: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>

                  {editForm.sticker_status === 'ติดแล้ว' && (
                    <div className="space-y-2">
                      <Label>รูปยืนยันการติดสติกเกอร์</Label>
                      <div className="flex items-center gap-4">
                        {editForm.sticker_image_url ? (
                          <img
                            src={editForm.sticker_image_url}
                            alt="Sticker"
                            className="h-16 w-16 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUpload(e, 'sticker_image_url')}
                          disabled={isUploading}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>หมายเหตุ / โน๊ตเพิ่มเติม</Label>
                    <Textarea 
                      placeholder="เช่น ฝากไว้ที่..., จอมีรอยขีดข่วน..."
                      value={editForm.notes}
                      onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleUpdate} disabled={updateSerial.isPending || isUploading}>
                  {updateSerial.isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}