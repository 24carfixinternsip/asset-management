import { useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { UserLayout } from "@/components/layout/UserLayout";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";
import { Product } from "@/hooks/useProducts";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useAvailableSerials } from "@/hooks/useSerials";
import { useEmployees } from "@/hooks/useMasterData";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// กำหนด Type สำหรับ Context ที่จะส่งให้ลูกๆ (หน้า Catalog)
type PortalContextType = {
  addToCart: (product: Product) => void;
};

export default function PortalContainer() {
  // --- Global State สำหรับ Portal (ตะกร้าสินค้า) ---
  const [cart, setCart] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data Hooks
  const { data: availableSerials } = useAvailableSerials();
  const { data: employees } = useEmployees();
  const createTransaction = useCreateTransaction();

  // Helper: หา Serial ที่ว่าง (FIFO)
  const findAvailableSerial = (productId: string) => {
    return availableSerials?.find(
      (s) => s.product_id === productId && (s.status === "พร้อมใช้" || s.status === "Ready")
    );
  };

  // Function: เพิ่มสินค้าลงตะกร้า (ส่งให้ลูกใช้)
  const addToCart = (product: Product) => {
    // เช็คสต็อกในตะกร้าเทียบกับของจริง
    const inCartCount = cart.filter((p) => p.id === product.id).length;
    if (inCartCount >= product.stock_available) {
      toast.error("จำนวนสินค้าไม่เพียงพอ");
      return;
    }
    setCart([...cart, product]);
    toast.success(`เพิ่ม ${product.name} ลงรายการเบิกแล้ว`);
    setIsCartOpen(true); // เปิดตะกร้าอัตโนมัติเพื่อให้ User เห็น
  };

  // Function: ลบสินค้าออกจากตะกร้า
  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Function: ยืนยันการเบิก
  const handleSubmitRequest = async () => {
    if (!selectedEmployee) {
      toast.error("กรุณาระบุชื่อผู้เบิก");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;

    try {
      // Loop สร้าง Transaction ทีละรายการ
      for (const product of cart) {
        const serial = findAvailableSerial(product.id);

        if (!serial) {
          toast.error(`สินค้า ${product.name} หมดสต็อกกระทันหัน`);
          continue;
        }

        await createTransaction.mutateAsync({
          employee_id: selectedEmployee,
          serial_id: serial.id,
          note: `User Portal Request: ${note}`,
        });
        successCount++;
      }

      if (successCount > 0) {
        toast.success(`ทำรายการสำเร็จ ${successCount} รายการ`);
        setCart([]);
        setNote("");
        setIsCartOpen(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการทำรายการ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* UserLayout จะครอบทุกหน้าที่เป็นลูกของ Portal */}
      <UserLayout cartCount={cart.length} onOpenCart={() => setIsCartOpen(true)}>
        
        {/* Outlet คือจุดที่จะแสดงหน้าลูก (Catalog หรือ History) */}
        {/* เราส่งฟังก์ชัน addToCart ผ่าน context ไปให้ลูกใช้ */}
        <Outlet context={{ addToCart } satisfies PortalContextType} />

      </UserLayout>

      {/* Cart Sheet (ตะกร้าสินค้า) - อยู่ที่นี่ถาวร ไม่หายเมื่อเปลี่ยนหน้า */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>รายการขอเบิก ({cart.length})</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 my-4 pr-4">
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                ยังไม่มีรายการ
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.p_id}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removeFromCart(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label>ระบุชื่อผู้เบิก (พนักงาน)</Label>
              <SearchableSelect
                items={
                  employees?.map((e) => ({
                    value: e.id,
                    label: `${e.emp_code} : ${e.name}`,
                  })) || []
                }
                value={selectedEmployee}
                onValueChange={setSelectedEmployee}
                placeholder="ค้นหาชื่อพนักงาน..."
              />
            </div>
            <div className="space-y-2">
              <Label>หมายเหตุ / โครงการ</Label>
              <Textarea
                placeholder="เช่น นำไปใช้ที่ Site งาน..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <SheetFooter>
              <Button
                className="w-full"
                disabled={cart.length === 0 || !selectedEmployee || isSubmitting}
                onClick={handleSubmitRequest}
              >
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการเบิก"}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Hook helper สำหรับให้หน้าลูก (เช่น PortalCatalog) เรียกใช้
export function usePortalContext() {
  return useOutletContext<PortalContextType>();
}