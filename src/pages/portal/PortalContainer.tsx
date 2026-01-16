import { useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { UserLayout } from "@/components/layout/UserLayout";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Building2, User } from "lucide-react";
import { Product } from "@/hooks/useProducts";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useAvailableSerials } from "@/hooks/useSerials";
import { useDepartments } from "@/hooks/useMasterData"; // ใช้แผนกแทน Employee ทั้งหมด
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee"; // Hook ที่สร้างใหม่
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

type PortalContextType = {
  addToCart: (product: Product) => void;
};

export default function PortalContainer() {
  const [cart, setCart] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State ใหม่สำหรับเลือกประเภทการเบิก
  const [borrowType, setBorrowType] = useState<'self' | 'department'>('self');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const { data: currentUser } = useCurrentEmployee();
  const { data: departments } = useDepartments();
  
  const createTransaction = useCreateTransaction();

  const addToCart = (product: Product) => {
    const inCartCount = cart.filter((p) => p.id === product.id).length;
    if (inCartCount >= product.stock_available) {
      toast.error("จำนวนสินค้าไม่เพียงพอ");
      return;
    }
    setCart([...cart, product]);
    toast.success(`เพิ่ม ${product.name} แล้ว`);
    setIsCartOpen(true);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const handleSubmitRequest = async () => {
    // Validation
    if (borrowType === 'self' && !currentUser) {
        toast.error("ไม่พบข้อมูลพนักงานของคุณ กรุณาติดต่อ Admin");
        return;
    }
    if (borrowType === 'department' && !selectedDepartmentId) {
        toast.error("กรุณาเลือกแผนกที่ต้องการเบิกให้");
        return;
    }

    setIsSubmitting(true);
    let successCount = 0;

    try {
      for (const product of cart) {
        const productWithSerial = product as Product & { selected_serial_id?: string };
        const serialId = productWithSerial.selected_serial_id;
        
        if (!serialId) {
          toast.error(`สินค้า ${product.name} ไม่มีข้อมูล Serial ที่เลือก`);
          continue;
        }

        await createTransaction.mutateAsync({
          employee_id: borrowType === 'self' ? currentUser!.id : undefined,
          department_id: borrowType === 'department' ? selectedDepartmentId : undefined,
          serial_id: serialId,
          note: `Portal Request (${borrowType}): ${note}`,
        });
        successCount++;
      }

      if (successCount > 0) {
        toast.success(`ทำรายการสำเร็จ ${successCount} รายการ`);
        setCart([]);
        setNote("");
        setIsCartOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการทำรายการ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <UserLayout cartCount={cart.length} onOpenCart={() => setIsCartOpen(true)}>
        <Outlet context={{ addToCart } satisfies PortalContextType} />
      </UserLayout>

      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>รายการขอเบิก ({cart.length})</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 my-4 pr-4">
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                ไม่มีรายการในตะกร้า
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-gray-600">
                        {item.brand || '-'}{item.model ? ` • ${item.model}` : ''}
                      </div>
                      {/* Serial Code */}
                      <div className="text-xs text-gray-500">
                        {(item as Product & { selected_serial_code?: string }).selected_serial_code || item.p_id}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeFromCart(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="space-y-5 pt-4 border-t">
            
            {/* ส่วนเลือกประเภทการเบิก */}
            <div className="space-y-3">
                <Label>เบิกในนาม</Label>
                <RadioGroup 
                    defaultValue="self" 
                    value={borrowType} 
                    onValueChange={(v) => setBorrowType(v as 'self' | 'department')}
                    className="grid grid-cols-2 gap-4"
                >
                    <div>
                        <RadioGroupItem value="self" id="type-self" className="peer sr-only" />
                        <Label
                            htmlFor="type-self"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer"
                        >
                            <User className="mb-2 h-5 w-5" />
                            <span className="text-xs">ตนเอง</span>
                        </Label>
                    </div>
                    <div>
                        <RadioGroupItem value="department" id="type-dept" className="peer sr-only" />
                        <Label
                            htmlFor="type-dept"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer"
                        >
                            <Building2 className="mb-2 h-5 w-5" />
                            <span className="text-xs">แผนก</span>
                        </Label>
                    </div>
                </RadioGroup>
            </div>

            {/* Form ตามประเภทที่เลือก */}
            {borrowType === 'self' ? (
                <div className="p-3 bg-blue-50 text-blue-700 rounded-md text-sm border border-blue-100">
                    <span className="font-semibold block mb-1">ผู้เบิก: {currentUser?.name || 'กำลังโหลด...'}</span>
                    <span className="text-xs opacity-80">{currentUser?.emp_code} • {currentUser?.departments?.name}</span>
                    {!currentUser && <p className="text-red-500 text-xs mt-1">*ไม่พบข้อมูลพนักงานที่เชื่อมกับอีเมลนี้</p>}
                </div>
            ) : (
                <div className="space-y-2">
                    <Label>เลือกแผนก</Label>
                    <SearchableSelect
                        items={departments?.map(d => ({ value: d.id, label: d.name })) || []}
                        value={selectedDepartmentId}
                        onValueChange={setSelectedDepartmentId}
                        placeholder="ค้นหาแผนก..."
                    />
                    <Alert className="py-2 mt-2 bg-yellow-50 border-yellow-200">
                        <AlertDescription className="text-xs text-yellow-800">
                            การเบิกให้แผนก สินค้าจะถือเป็นทรัพย์สินส่วนกลางของแผนกนั้น
                        </AlertDescription>
                    </Alert>
                </div>
            )}

            <div className="space-y-2">
              <Label>หมายเหตุ / Project</Label>
              <Textarea
                placeholder="ระบุเหตุผลการเบิก หรือ Site งาน..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-20"
              />
            </div>

            <SheetFooter>
              <Button
                className="w-full bg-[#F15A24] hover:bg-[#d94e1d]"
                disabled={cart.length === 0 || isSubmitting || (borrowType === 'self' && !currentUser)}
                onClick={handleSubmitRequest}
              >
                {isSubmitting ? "กำลังประมวลผล..." : "ยืนยันการเบิก"}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function usePortalContext() {
  return useOutletContext<PortalContextType>();
}