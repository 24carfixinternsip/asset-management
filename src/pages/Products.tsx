import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Package, Trash2, Image as ImageIcon,
  X, Pencil, Box, Search, Filter, Eye, Check, Clock, User as UserIcon,
  FileSpreadsheet, MoreHorizontal
} from "lucide-react";
import { useProducts, useDeleteProduct, useUpdateProduct, useCreateProduct, Product, CreateProductInput } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { ImportProductDialog } from "@/components/products/ImportProductDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import imageCompression from 'browser-image-compression';
import { useCategories } from "@/hooks/useMasterData";
import { useSearchParams } from "react-router-dom";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// --- Sub-Component: Product History (No Change) ---
function ProductHistory({ productId }: { productId: string }) {
  const { data: logs, isLoading } = useAuditLogs('products', productId);

  if (isLoading) return <div className="p-4 text-center text-sm">กำลังโหลดประวัติ...</div>;
  if (!logs || logs.length === 0) return <div className="p-4 text-center text-sm text-muted-foreground">ยังไม่มีประวัติการแก้ไข</div>;

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 text-sm border-b pb-3 last:border-0">
            <div className={cn("mt-1 min-w-2 w-2 h-2 rounded-full", 
               log.operation === 'INSERT' ? 'bg-green-500' :
               log.operation === 'UPDATE' ? 'bg-blue-500' : 'bg-red-500'
            )} />
            <div className="flex-1 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">
                  {log.operation === 'INSERT' ? 'สร้างรายการ' :
                   log.operation === 'UPDATE' ? 'แก้ไขข้อมูล' : 'ลบรายการ'}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(log.created_at), 'd MMM yy HH:mm', { locale: th })}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <UserIcon className="h-3 w-3" />
                โดย: {log.changed_by_email || 'Unknown'}
              </div>
              {log.operation === 'UPDATE' && log.old_data && log.new_data && (
                <div className="mt-2 bg-muted/30 p-2 rounded text-xs font-mono">
                  {Object.keys(log.new_data).map(key => {
                    // @ts-ignore
                    const oldVal = log.old_data[key];
                    // @ts-ignore
                    const newVal = log.new_data[key];
                    if (oldVal === newVal || key === 'updated_at' || key === 'stock_total' || key === 'stock_available') return null;
                    return (
                      <div key={key} className="flex flex-col mb-1">
                        <span className="text-muted-foreground font-sans capitalize">{key}:</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-red-500 line-through bg-red-50 px-1 rounded truncate max-w-[150px]">{String(oldVal)}</span>
                          <span>→</span>
                          <span className="text-green-600 bg-green-50 px-1 rounded truncate max-w-[150px]">{String(newVal)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export default function Products() {
  const { data: products, isLoading } = useProducts();
  const createProductHook = useCreateProduct();
  const updateProductHook = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categoriesData } = useCategories();
  const categories = useMemo(() => {
    return categoriesData?.map(c => c.name) || [];
  }, [categoriesData]);

  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Process States
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Selection Data
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // --- Search & Filter States ---
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const catParam = searchParams.get("cat");
    return catParam ? catParam.split(",") : [];
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    // จัดการ Search
    if (searchQuery) params.set("q", searchQuery);
    else params.delete("q");

    // จัดการ Categories (แปลง Array -> String คั่นด้วย comma)
    if (selectedCategories.length > 0) {
      params.set("cat", selectedCategories.join(","));
    } else {
      params.delete("cat");
    }

    setSearchParams(params, { replace: true });
    
    // รีเซ็ตหน้ากลับไปหน้า 1 เสมอเมื่อ Filter เปลี่ยน
    setCurrentPage(1);
  }, [searchQuery, selectedCategories, setSearchParams]);

  // Filtering Logic
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((product) => {
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category);
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/);
        const productText = `
          ${product.name} 
          ${product.p_id} 
          ${product.brand || ''} 
          ${product.model || ''}
          ${product.description || ''}
        `.toLowerCase();
        matchesSearch = searchTerms.every(term => productText.includes(term));
      }
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategories, searchQuery]);

  // Pagination Logic
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const getPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) items.push(i);
        items.push('ellipsis');
        items.push(totalPages);
      }
      else if (currentPage >= totalPages - 3) {
        items.push(1);
        items.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) items.push(i);
      }
      else {
        items.push(1);
        items.push('ellipsis');
        items.push(currentPage - 1);
        items.push(currentPage);
        items.push(currentPage + 1);
        items.push('ellipsis');
        items.push(totalPages);
      }
    }
    return items;
  };

  // --- Form Data ---
  const [formData, setFormData] = useState({
    p_id: "",
    name: "",
    model: "",
    category: "",
    brand: "",
    description: "",
    notes: "",
    price: "",
    unit: "Piece",
    image_url: "",
    initial_quantity: "1",
  });

  const openAddDialog = () => {
    setIsEditing(false);
    setSelectedProduct(null);
    setFormData({
      p_id: "",
      name: "",
      model: "",
      category: "",
      brand: "",
      description: "",
      notes: "",
      price: "",
      unit: "",
      image_url: "",
      initial_quantity: "1",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setIsEditing(true);
    setSelectedProduct(product);
    setFormData({
      p_id: product.p_id,
      name: product.name,
      model: product.model || "",
      category: product.category,
      brand: product.brand || "",
      description: product.description || "",
      notes: product.notes || "",
      price: product.price.toString(),
      unit: product.unit,
      image_url: product.image_url || "",
      initial_quantity: (product.stock_total || 0).toString(),
    });
    setIsDialogOpen(true);
  };

  const openViewDialog = (product: Product) => {
    setSelectedProduct(product);
    setIsViewDialogOpen(true);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSearchQuery("");
  };

  const getCategoryPrefix = (category: string) => {
    const match = category.match(/\(([^)]+)\)/);
    return match ? match[1].toUpperCase() : "GEN";
  };

  const generateSku = async (category: string) => {
    setFormData(prev => ({ ...prev, category }));
    if (isEditing) return;

    const prefix = getCategoryPrefix(category);
    const currentCategory = category;
    setIsGeneratingSku(true);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('p_id')
        .ilike('p_id', `${prefix}-%`)
        .order('p_id', { ascending: false })
        .limit(1);

      if (error) throw error;

      const lastCode = data?.[0]?.p_id;
      const match = lastCode?.match(/-(\d+)$/);
      const lastNumber = match ? parseInt(match[1], 10) : 0;
      const nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
      const padLength = 4;
      const nextSku = `${prefix}-${String(nextNumber).padStart(padLength, '0')}`;

      setFormData(prev => (
        prev.category === currentCategory ? { ...prev, p_id: nextSku } : prev
      ));
    } catch (err) {
      toast.error('SKU generation failed');
      setFormData(prev => ({ ...prev, category }));
    } finally {
      setIsGeneratingSku(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
    // ตั้งค่าย่อรูป
      const options = {
        maxSizeMB: 0.5,           // ไม่เกิน 500KB
        maxWidthOrHeight: 1000,   // กว้างไม่เกิน 1000px
        useWebWorker: true,
        initialQuality: 0.8
      };

      console.log(`Original: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

      const compressedFile = await imageCompression(file, options);

      console.log(`Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
      .from('asset-images')
      .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('asset-images')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      toast.success('อัปโหลดรูปสำเร็จ');
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('อัปโหลดล้มเหลว: ' + error.message);
      // ถ้าพัง ให้ล้างค่าทิ้ง
      e.target.value = '';
    } finally {
      // ปลดล็อคปุ่มเมื่อเสร็จ
      setIsUploading(false);
    } 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createProductHook.isPending || updateProductHook.isPending) return;

    try {
      const commonData = {
        name: formData.name,
        category: formData.category,
        brand: formData.brand,
        model: formData.model,
        description: formData.description,
        notes: formData.notes,
        price: formData.price ? parseFloat(formData.price) : 0,
        unit: formData.unit,
        image_url: formData.image_url,
        initial_quantity: parseInt(formData.initial_quantity) || 0,
      };

      if (isEditing && selectedProduct) {
        await updateProductHook.mutateAsync({
          id: selectedProduct.id,
          current_quantity: selectedProduct.stock_total || 0,
          p_id: formData.p_id,
          ...commonData
        });
      } else {
        console.log('Submitting create payload...');
        const result = await createProductHook.mutateAsync({
          p_id: formData.p_id,
          ...commonData as CreateProductInput
        });
        console.log('✅ Create Product Result:', result);
      }
      setIsDialogOpen(false);
    } catch (error: unknown) {
      console.error('❌ Submit Error:', error);
      toast.error('Product save failed');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <MainLayout title="สินค้า/ทรัพย์สิน (Products)">
      <div className="space-y-4 sm:space-y-6">

        {/* --- Toolbar --- */}
        <div className="bg-card p-4 rounded-lg shadow-sm border space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
             {/* Search */}
             <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา (เช่น AIO Dell, IT-001)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
             </div>

             {/* Actions */}
             <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 border-dashed flex-1 sm:flex-none">
                      <Filter className="h-4 w-4" />
                      ตัวกรอง
                      {selectedCategories.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 rounded-sm">{selectedCategories.length}</Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="end">
                    <div className="p-4 pb-2">
                      <h4 className="font-medium leading-none mb-2">หมวดหมู่สินค้า</h4>
                    </div>
                    <Separator />
                    <ScrollArea className="h-[300px] p-2">
                      <div className="space-y-1">
                        {categories.map((category) => {
                          const isSelected = selectedCategories.includes(category);
                          return (
                            <div
                              key={category}
                              className={cn(
                                "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm transition-colors",
                                isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                              )}
                              onClick={() => toggleCategory(category)}
                            >
                              <div className={cn("flex h-4 w-4 items-center justify-center rounded border", isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground')}>
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <span>{category}</span>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    {(selectedCategories.length > 0) && (
                      <>
                        <Separator />
                        <div className="p-2">
                          <Button variant="ghost" className="w-full h-8 text-xs" onClick={() => setSelectedCategories([])}>ล้างตัวกรอง</Button>
                        </div>
                      </>
                    )}
                  </PopoverContent>
                </Popover>

                <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => setIsImportDialogOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
                <Button className="gap-2 flex-1 sm:flex-none" onClick={openAddDialog}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">เพิ่มสินค้า</span>
                  <span className="sm:hidden">เพิ่ม</span>
                </Button>
             </div>
          </div>

          {/* Active Filters */}
          {(selectedCategories.length > 0) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <span className="text-xs text-muted-foreground shrink-0">Filter:</span>
              {selectedCategories.map(cat => (
                <Badge key={cat} variant="secondary" className="gap-1 pr-1 shrink-0">
                  {cat.match(/\(([^)]+)\)/)?.[1] || cat}
                  <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => toggleCategory(cat)} />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={clearFilters}>Reset</Button>
            </div>
          )}
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Card key={i}><CardContent className="p-3 sm:p-4"><Skeleton className="h-6 w-1/3 mb-2" /><Skeleton className="aspect-square w-full rounded-lg mb-3" /><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {paginatedProducts.map((product) => (
                <Card 
                  key={product.id} 
                  className="group overflow-hidden transition-all hover:shadow-lg border hover:border-primary/20 bg-card flex flex-col h-full cursor-pointer relative"
                  onClick={() => openViewDialog(product)}
                >
                  <CardContent className="p-3 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="secondary" className="bg-black text-white hover:bg-black/90 font-mono text-[10px] tracking-wide rounded px-1.5 h-5">
                        {product.p_id}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openViewDialog(product); }}><Eye className="mr-2 h-4 w-4"/> รายละเอียด</DropdownMenuItem>
                           <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(product); }}><Pencil className="mr-2 h-4 w-4"/> แก้ไข</DropdownMenuItem>
                           <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => { e.stopPropagation(); if(confirm('ยืนยันลบ?')) deleteProduct.mutate(product.id); }}><Trash2 className="mr-2 h-4 w-4"/> ลบ</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="relative aspect-square mb-2 flex items-center justify-center p-2">
                        {product.image_url ? (
                          <img src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-contain mix-blend-multiply transition-transform group-hover:scale-105" 
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('bg-muted/20');
                          }}
                          />
                        ) : (
                          <div className="w-full h-full bg-muted/20 rounded-lg flex items-center justify-center"><Box className="h-10 w-10 text-muted-foreground/20" /></div>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col mt-1">
                      <div className="text-[10px] font-bold text-muted-foreground mb-0.5 uppercase truncate">
                          {product.category.match(/\(([^)]+)\)/)?.[1] || "GEN"}
                      </div>
                      <h3 className="font-bold text-sm text-foreground line-clamp-2 leading-tight mb-3 min-h-[2.5em]" title={product.name}>
                        {product.name}
                      </h3>
                      <div className="space-y-1 text-xs mb-3">
                          <div className="flex justify-between items-center text-muted-foreground">
                             <span className="text-[10px]">ยี่ห้อ:</span><span className="font-medium text-foreground truncate max-w-[70%]">{product.brand || "-"}</span>
                          </div>
                          <div className="flex justify-between items-center text-muted-foreground">
                             <span className="text-[10px]">รุ่น:</span><span className="font-medium text-foreground truncate max-w-[70%]">{product.model || "-"}</span>
                          </div>
                      </div>
                      <div className="mt-auto pt-2 border-t border-dashed flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-muted-foreground">ราคา</span>
                          <span className="text-sm font-bold text-orange-600">{formatCurrency(product.price).replace('.00', '')}</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[9px] text-muted-foreground mb-0.5">สถานะ</span>
                           <Badge variant="outline" className={cn("h-5 px-1.5 gap-1 text-[10px] font-normal", product.stock_available > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                             <Box className="h-3 w-3" />
                             <span className="font-semibold">{product.stock_available}</span><span className="text-muted-foreground/50">/</span><span className="text-muted-foreground">{product.stock_total}</span>
                           </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8 pb-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(p => p - 1); }} className={cn("h-9 w-9 p-0 sm:w-auto sm:px-4", currentPage === 1 ? "pointer-events-none opacity-50" : "")} /></PaginationItem>
                    <div className="flex sm:hidden text-xs text-muted-foreground items-center px-4 font-medium">{currentPage} / {totalPages}</div>
                    <div className="hidden sm:flex items-center gap-1">
                      {getPaginationItems().map((page, index) => {
                        if (page === 'ellipsis') return <PaginationItem key={`el-${index}`}><PaginationEllipsis /></PaginationItem>;
                        return <PaginationItem key={page}><PaginationLink href="#" isActive={currentPage === page} onClick={(e) => { e.preventDefault(); setCurrentPage(page as number); }} className="h-9 w-9 cursor-pointer">{page}</PaginationLink></PaginationItem>;
                      })}
                    </div>
                    <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(p => p + 1); }} className={cn("h-9 w-9 p-0 sm:w-auto sm:px-4", currentPage === totalPages ? "pointer-events-none opacity-50" : "")} /></PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-muted/30 rounded-lg border border-dashed">
            <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-4"><Search className="h-10 w-10 text-muted-foreground/50" /></div>
            <h3 className="text-lg font-semibold text-foreground">ไม่พบสินค้า</h3>
            {(searchQuery || selectedCategories.length > 0) && <Button variant="outline" className="mt-4" onClick={clearFilters}>ล้างการค้นหาและตัวกรอง</Button>}
          </div>
        )}
      </div>

      {/* --- View Details Dialog --- */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl overflow-hidden p-0 gap-0 h-[85vh] flex flex-col bg-background" aria-describedby="product-details-description">
          {selectedProduct && (
            <>
              <DialogHeader className="px-6 py-4 border-b flex flex-row justify-between items-center bg-muted/10 shrink-0 relative space-y-0 text-left">
                <div>
                  <DialogTitle className="text-xl font-bold pr-8">{selectedProduct.name}</DialogTitle>
                </div>
              </DialogHeader>
              <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-4 pb-2 shrink-0">
                  <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
                    <TabsTrigger value="details">รายละเอียด</TabsTrigger>
                    <TabsTrigger value="history">ประวัติ</TabsTrigger>
                  </TabsList>
                </div>
                <div className="flex-1 overflow-hidden p-6 pt-2">
                  <TabsContent value="details" className="h-full mt-0 overflow-y-auto pb-4">
                    <div className="flex flex-col md:flex-row gap-6 h-full">
                      <div className="w-full md:w-1/3 shrink-0">
                        <div className="bg-muted/20 p-4 rounded-lg flex items-center justify-center border h-64 md:h-auto">
                          {selectedProduct.image_url ? (
                            <img src={selectedProduct.image_url} alt={selectedProduct.name} className="max-w-full max-h-[300px] object-contain mix-blend-multiply" />
                          ) : (
                            <div className="flex flex-col items-center text-muted-foreground/30"><Package className="h-24 w-24 mb-4" /><p>ไม่มีรูปภาพ</p></div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 space-y-6 pb-8">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label className="text-xs text-muted-foreground">รหัส (SKU)</Label><p className="font-mono font-medium">{selectedProduct.p_id}</p></div>
                            <div className="space-y-1"><Label className="text-xs text-muted-foreground">หมวดหมู่</Label><p className="font-medium">{selectedProduct.category}</p></div>
                            <div className="space-y-1"><Label className="text-xs text-muted-foreground">ยี่ห้อ</Label><p className="font-medium">{selectedProduct.brand || '-'}</p></div>
                            <div className="space-y-1"><Label className="text-xs text-muted-foreground">รุ่น</Label><p className="font-medium">{selectedProduct.model || '-'}</p></div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1"><Label className="text-xs text-muted-foreground">ราคาต่อหน่วย</Label><p className="font-semibold text-lg text-primary">{formatCurrency(selectedProduct.price)}</p></div>
                           <div className="space-y-1"><Label className="text-xs text-muted-foreground">จำนวนคงเหลือ</Label>
                              <div className="flex items-baseline gap-1">
                                <span className={cn("text-lg font-bold", selectedProduct.stock_available > 0 ? 'text-green-600' : 'text-red-500')}>{selectedProduct.stock_available}</span>
                                <span className="text-sm text-muted-foreground">พร้อมใช้</span> <span className="text-xs text-muted-foreground">/ {selectedProduct.stock_total} ทั้งหมด</span>
                              </div>
                           </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                           <Label className="text-sm font-semibold">รายละเอียด</Label>
                           <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedProduct.description || '-'}</p>
                        </div>
                        {selectedProduct.notes && (
                            <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100 text-sm text-yellow-800"><span className="font-semibold mr-2">Note:</span>{selectedProduct.notes}</div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="history" className="h-full mt-0 overflow-hidden"><ProductHistory productId={selectedProduct.id} /></TabsContent>
                </div>
                <div className="p-4 border-t flex justify-end gap-2 bg-background shrink-0">
                  <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>ปิด</Button>
                  <Button onClick={() => { setIsViewDialogOpen(false); openEditDialog(selectedProduct); }}><Pencil className="h-4 w-4 mr-2" />แก้ไขข้อมูล</Button>
                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Add/Edit Form Dialog (Minimalist Version) --- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[600px] sm:max-w-[600px] max-h-[85vh] p-0 flex flex-col gap-0 bg-background">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>{isEditing ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              
              {/* Row 1: Category & SKU */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs text-muted-foreground">หมวดหมู่</Label>
                  <Select value={formData.category} onValueChange={(value) => generateSku(value)} disabled={isEditing}>
                    <SelectTrigger><SelectValue placeholder="เลือกหมวดหมู่" /></SelectTrigger>
                    <SelectContent>{categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p_id" className="text-xs text-muted-foreground">SKU (Auto)</Label>
                  <Input id="p_id" value={formData.p_id} readOnly className="bg-muted font-mono" placeholder="รหัส SKU อัตโนมัติ" />
                </div>
              </div>

              {/* Row 2: Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-muted-foreground">ชื่อสินค้า <span className="text-red-500">*</span></Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} required placeholder="เช่น Notebook, AIO"/>
              </div>

              {/* Row 3: Brand & Model */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <Label htmlFor="brand" className="text-xs text-muted-foreground">ยี่ห้อ</Label>
                   <Input id="brand" value={formData.brand} onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))} placeholder="เช่น HP, Logitech"/>
                </div>
                <div className="space-y-1.5">
                   <Label htmlFor="model" className="text-xs text-muted-foreground">รุ่น (Model)</Label>
                   <Input id="model" value={formData.model} onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))} placeholder="เช่น MOFYUO, EDF200120"/>
                </div>
              </div>

              {/* Row 4: Price, Qty, Unit */}
              <div className="grid grid-cols-3 gap-4">
                 <div className="space-y-1.5">
                    <Label htmlFor="price" className="text-xs text-muted-foreground">ราคา</Label>
                    <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))} placeholder="0.00" />
                 </div>
                 <div className="space-y-1.5">
                    <Label htmlFor="initial_quantity" className="text-xs text-muted-foreground">{isEditing ? "จำนวน" : "จำนวนเริ่ม"}</Label>
                    <Input id="initial_quantity" type="number" min="0" value={formData.initial_quantity} onChange={(e) => setFormData(prev => ({ ...prev, initial_quantity: e.target.value }))} />
                 </div>
                 <div className="space-y-1.5">
                    <Label htmlFor="unit" className="text-xs text-muted-foreground">หน่วย</Label>
                    <Input id="unit" value={formData.unit} onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))} placeholder="เช่น ชิ้น, เครื่อง"/>
                 </div>
              </div>

              {/* Row 5: Description */}
              <div className="space-y-1.5">
                 <Label htmlFor="description" className="text-xs text-muted-foreground">รายละเอียด</Label>
                 <Textarea id="description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} className="resize-none" placeholder="Ram 8 GB, RTX5090"/>
              </div>

              {/* Row 6: Image & Notes */}
              <div className="grid grid-cols-[80px_1fr] gap-4">
                 <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">รูปภาพ</Label>
                    <div className="relative h-20 w-20 border rounded-md flex items-center justify-center bg-muted/20 overflow-hidden cursor-pointer hover:bg-muted/40 transition-colors group">
                       {formData.image_url ? (
                          <>
                            <img src={formData.image_url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}>
                               <X className="text-white h-5 w-5" />
                            </div>
                          </>
                       ) : (
                          <ImageIcon className="text-muted-foreground h-6 w-6" />
                       )}
                       <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} disabled={isUploading} title="Click to upload" />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs text-muted-foreground">หมายเหตุ (ภายใน)</Label>
                    <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={3} className="resize-none" />
                 </div>
              </div>
            </div>

            <div className="p-4 border-t bg-background shrink-0 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
              <Button 
                type="submit" 
                disabled={createProductHook.isPending || updateProductHook.isPending || isGeneratingSku || isUploading}
              >
                {(createProductHook.isPending || updateProductHook.isPending || isUploading) 
                ? (isUploading ? 'กำลังอัปโหลดรูป...' : 'กำลังบันทึก...')
                : 'บันทึก'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ImportProductDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} onSuccess={() => window.location.reload()} />
    </MainLayout>
  );
}