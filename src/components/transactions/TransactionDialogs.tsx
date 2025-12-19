import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FileText, Package, User, CalendarDays, RotateCcw, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Transaction } from "@/hooks/useTransactions";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// --- View Dialog ---
export function ViewTransactionDialog({ open, onOpenChange, tx }: { open: boolean; onOpenChange: (open: boolean) => void; tx: Transaction | null }) {
  if (!tx) return null;
  const formatDate = (d: string) => format(new Date(d), 'd MMM yy HH:mm', { locale: th });
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden w-[95vw] rounded-lg">
         <DialogHeader className="p-4 bg-muted/10 border-b flex flex-row items-center gap-3 space-y-0">
             <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0"><FileText className="h-5 w-5" /></div>
             <div className="min-w-0"><DialogTitle>รายละเอียดการเบิก</DialogTitle><DialogDescription className="truncate">Ref: {tx.id.substring(0, 8)}</DialogDescription></div>
         </DialogHeader>
         <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
             {/* Asset Info */}
             <div className="flex gap-4">
                 <div className="w-24 h-24 bg-muted/10 border rounded-lg flex items-center justify-center shrink-0">{tx.product_serials?.products?.image_url ? <img src={tx.product_serials.products.image_url} className="w-full h-full object-contain" /> : <Package className="h-8 w-8 text-muted-foreground/30" />}</div>
                 <div>
                    <h4 className="font-bold text-lg">{tx.product_serials?.products?.name}</h4>
                    <div className="text-sm text-muted-foreground">Serial: <span className="font-mono text-foreground">{tx.product_serials?.serial_code}</span></div>
                    <StatusBadge status={tx.status} className="mt-2" />
                 </div>
             </div>
             {/* Borrower Info */}
             <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase mb-2 flex items-center gap-2"><User className="h-4 w-4" /> ผู้เบิก</h4>
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                    <Avatar><AvatarFallback>{(tx.employees?.name || tx.departments?.name)?.substring(0,2)}</AvatarFallback></Avatar>
                    <div><div className="font-medium">{tx.employees?.name || tx.departments?.name}</div><div className="text-xs text-muted-foreground">{tx.employees ? `Code: ${tx.employees.emp_code}` : 'Department'}</div></div>
                </div>
             </div>
             {/* Date Info */}
             <div className="grid grid-cols-2 gap-4">
                 <div><span className="text-xs text-muted-foreground block">วันที่ยืม</span><span className="text-sm font-medium">{formatDate(tx.borrow_date)}</span></div>
                 <div><span className="text-xs text-muted-foreground block">วันที่คืน</span><span className={cn("text-sm font-medium", tx.return_date ? "text-green-600" : "text-muted-foreground")}>{tx.return_date ? formatDate(tx.return_date) : '-'}</span></div>
             </div>
             {tx.note && <div className="bg-yellow-50 p-3 rounded border border-yellow-100 text-sm text-yellow-800"><span className="font-bold">Note:</span> {tx.note}</div>}
         </div>
         <DialogFooter className="p-4 border-t bg-muted/5"><Button onClick={() => onOpenChange(false)}>ปิด</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Return Dialog ---
export function ReturnDialog({ open, onOpenChange, tx, onConfirm, isPending }: { open: boolean; onOpenChange: (open: boolean) => void; tx: Transaction | null; onConfirm: () => void; isPending: boolean }) {
  if (!tx) return null;
  const [condition, setCondition] = useState('ปกติ');
  const [note, setNote] = useState('');
  
  // Reset state when dialog opens
  useEffect(() => { if(open) { setCondition('ปกติ'); setNote(''); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] w-[95vw] rounded-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5" /> รับคืนทรัพย์สิน</DialogTitle><DialogDescription>ตรวจสอบสภาพก่อนรับคืน</DialogDescription></DialogHeader>
        <div className="py-4 space-y-4">
           <div className="p-3 bg-muted rounded flex justify-between items-center text-sm">
              <span className="text-muted-foreground">สินค้า:</span><span className="font-medium truncate max-w-[200px]">{tx.product_serials?.products?.name}</span>
           </div>
           <div className="space-y-3">
              <Label>สภาพสินค้า</Label>
              <RadioGroup value={condition} onValueChange={setCondition} className="grid grid-cols-2 gap-3">
                 <div className={cn("flex items-center space-x-2 border p-3 rounded cursor-pointer", condition === 'ปกติ' && "border-green-500 bg-green-50")}><RadioGroupItem value="ปกติ" id="ok" /><Label htmlFor="ok" className="cursor-pointer">ปกติ</Label></div>
                 <div className={cn("flex items-center space-x-2 border p-3 rounded cursor-pointer", condition === 'เสียหาย' && "border-red-500 bg-red-50")}><RadioGroupItem value="เสียหาย" id="bad" /><Label htmlFor="bad" className="cursor-pointer flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> เสียหาย</Label></div>
              </RadioGroup>
           </div>
           <div className="space-y-2"><Label>หมายเหตุ</Label><Textarea placeholder="ระบุอาการเสีย (ถ้ามี)..." value={note} onChange={e => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
           <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
           <Button onClick={onConfirm} disabled={isPending} variant={condition === 'เสียหาย' ? 'destructive' : 'default'}>{isPending ? 'บันทึก...' : 'ยืนยันรับคืน'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}