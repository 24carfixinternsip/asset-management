import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMyHistory } from "@/hooks/useTransactions"; // ✅ ใช้ Hook ใหม่ที่ดึงเฉพาะของ User
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Package } from "lucide-react";

export default function PortalHistory() {
  // ดึงข้อมูลประวัติการเบิกของตัวเอง
  const { data: transactions, isLoading } = useMyHistory();

  return (
    <div className="space-y-6">
      {/* Header ส่วนหัวข้อ */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ประวัติการเบิกของฉัน</h2>
        <p className="text-muted-foreground">รายการทรัพย์สินที่คุณเคยทำรายการเบิก-คืน</p>
      </div>

      {/* ตารางแสดงรายการ */}
      <Card>
        <CardHeader>
          <CardTitle>รายการล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</div>
          ) : transactions && transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>วันที่ยืม</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-slate-100 flex items-center justify-center border overflow-hidden">
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
                          <div className="font-medium">{tx.product_serials?.products?.name}</div>
                          <div className="text-xs text-muted-foreground">{tx.product_serials?.serial_code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(tx.borrow_date), "d MMM yy", { locale: th })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={tx.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {tx.note || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
              ไม่พบประวัติการเบิก
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}