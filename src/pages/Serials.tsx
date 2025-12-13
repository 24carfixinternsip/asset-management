import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Pencil, Barcode, Image as ImageIcon, Camera, MapPin, 
  Eye, Calendar as CalendarIcon, X, Filter
} from "lucide-react";
import { useSerials, useUpdateSerial, ProductSerial } from "@/hooks/useSerials";
import { useLocations } from "@/hooks/useMasterData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

// Options
const STATUS_OPTIONS = ["พร้อมใช้", "ถูกยืม", "ไม่พร้อมใช้", "ส่งซ่อม", "ไม่ใช้แล้ว", "หาย", "ทิ้งแล้ว", "ไม่เปิดใช้งาน"];
const STICKER_OPTIONS = ["รอติดสติ๊กเกอร์", "ติดแล้ว"];

export default function Serials() {
  const [search, setSearch] = useState("");
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterSticker, setFilterSticker] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Data Hooks
  const { data: serials, isLoading } = useSerials(search || undefined);
  const { data: locations } = useLocations();
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

  // --- Filtering Logic ---
  const filteredSerials = useMemo(() => {
    if (!serials) return [];
    return serials.filter(item => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (filterLocation !== "all" && item.location_id !== filterLocation) return false;
      if (filterSticker !== "all" && item.sticker_status !== filterSticker) return false;
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

  // --- Actions ---
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
      const { error: uploadError } = await supabase.storage.from('asset-images').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('asset-images').getPublicUrl(filePath);
      setEditForm(prev => ({ ...prev, [field]: publicUrl }));
      toast.success('อัปโหลดสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดล้มเหลว');
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
    setFilterStatus("all"); setFilterLocation("all"); setFilterSticker("all");
    setDateRange(undefined); setSearch("");
  };

  const formatDate = (dateStr: string | null) => dateStr ? format(new Date(dateStr), "d MMM yy", { locale: th }) : "-";

  return (
    <MainLayout title="รายการทรัพย์สิน (Serials)">
      {/* Fix: ใช้ relative z-0 เพื่อให้แน่ใจว่า Content อยู่ใน Flow ปกติ 
        และไม่ไปทับ Header/Sidebar Trigger ที่เป็น fixed/sticky 
      */}
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
                className="pl-9 bg-background"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
                  <SelectValue placeholder="สถานที่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานที่</SelectItem>
                  {locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterSticker} onValueChange={setFilterSticker}>
                <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                  <SelectValue placeholder="สติกเกอร์" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {STICKER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal h-9 text-xs px-3">
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

              {(filterStatus !== "all" || filterLocation !== "all" || filterSticker !== "all" || dateRange) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- Content Area --- */}
        <div className="bg-background rounded-lg border shadow-sm min-h-[500px]">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : filteredSerials && filteredSerials.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
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
                    {filteredSerials.map((serial) => (
                      <TableRow key={serial.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="h-10 w-10 rounded bg-muted border flex items-center justify-center overflow-hidden">
                            {serial.image_url ? <img src={serial.image_url} className="w-full h-full object-cover"/> : <ImageIcon className="h-4 w-4 text-muted-foreground"/>}
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile List View (แก้ปัญหาตารางล้นจอ) */}
              <div className="md:hidden divide-y">
                {filteredSerials.map((serial) => (
                  <div key={serial.id} className="p-4 flex gap-3 active:bg-muted/50 transition-colors">
                    <div className="h-12 w-12 rounded bg-muted border flex items-center justify-center overflow-hidden shrink-0">
                      {serial.image_url ? <img src={serial.image_url} className="w-full h-full object-cover"/> : <ImageIcon className="h-5 w-5 text-muted-foreground"/>}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-sm truncate pr-2">{serial.products?.name}</div>
                        <StatusBadge status={serial.status} />
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">{serial.serial_code}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/> {serial.locations?.name || '-'}</span>
                        <span>•</span>
                        <span>{serial.sticker_status}</span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-1 border-l pl-2 ml-1">
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openViewDialog(serial)}><Eye className="h-4 w-4 text-blue-500"/></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(serial)}><Pencil className="h-4 w-4 text-orange-500"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Barcode className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">ไม่พบรายการ</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Dialogs (Moved outside main flow but inside Layout) --- */}
      
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
          
          <ScrollArea className="flex-1 p-6 max-h-[60vh]">
             {/* Form Fields ... (Same Logic but cleaner structure) */}
             <div className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label>สถานะ</Label>
                      <Select value={editForm.status} onValueChange={(v) => setEditForm(prev => ({...prev, status: v}))}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-2">
                      <Label>สถานที่</Label>
                      <Select value={editForm.location_id} onValueChange={(v) => setEditForm(prev => ({...prev, location_id: v}))}>
                        <SelectTrigger><SelectValue placeholder="เลือกสถานที่"/></SelectTrigger>
                        <SelectContent>{locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                </div>

                {/* Image Upload Section */}
                <div className="space-y-2">
                   <Label>รูปภาพสภาพสินค้า</Label>
                   <div className="flex gap-4 items-center p-3 border rounded-lg border-dashed">
                      <div className="h-16 w-16 bg-muted rounded flex items-center justify-center overflow-hidden shrink-0">
                         {editForm.image_url ? <img src={editForm.image_url} className="w-full h-full object-cover"/> : <Camera className="h-6 w-6 text-muted-foreground"/>}
                      </div>
                      <Input type="file" accept="image/*" className="text-xs" onChange={(e) => handleUpload(e, 'image_url')} disabled={isUploading}/>
                   </div>
                </div>

                <div className="space-y-2">
                   <Label>สถานะสติกเกอร์</Label>
                   <div className="flex gap-2">
                      <Select value={editForm.sticker_status} onValueChange={(v) => setEditForm(prev => ({...prev, sticker_status: v}))}>
                        <SelectTrigger className="flex-1"><SelectValue/></SelectTrigger>
                        <SelectContent>{STICKER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      {editForm.sticker_status === 'ติดแล้ว' && (
                         <Input type="date" className="w-[140px]" value={editForm.sticker_date} onChange={(e) => setEditForm(prev => ({...prev, sticker_date: e.target.value}))}/>
                      )}
                   </div>
                </div>
                
                {editForm.sticker_status === 'ติดแล้ว' && (
                  <div className="space-y-2">
                     <Label>รูปถ่ายการติดสติกเกอร์</Label>
                     <div className="flex gap-4 items-center p-3 border rounded-lg border-dashed">
                        <div className="h-16 w-16 bg-muted rounded flex items-center justify-center overflow-hidden shrink-0">
                           {editForm.sticker_image_url ? <img src={editForm.sticker_image_url} className="w-full h-full object-cover"/> : <Barcode className="h-6 w-6 text-muted-foreground"/>}
                        </div>
                        <Input type="file" accept="image/*" className="text-xs" onChange={(e) => handleUpload(e, 'sticker_image_url')} disabled={isUploading}/>
                     </div>
                  </div>
                )}
                
                <div className="space-y-2">
                   <Label>หมายเหตุ</Label>
                   <Textarea value={editForm.notes} onChange={(e) => setEditForm(prev => ({...prev, notes: e.target.value}))} placeholder="ระบุอาการเสีย หรือข้อมูลเพิ่มเติม..."/>
                </div>
             </div>
          </ScrollArea>

          <DialogFooter className="p-4 border-t bg-muted/10">
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