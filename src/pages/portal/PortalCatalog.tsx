import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { usePortalContext } from "./PortalContainer";
import { useProducts, Product } from "@/hooks/useProducts"; 
import { useSerials, ProductSerial, useSerialsWithPagination } from "@/hooks/useSerials";
import { toast } from "sonner";
import { PaginationControl } from "@/components/ui/pagination-control";

const SerialPickerModal = ({ 
  product, 
  isOpen, 
  onClose, 
  onSelect 
}: { 
  product: Product | null, 
  isOpen: boolean, 
  onClose: () => void, 
  onSelect: (serial: ProductSerial) => void 
}) => {
  const [searchSerial, setSearchSerial] = useState("");
  const [serialPage, setSerialPage] = useState(1);

  const { data: serialsResponse, isLoading } = useSerialsWithPagination({
    productId: product?.id,
    status: 'Ready',
    search: searchSerial,
    page: serialPage,
    pageSize: 10
  });

  const serials = serialsResponse?.data || [];
  const totalPages = serialsResponse?.totalPages || 0;

  // Reset search + page เมื่อปิด Modal
  useEffect(() => {
    if (!isOpen) {
      setSearchSerial("");
      setSerialPage(1);
    }
  }, [isOpen]);

  // Reset search เมื่อปิด Modal
  useEffect(() => {
    if (!isOpen) {
      setSearchSerial("");
    }
  }, [isOpen]);

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg bg-slate-100 border overflow-hidden shrink-0 flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-8 w-8 text-slate-300" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl">{product.name}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-col gap-1">
                <span>{product.brand} {product.model}</span>
                <span className="text-xs text-muted-foreground">รหัสสินค้า: {product.p_id}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 bg-slate-50 border-b">
           <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="ค้นหาเลข Serial (เช่น NB-001)..." 
              value={searchSerial}
              onChange={(e) => setSearchSerial(e.target.value)}
              className="pl-9 bg-white"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-4 min-h-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : serials && serials.length > 0 ? (
            <div className="grid gap-2">
              {serials.map((serial) => (
                <div 
                  key={serial.id} 
                  className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all group"
                  onClick={() => onSelect(serial)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 px-2 py-1 rounded text-sm font-mono font-medium text-slate-700 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {serial.serial_code}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">
                        {serial.location_id ? `📍 ${serial.locations?.name || 'ไม่ระบุชื่อตำแหน่ง'}` : 'ไม่ระบุตำแหน่ง'}
                      </span>
                      {serial.notes && <span className="text-[10px] text-slate-400">{serial.notes}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              {searchSerial ? "ไม่พบเลข Serial ที่ค้นหา" : "สินค้าหมดชั่วคราว"}
            </div>
          )}
        </ScrollArea>
        {totalPages > 1 && (
          <div className="p-4 border-t bg-slate-50">
            <PaginationControl
              currentPage={serialPage}
              totalPages={totalPages}
              onPageChange={setSerialPage}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- Main Component ---
const PortalCatalog = () => {
  const { data: employee } = useCurrentEmployee();
  const { addToCart } = usePortalContext();
  
  // URL Params Management
  const [searchParams, setSearchParams] = useSearchParams();
  
  const searchTerm = searchParams.get("search") || "";
  const page = Number(searchParams.get("page")) || 1;

  const setSearchTerm = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.delete("page"); // Reset page เมื่อค้นหาใหม่
    setSearchParams(params, { replace: true });
  };

  const setPage = (value: number) => {
    const params = new URLSearchParams(searchParams);
    if (value > 1) {
      params.set("page", value.toString());
    } else {
      params.delete("page");
    }
    setSearchParams(params, { replace: true });
  };
  
  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch Products Group with Pagination
  const pageSize = 20;
  const { data: productsResponse, isLoading } = useProducts(
    page,
    pageSize,
    { search: searchTerm }
  );

  // Destructure response
  const productsData = productsResponse?.data || [];
  const totalPages = productsResponse?.totalPages || 0;

  // Handle Product Selection -> Open Modal
  const handleProductClick = (product: Product) => {
    // เช็คเบื้องต้นว่ามีของไหม (ถ้า API ส่ง stock_available มา)
    // ถ้าไม่มี stock_available ส่งมา ก็ให้เปิด Modal ไปลุ้นเอาข้างในได้
    if (product.stock_available === 0) {
      toast.error("สินค้าหมดสต็อก");
      return;
    }
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  // Handle Serial Selection from Modal
  const handleSelectSerial = (serial: ProductSerial) => {
    // แปลงข้อมูลเพื่อลงตะกร้า
    const productForCart: Product = {
      id: serial.product_id,
      p_id: serial.products?.p_id || '',
      name: serial.products?.name || '',
      category: serial.products?.category || '',
      brand: serial.products?.brand || null,
      model: serial.products?.model || null,
      description: null,
      notes: null,
      price: serial.products?.price || 0,
      unit: serial.products?.unit || 'ea',
      image_url: serial.products?.image_url || null,
      created_at: serial.products?.created_at || new Date().toISOString(),
      updated_at: null,
      stock_total: 1,
      stock_available: 1,
      // เพิ่ม fields พิเศษสำหรับระบุ Serial (ต้องแก้ Type Product ด้วย)
      selected_serial_id: serial.id,
      selected_serial_code: serial.serial_code
    } as Product & { selected_serial_id: string; selected_serial_code: string };

    addToCart(productForCart);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      
      {/* Catalog Section (Product Group View) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">รายการที่สามารถเบิกได้</h2>
            <p className="text-sm text-muted-foreground">เลือกสินค้าที่ต้องการ</p>
          </div>
          <div className="relative w-full sm:w-[300px]">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder="ค้นหาสินค้า (ชื่อ, แบรนด์)..." 
               className="pl-9 h-10"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
             {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="aspect-[4/5] w-full rounded-xl" />)}
          </div>
        ) : productsData.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {productsData.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow relative overflow-hidden"
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-4">
                    {product.image_url ? (
                      <div className="w-full aspect-square bg-gray-50 rounded mb-3 overflow-hidden">
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center">
                        <Package className="h-16 w-16 text-gray-400" />
                      </div>
                    )}

                    {product.stock_available !== undefined && product.stock_available > 0 && (
                      <Badge className="absolute top-2 right-2 bg-green-500">
                        ว่าง {product.stock_available}
                      </Badge>
                    )}

                    {product.stock_available === 0 && (
                      <Badge className="absolute top-2 right-2 bg-red-500">
                        สินค้าหมด
                      </Badge>
                    )}

                    <h3 className="font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-gray-500">
                      {product.brand || '-'}{product.model ? ` • ${product.model}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{product.p_id}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <PaginationControl
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">ไม่พบสินค้า</p>
            <p className="text-sm">ลองค้นหาด้วยคำค้นอื่น หรือติดต่อ Admin</p>
          </div>
        )}
      </section>

      {/* Serial Picker Modal */}
      <SerialPickerModal 
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelectSerial}
      />

    </div>
  );
};

export default PortalCatalog;