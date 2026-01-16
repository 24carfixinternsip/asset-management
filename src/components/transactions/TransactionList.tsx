import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, RotateCcw, User, Building2, Clock, CheckCircle, CheckCircle2, X } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Transaction } from "@/hooks/useTransactions";

const TransactionCard = ({ 
  tx, 
  variant, 
  onView, 
  onReturn, 
  onApprove 
}: { 
  tx: Transaction; 
  variant: 'active' | 'history' | 'pending'; 
  onView: (tx: Transaction) => void; 
  onReturn?: (tx: Transaction) => void; 
  onApprove?: (tx: Transaction) => void; 
}) => {
  const formatDate = (d: string) => format(new Date(d), 'd MMM yy HH:mm', { locale: th });
  return (
    <div className="bg-card p-4 rounded-lg border shadow-sm flex flex-col gap-3 relative overflow-hidden">
      <div className="flex justify-between items-start gap-2">
         <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
               <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 border-primary/20 text-primary">{tx.product_serials?.serial_code}</Badge>
               {variant !== 'active' && <StatusBadge status={tx.status} className="h-5 text-[10px]" />}
            </div>
            <div className="font-bold text-sm line-clamp-1">{tx.product_serials?.products?.name}</div>
         </div>
      </div>
      <Separator />
      <div className="flex items-center gap-2 text-sm">
         {tx.employees ? <><User className="h-4 w-4 text-muted-foreground" /><span className="truncate">{tx.employees.name}</span></> : <><Building2 className="h-4 w-4 text-blue-500" /><span className="truncate text-blue-700">{tx.departments?.name}</span></>}
      </div>
      <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded flex justify-between items-center">
         <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>ยืม: {formatDate(tx.borrow_date)}</span></div>
         {tx.return_date && <span className="text-green-600 font-medium">คืน: {formatDate(tx.return_date)}</span>}
      </div>
      {variant === 'active' && onReturn ? (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <Button variant="outline" size="sm" onClick={() => onView(tx)} className="w-full h-9"><Eye className="h-4 w-4 mr-1" /> รายละเอียด</Button>
          <Button variant="default" size="sm" onClick={() => onReturn(tx)} className="w-full h-9"><RotateCcw className="h-4 w-4 mr-1" /> รับคืน</Button>
        </div>
      ) : variant === 'pending' && onApprove ? (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <Button variant="default" size="sm" onClick={() => onApprove(tx)} className="w-full h-9 bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4 mr-1" /> อนุมัติ</Button>
          <Button variant="outline" size="sm" onClick={() => onView(tx)} className="w-full h-9"><Eye className="h-4 w-4 mr-1" /> ดูรายละเอียด</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => onView(tx)} className="w-full mt-1"><Eye className="h-4 w-4 mr-1" /> รายละเอียด</Button>
      )}
    </div>
  );
};

interface TransactionListProps {
  data: Transaction[] | undefined;
  isLoading: boolean;
  variant: 'active' | 'history' | 'pending'; 
  onView: (tx: Transaction) => void;
  onReturn?: (tx: Transaction) => void;
  onApprove?: (tx: Transaction) => void; 
}

export function TransactionList({ data, isLoading, variant, onView, onReturn, onApprove }: TransactionListProps) {
  const formatDate = (d: string) => format(new Date(d), 'd MMM yy HH:mm', { locale: th });

  if (isLoading) return <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (!data || data.length === 0) return <div className="flex flex-col items-center justify-center py-20 text-muted-foreground"><CheckCircle2 className="h-16 w-16 mb-4 text-green-500/20" /><p className="font-medium">ไม่พบข้อมูล</p></div>;

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <ScrollArea className={variant === 'active' ? "h-[500px]" : "h-[600px]"}>
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[150px]">Serial No.</TableHead>
                <TableHead className="min-w-[200px]">สินค้า</TableHead>
                <TableHead className="min-w-[150px]">ผู้ยืม</TableHead>
                <TableHead className="w-[150px]">วันที่</TableHead>
                {(variant === 'history' || variant === 'pending') && <TableHead className="w-[100px]">สถานะ</TableHead>}
                <TableHead className="text-right w-[140px]">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs text-primary font-medium">{tx.product_serials?.serial_code}</TableCell>
                  <TableCell>
                    <div className="flex flex-col max-w-xs">
                       <span className="font-medium text-sm truncate">{tx.product_serials?.products?.name}</span>
                       <span className="text-xs text-muted-foreground truncate">{tx.product_serials?.products?.model}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {tx.employees ? (
                        <div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{tx.employees.name.substring(0,2)}</AvatarFallback></Avatar><span className="text-sm truncate">{tx.employees.name}</span></div>
                    ) : tx.departments ? (
                        <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-500" /><span className="text-sm text-blue-700 truncate">{tx.departments.name}</span></div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>ยืม: {formatDate(tx.borrow_date)}</div>
                    {tx.return_date && <div className="text-emerald-600">คืน: {formatDate(tx.return_date)}</div>}
                  </TableCell>
                  {(variant === 'history' || variant === 'pending') && <TableCell><StatusBadge status={tx.status} /></TableCell>}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                       <Button size="sm" variant="ghost" onClick={() => onView(tx)}><Eye className="h-4 w-4" /></Button>
                       {variant === 'active' && onReturn && (
                         <Button size="sm" variant="outline" onClick={() => onReturn(tx)} className="text-primary hover:bg-primary/5 gap-1">
                           <RotateCcw className="h-3.5 w-3.5" /> คืน
                         </Button>
                       )}
                       {variant === 'pending' && onApprove && (
                         <Button size="sm" variant="default" onClick={() => onApprove(tx)} className="bg-green-600 hover:bg-green-700 gap-1">
                           <CheckCircle className="h-3.5 w-3.5" /> อนุมัติ
                         </Button>
                       )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
      {/* Mobile Cards */}
      <div className="md:hidden p-4 space-y-3">
        {data.map((tx) => (
           <TransactionCard key={tx.id} tx={tx} variant={variant} onView={onView} onReturn={onReturn} onApprove={onApprove} />
        ))}
      </div>
    </>
  );
}