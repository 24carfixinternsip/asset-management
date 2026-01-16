import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMyHistory, useRequestReturn } from "@/hooks/useTransactions";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Package, CalendarClock, RotateCcw } from "lucide-react";
import { PaginationControl } from "@/components/ui/pagination-control";

export default function PortalHistory() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  const { data: historyData, isLoading } = useMyHistory(page, pageSize);
  const transactions = historyData?.data || [];
  const totalPages = historyData?.totalPages || 0;

  const [returnDialog, setReturnDialog] = useState<{ open: boolean; txId: string } | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const requestReturn = useRequestReturn();

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': 
      case 'borrowed': 
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'completed': 
      case 'returned': 
        return 'bg-green-500 hover:bg-green-600';
      case 'pendingreturn':
        return 'bg-orange-500 hover:bg-orange-600';
      default: 
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'กำลังยืม';
      case 'completed': return 'คืนแล้ว';
      case 'pending': return 'รออนุมัติ';
      case 'rejected': return 'ปฏิเสธ';
      case 'pendingreturn': return 'รอคืน';
      default: return status;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-2 bg-primary/10 rounded-full text-primary">
          <CalendarClock className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">ประวัติการเบิกของฉัน</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">รายการทรัพย์สินที่คุณเคยทำรายการเบิก-คืน</p>
        </div>
      </div>

      <Card className="border-muted shadow-sm">
        <CardHeader className="pb-2 px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">รายการทั้งหมด</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1,2,3].map(i => <div key={i} className="h-20 sm:h-12 w-full bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : transactions.length > 0 ? (
            <>
              {/* Desktop View - Table */}
              <div className="hidden md:block rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[300px]">สินค้า</TableHead>
                      <TableHead>วันที่ยืม</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                      <TableHead className="w-[120px]">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx: any) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-slate-100 flex items-center justify-center border overflow-hidden shrink-0">
                              {tx.product_serials?.products?.image_url ? (
                                <img 
                                  src={tx.product_serials.products.image_url} 
                                  className="h-full w-full object-cover" 
                                  alt={tx.product_serials.products.name}
                                />
                              ) : (
                                <Package className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium line-clamp-1">
                                {tx.product_serials?.products?.name || 'Unknown'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {tx.product_serials?.products?.brand || '-'}
                                {tx.product_serials?.products?.model ? ` • ${tx.product_serials.products.model}` : ''}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {tx.product_serials?.serial_code}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {tx.borrow_date ? format(new Date(tx.borrow_date), "d MMM yy", { locale: th }) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(tx.status || '')} text-white border-0`}>
                            {getStatusLabel(tx.status || '')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {tx.note || "-"}
                        </TableCell>
                        <TableCell>
                          {tx.status === 'Active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReturnDialog({ open: true, txId: tx.id });
                                setReturnNote("");
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              ขอคืน
                            </Button>
                          )}
                          {tx.status === 'PendingReturn' && (
                            <Badge variant="secondary" className="text-xs">
                              รอ Admin
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View - Cards */}
              <div className="md:hidden space-y-3 px-4">
                {transactions.map((tx: any) => (
                  <Card key={tx.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {/* Product Image */}
                        <div className="h-16 w-16 rounded bg-slate-100 flex items-center justify-center border overflow-hidden shrink-0">
                          {tx.product_serials?.products?.image_url ? (
                            <img 
                              src={tx.product_serials.products.image_url} 
                              className="h-full w-full object-cover" 
                              alt={tx.product_serials.products.name}
                            />
                          ) : (
                            <Package className="h-6 w-6 text-slate-400" />
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm mb-1 line-clamp-2">
                            {tx.product_serials?.products?.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {tx.product_serials?.products?.brand || '-'}
                            {tx.product_serials?.products?.model ? ` • ${tx.product_serials.products.model}` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mb-2">
                            {tx.product_serials?.serial_code}
                          </div>

                          {/* Status & Date */}
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`${getStatusColor(tx.status || '')} text-white border-0 text-xs`}>
                              {getStatusLabel(tx.status || '')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {tx.borrow_date ? format(new Date(tx.borrow_date), "d MMM yy", { locale: th }) : '-'}
                            </span>
                          </div>

                          {/* Note (if exists) */}
                          {tx.note && (
                            <div className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              หมายเหตุ: {tx.note}
                            </div>
                          )}

                          {/* Action Button */}
                          {tx.status === 'Active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                setReturnDialog({ open: true, txId: tx.id });
                                setReturnNote("");
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              ขอคืนสินค้า
                            </Button>
                          )}
                          {tx.status === 'PendingReturn' && (
                            <Badge variant="secondary" className="text-xs w-full justify-center">
                              รอ Admin อนุมัติ
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Pagination */}
              <div className="mt-4 flex justify-center px-4">
                <PaginationControl 
                  currentPage={page} 
                  totalPages={totalPages} 
                  onPageChange={setPage} 
                />
              </div>
            </>
          ) : (
            <div className="text-center py-12 sm:py-16 text-muted-foreground bg-slate-50 rounded-lg border border-dashed mx-4 sm:mx-0">
              <Package className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm sm:text-base">คุณยังไม่มีประวัติการเบิกสินค้า</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog คำขอคืน */}
      <Dialog open={returnDialog?.open || false} onOpenChange={(open) => !open && setReturnDialog(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">คำขอคืนสินค้า</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">หมายเหตุ (ถ้ามี)</label>
              <Textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="ระบุสภาพสินค้า หรือหมายเหตุอื่นๆ..."
                rows={3}
                className="mt-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setReturnDialog(null)}
              className="w-full sm:w-auto"
            >
              ยกเลิก
            </Button>
            <Button 
              onClick={() => {
                if (returnDialog?.txId) {
                  requestReturn.mutate({ 
                    transactionId: returnDialog.txId, 
                    returnNote 
                  });
                  setReturnDialog(null);
                }
              }}
              disabled={requestReturn.isPending}
              className="w-full sm:w-auto"
            >
              {requestReturn.isPending ? "กำลังส่ง..." : "ยืนยันคำขอคืน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
