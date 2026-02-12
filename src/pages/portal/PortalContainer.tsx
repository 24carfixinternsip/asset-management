import { useMemo, useRef, useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { Building2, CheckCircle2, Package, Sparkles, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { UserLayout } from "@/components/layout/UserLayout";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useDepartments } from "@/hooks/useMasterData";
import { useIsMobile } from "@/hooks/use-mobile";
import { Product } from "@/hooks/useProducts";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

type PortalContextType = {
  addToCart: (product: Product) => void;
  openCart: () => void;
  cartCount: number;
};

type CartProduct = Product & {
  selected_serial_id?: string;
  selected_serial_code?: string;
};

export default function PortalContainer() {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const [cart, setCart] = useState<CartProduct[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [lastRequestCount, setLastRequestCount] = useState(0);

  const [borrowType, setBorrowType] = useState<"self" | "department">("self");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const submitLockRef = useRef(false);

  const { data: currentUser } = useCurrentEmployee();
  const { data: departments } = useDepartments();
  const createTransaction = useCreateTransaction();

  const cartSummary = useMemo(() => {
    const uniqueItems = new Set(cart.map((item) => item.selected_serial_id ?? `${item.id}:${item.p_id}`)).size;
    return {
      totalItems: cart.length,
      uniqueItems,
    };
  }, [cart]);

  const addToCart = (product: Product) => {
    setShowSuccessState(false);

    setCart((current) => {
      const currentCount = current.filter((item) => item.id === product.id).length;
      const maxAvailable = Math.max(product.stock_available ?? 0, 0);

      if (maxAvailable > 0 && currentCount >= maxAvailable) {
        toast.error("Not enough available stock");
        return current;
      }

      return [...current, product as CartProduct];
    });

    toast.success(`Added ${product.name}`);
    setIsCartOpen(true);
  };

  const removeFromCart = (index: number) => {
    setShowSuccessState(false);
    setCart((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmitRequest = async () => {
    if (isSubmitting || submitLockRef.current || cart.length === 0) return;

    if (borrowType === "self" && !currentUser) {
      toast.error("Current user profile was not found");
      return;
    }

    if (borrowType === "department" && !selectedDepartmentId) {
      toast.error("Please select a department before submitting");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    let successCount = 0;

    try {
      for (const product of cart) {
        const serialId = product.selected_serial_id;

        if (!serialId) {
          toast.error(`Missing selected serial for ${product.name}`);
          continue;
        }

        await createTransaction.mutateAsync({
          employee_id: borrowType === "self" ? currentUser!.id : undefined,
          department_id: borrowType === "department" ? selectedDepartmentId : undefined,
          serial_id: serialId,
          note: `Portal Request (${borrowType}): ${note}`,
        });

        successCount += 1;
      }

      if (successCount <= 0) {
        toast.error("No request was submitted. Please verify cart items and try again.");
        return;
      }

      setLastRequestCount(successCount);
      setShowSuccessState(true);
      setCart([]);
      setNote("");
      setBorrowType("self");
      setSelectedDepartmentId("");
      toast.success(`Submitted ${successCount} request(s)`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to submit request";
      console.error(error);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <>
      <UserLayout cartCount={cart.length} onOpenCart={() => setIsCartOpen(true)}>
        <Outlet context={{ addToCart, openCart: () => setIsCartOpen(true), cartCount: cart.length } satisfies PortalContextType} />
      </UserLayout>

      <Sheet
        open={isCartOpen}
        onOpenChange={(open) => {
          setIsCartOpen(open);
          if (!open) setShowSuccessState(false);
        }}
      >
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "h-[92dvh] max-h-[92dvh] overflow-hidden border-white/70 bg-white/95 p-0 shadow-2xl",
            isMobile
              ? "w-full rounded-t-3xl border-t"
              : "w-[min(96vw,920px)] rounded-l-3xl border-l sm:max-h-[94dvh]",
          )}
        >
          {showSuccessState ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center sm:px-10">
              <div className="mb-4 rounded-full bg-emerald-100 p-3 text-emerald-600">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h3 className="text-xl font-semibold">ส่งคำขอเบิกสำเร็จ</h3>
              <p className="mt-1 text-sm text-muted-foreground">ระบบสร้างคำขอเบิกจำนวน {lastRequestCount} รายการเรียบร้อยแล้ว</p>
              <div className="mt-6 grid w-full max-w-sm gap-2">
                <Button type="button" onClick={() => setIsCartOpen(false)}>
                  ปิดหน้าต่าง
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowSuccessState(false)}>
                  เบิกสินค้าเพิ่ม
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex min-h-0 flex-col">
                <SheetHeader className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-orange-50 px-5 py-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-orange-200 bg-orange-100/70 p-2 text-orange-600">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <SheetTitle className="text-xl">ยืนยันการขอเบิก ({cartSummary.totalItems})</SheetTitle>
                      <SheetDescription className="mt-1 text-sm">
                        เลือกรายการเสร็จแล้ว กดส่งคำขอได้ทันทีในหน้าจอเดียว
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <ScrollArea className="min-h-0 flex-1 px-5 py-5">
                  {cart.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 py-14 text-center">
                      <Sparkles className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700">ยังไม่มีรายการในคำขอเบิก</p>
                      <p className="text-xs text-muted-foreground">เลือกสินค้าและ Serial ก่อน แล้วกลับมายืนยันได้เลย</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {cart.map((item, index) => {
                        const serialCode = item.selected_serial_code || item.p_id;
                        return (
                          <motion.article
                            key={`${item.id}-${item.selected_serial_id ?? serialCode}-${index}`}
                            className="portal-flash-card rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                            transition={reduceMotion ? undefined : { duration: 0.22, delay: index * 0.03 }}
                            whileHover={reduceMotion ? undefined : { y: -2 }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.brand || "-"}
                                  {item.model ? ` • ${item.model}` : ""}
                                </p>
                                <p className="mt-1 font-mono text-xs text-slate-500">{serialCode}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-rose-600 hover:bg-rose-50"
                                onClick={() => removeFromCart(index)}
                                aria-label="Remove item from cart"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </motion.article>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <aside className="flex min-h-0 flex-col border-t border-slate-200/80 bg-slate-50/80 p-4 lg:border-l lg:border-t-0">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">รายการทั้งหมด</span>
                      <span className="font-semibold">{cartSummary.totalItems}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">Serial ที่เลือก</span>
                      <span className="font-semibold">{cartSummary.uniqueItems}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <Label>Borrow as</Label>
                    <RadioGroup
                      defaultValue="self"
                      value={borrowType}
                      onValueChange={(value) => setBorrowType(value as "self" | "department")}
                      className="grid grid-cols-2 gap-2"
                    >
                      <div>
                        <RadioGroupItem value="self" id="type-self" className="peer sr-only" />
                        <Label
                          htmlFor="type-self"
                          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-slate-200 bg-white p-2 text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary"
                        >
                          <User className="mb-1.5 h-4 w-4" />
                          Self
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="department" id="type-dept" className="peer sr-only" />
                        <Label
                          htmlFor="type-dept"
                          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-slate-200 bg-white p-2 text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary"
                        >
                          <Building2 className="mb-1.5 h-4 w-4" />
                          Department
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {borrowType === "self" ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                      <span className="mb-1 block font-semibold">Borrower: {currentUser?.name || "Loading..."}</span>
                      <span className="text-xs opacity-80">{currentUser?.emp_code} • {currentUser?.departments?.name}</span>
                      {!currentUser ? <p className="mt-1 text-xs text-red-500">*No employee profile linked to this account</p> : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Select department</Label>
                      <SearchableSelect
                        items={departments?.map((department) => ({ value: department.id, label: department.name })) || []}
                        value={selectedDepartmentId}
                        onValueChange={setSelectedDepartmentId}
                        placeholder="Search department..."
                      />
                      <Alert className="mt-2 border-yellow-200 bg-yellow-50 py-2">
                        <AlertDescription className="text-xs text-yellow-800">
                          Requests submitted as a department will be tracked as shared department assets.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Note / Project</Label>
                    <Textarea
                      placeholder="Add reason or project/site reference..."
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className="h-20 rounded-xl bg-white"
                    />
                  </div>
                </div>

                <div className="mt-auto pt-4">
                  <Button
                    type="button"
                    className="w-full rounded-xl bg-gradient-to-r from-[#F15A24] to-[#ff7a2f] text-white hover:from-[#dd4f1a] hover:to-[#ef6c24]"
                    disabled={
                      cart.length === 0 ||
                      isSubmitting ||
                      (borrowType === "self" && !currentUser) ||
                      (borrowType === "department" && !selectedDepartmentId)
                    }
                    onClick={handleSubmitRequest}
                  >
                    {isSubmitting ? "Submitting..." : "Confirm borrow request"}
                  </Button>
                </div>
              </aside>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function usePortalContext() {
  return useOutletContext<PortalContextType>();
}


