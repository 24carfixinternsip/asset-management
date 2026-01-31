import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FileText, Package, User, CalendarDays, RotateCcw, AlertTriangle, Building2, X, CheckCircle } from "lucide-react";
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

export function ApproveDialog({ 
  open, 
  onOpenChange, 
  tx, 
  onApprove,
  onReject,
  isPending 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  tx: Transaction | null; 
  onApprove: (transactionId: string) => void;
  onReject: (transactionId: string, reason: string) => void;
  isPending: boolean 
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  
  useEffect(() => { 
    if (open) { 
      setRejectReason(''); 
      setShowReject(false); 
    } 
  }, [open]);

  if (!tx) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle>ตรวจสอบคำขอเบิก</DialogTitle>
              <DialogDescription>รหัสทรัพย์สิน: {tx.product_serials?.serial_code}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Asset Info */}
          <div className="flex gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="w-16 h-16 bg-white border rounded flex items-center justify-center shrink-0">
              {tx.product_serials?.products?.image_url ? (
                <img src={tx.product_serials.products.image_url} className="w-full h-full object-contain p-1" />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground/30" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold line-clamp-1">{tx.product_serials?.products?.name}</div>
              <div className="text-sm text-muted-foreground">{tx.product_serials?.products?.brand} {tx.product_serials?.products?.model}</div>
            </div>
          </div>

          {/* Borrower Info */}
          <div>
            <Label className="text-xs text-muted-foreground">ผู้ขอเบิก</Label>
            <div className="flex items-center gap-2 mt-1 p-2 bg-muted/20 rounded">
              {tx.employees ? (
                <>
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{tx.employees.name}</span>
                  <span className="text-xs text-muted-foreground">({tx.employees.emp_code})</span>
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-blue-700">{tx.departments?.name}</span>
                </>
              )}
            </div>
          </div>

          {/* Note */}
          {tx.note && (
            <div>
              <Label className="text-xs text-muted-foreground">หมายเหตุ</Label>
              <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                {tx.note}
              </div>
            </div>
          )}

          {/* Reject Reason (แสดงเมื่อกดปุ่มปฏิเสธ) */}
          {showReject && (
            <div>
              <Label>เหตุผลที่ปฏิเสธ</Label>
              <Textarea 
                placeholder="ระบุเหตุผล..." 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          
          {!showReject ? (
            <>
              <Button 
                variant="destructive"
                onClick={() => setShowReject(true)}
                disabled={isPending}
              >
                <X className="h-4 w-4 mr-1" /> ปฏิเสธ
              </Button>
              <Button 
                onClick={() => onApprove(tx.id)}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {isPending ? 'กำลังดำเนินการ...' : <><CheckCircle className="h-4 w-4 mr-1" /> อนุมัติ</>}
              </Button>
            </>
          ) : (
            <Button 
              variant="destructive"
              onClick={() => onReject(tx.id, rejectReason)}
              disabled={!rejectReason.trim() || isPending}
            >
              {isPending ? 'กำลังดำเนินการ...' : 'ยืนยันการปฏิเสธ'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Return Dialog ---
export function ReturnDialog({ 
  open, 
  onOpenChange, 
  tx, 
  onConfirm,
  isPending 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  tx: Transaction | null; 
  onConfirm: (condition: string, note: string) => void;
  isPending: boolean 
}) {
  // State ภายใน Dialog
  const [condition, setCondition] = useState('ปกติ');
  const [note, setNote] = useState('');
  
  // Reset state
  useEffect(() => { if(open) { setCondition('ปกติ'); setNote(''); } }, [open]);

  if (!tx) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle>บันทึกการคืนทรัพย์สิน</DialogTitle>
              <DialogDescription>Serial: {tx.product_serials?.serial_code}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Asset Info */}
          <div className="flex gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="w-16 h-16 bg-white border rounded flex items-center justify-center shrink-0">
              {tx.product_serials?.products?.image_url ? (
                <img src={tx.product_serials.products.image_url} className="w-full h-full object-contain p-1" />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground/30" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold line-clamp-1">{tx.product_serials?.products?.name}</div>
              <div className="text-sm text-muted-foreground">{tx.product_serials?.products?.brand} {tx.product_serials?.products?.model}</div>
            </div>
          </div>

          {/* Borrower Info */}
          <div>
            <Label className="text-xs text-muted-foreground">ผู้ยืม</Label>
            <div className="flex items-center gap-2 mt-1 p-2 bg-muted/20 rounded">
              {tx.employees ? (
                <>
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{tx.employees.name}</span>
                  <span className="text-xs text-muted-foreground">({tx.employees.emp_code})</span>
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-blue-700">{tx.departments?.name}</span>
                </>
              )}
            </div>
          </div>

          {/* Return Condition */}
          <div>
            <Label>สภาพของทรัพย์สิน</Label>
            <RadioGroup value={condition} onValueChange={setCondition} className="mt-2 space-y-2">
              <div className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50">
                <RadioGroupItem value="ปกติ" id="normal" />
                <Label htmlFor="normal" className="flex-1 cursor-pointer">ปกติ - ใช้งานได้ดี</Label>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50">
                <RadioGroupItem value="เสียหาย" id="damaged" />
                <Label htmlFor="damaged" className="flex-1 cursor-pointer">เสียหาย - ต้องซ่อม</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Note */}
          <div>
            <Label>หมายเหตุ (ถ้ามี)</Label>
            <Textarea 
              placeholder="รายละเอียดเพิ่มเติม..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

      <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          
          <Button 
            onClick={() => onConfirm(condition, note)}
            disabled={isPending} 
            variant={condition === 'เสียหาย' ? 'destructive' : 'default'}
          >
            {isPending ? 'บันทึก...' : 'ยืนยันรับคืน'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}