import { useState, useMemo } from "react";
import { useProducts, Product } from "@/hooks/useProducts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package, Plus, Tag, Box, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PortalCatalogProps {
  onAddToCart: (product: Product) => void;
}

// รายการหมวดหมู่ตามจริง
const CATEGORIES = [
  "ไอที/อิเล็กทรอนิกส์ (IT)",
  "เฟอร์นิเจอร์ (FR)",
  "เครื่องมือ/อุปกรณ์ช่าง (TL)",
  "เสื้อผ้าและเครื่องแต่งกาย (CL)",
  "วัสดุสิ้นเปลือง (CS)",
  "อุปกรณ์สำนักงาน (ST)",
  "อะไหล่/ชิ้นส่วนสำรอง (SP)",
  "เครื่องใช้ไฟฟ้าบาง (AP)",
  "อุปกรณ์ความปลอดภัย (PP)",
  "อุปกรณ์โสต/สื่อ (AV)",
];

export default function PortalCatalog({ onAddToCart }: PortalCatalogProps) {
  const { data: products, isLoading } = useProducts();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter((p) => {
      // 1. Logic การค้นหาแบบ "Multi-term" (ค้นหาทีละคำ)
      // เช่นพิมพ์ "AIO HP" จะแยกเป็น ["aio", "hp"] แล้วเช็คว่าสินค้ามีครบทุกคำไหม
      const searchTerms = search.toLowerCase().trim().split(/\s+/);
      
      const productText = `
        ${p.name} 
        ${p.p_id} 
        ${p.brand || ''} 
        ${p.model || ''} 
        ${p.description || ''}
      `.toLowerCase();

      const matchSearch = searchTerms.every(term => productText.includes(term));

      // 2. Logic การกรองหมวดหมู่
      const matchCategory = category === "all" || p.category === category;

      return matchSearch && matchCategory;
    });
  }, [products, search, category]);

  // ฟังก์ชันดึงชื่อย่อหมวดหมู่มาแสดง (เช่น IT, FR)
  const getCategoryShortName = (fullCategory: string) => {
    const match = fullCategory.match(/\(([^)]+)\)/);
    return match ? match[1] : fullCategory.substring(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="ค้นหา: ชื่อ, ยี่ห้อ, รุ่น หรือ รหัสสินค้า (เช่น aio hp gen1)" 
            className="pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full md:w-[280px]">
            <SelectValue placeholder="เลือกหมวดหมู่สินค้า" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ดูทั้งหมด</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground px-1">
        พบสินค้า {filteredProducts.length} รายการ
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-[320px] rounded-xl" />)}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="group overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-300 border-slate-200 flex flex-col h-full">
              
              {/* ส่วนรูปภาพ และ Badge หมวดหมู่ */}
              <div className="aspect-[4/3] bg-slate-50 relative flex items-center justify-center p-4 overflow-hidden">
                <Badge variant="secondary" className="absolute top-2 right-2 opacity-90 shadow-sm z-10 bg-white/90 backdrop-blur text-slate-700">
                  {getCategoryShortName(product.category)}
                </Badge>
                
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    className="object-contain h-full w-full mix-blend-multiply transition-transform duration-500 group-hover:scale-110" 
                  />
                ) : (
                  <Package className="h-12 w-12 text-slate-300" />
                )}

                {/* Overlay เมื่อสินค้าหมด */}
                {product.stock_available === 0 && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-20">
                    <Badge variant="destructive" className="text-sm px-3 py-1">สินค้าหมด</Badge>
                  </div>
                )}
              </div>

              {/* ส่วนเนื้อหา */}
              <CardContent className="p-4 flex-1 flex flex-col gap-2">
                {/* SKU Code (สำคัญมากสำหรับการระบุตัวตน) */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-slate-100 w-fit px-1.5 py-0.5 rounded">
                  <Tag className="h-3 w-3" />
                  {product.p_id}
                </div>

                {/* ชื่อสินค้า */}
                <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[40px]" title={product.name}>
                  {product.name}
                </h3>

                {/* รายละเอียด Brand / Model */}
                {(product.brand || product.model) && (
                  <div className="text-xs text-slate-500 flex flex-wrap gap-y-1 gap-x-3 mt-1">
                    {product.brand && (
                      <span className="flex items-center gap-1">
                        <Box className="h-3 w-3" /> {product.brand}
                      </span>
                    )}
                    {product.model && (
                      <span className="flex items-center gap-1">
                        <Info className="h-3 w-3" /> {product.model}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>

              {/* ส่วน Footer ปุ่มกด */}
              <CardFooter className="p-3 pt-0 mt-auto">
                <div className="w-full space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">คงเหลือ:</span>
                    <span className={`font-medium ${product.stock_available > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {product.stock_available} {product.unit || 'ชิ้น'}
                    </span>
                  </div>
                  
                  <Button 
                    className="w-full gap-2 shadow-sm active:scale-95 transition-transform" 
                    size="sm" 
                    disabled={product.stock_available === 0}
                    onClick={() => onAddToCart(product)}
                  >
                    <Plus className="h-4 w-4" /> เบิกรายการนี้
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-slate-50/50">
          <Package className="h-16 w-16 mb-4 opacity-20" />
          <p className="font-medium">ไม่พบสินค้าที่คุณค้นหา</p>
          <p className="text-sm opacity-70 mt-1">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่ "ดูทั้งหมด"</p>
          <Button variant="link" onClick={() => {setSearch(''); setCategory('all');}} className="mt-2">
            ล้างคำค้นหา
          </Button>
        </div>
      )}
    </div>
  );
}