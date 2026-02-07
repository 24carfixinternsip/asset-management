import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Package, Trash2, Image as ImageIcon,
  X, Pencil, Box, Search, Filter, Eye, Check, Clock,
  FileSpreadsheet, MoreHorizontal
} from "lucide-react";
import { useProducts, useDeleteProduct, Product } from "@/hooks/useProducts";
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
import { Category } from "@/hooks/useMasterData";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { regeneratePid, updateProduct as updateProductRecord } from "@/services/products";
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
             {/* ... ส่วนแสดงผล Operation icon เหมือนเดิม ... */}
            
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
              {/* ... ส่วนแสดง User ... */}
              
              {log.operation === 'UPDATE' && log.old_data && log.new_data && (
                <div className="mt-2 bg-muted/30 p-2 rounded text-xs font-mono">
                  {Object.keys(log.new_data).map(key => {
                    // Critical Fix: Type Safe Access
                    const oldVal = log.old_data?.[key];
                    const newVal = log.new_data?.[key];

                    // Ignored fields logic
                    if (oldVal === newVal || 
                        ['updated_at', 'stock_total', 'stock_available'].includes(key)) {
                        return null;
                    }

                    return (
                      <div key={key} className="flex flex-col mb-1">
                        <span className="text-muted-foreground font-sans capitalize">{key}:</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-red-500 line-through bg-red-50 px-1 rounded truncate max-w-[150px]">
                            {String(oldVal ?? 'null')}
                          </span>
                          <span>→</span>
                          <span className="text-green-600 bg-green-50 px-1 rounded truncate max-w-[150px]">
                            {String(newVal ?? 'null')}
                          </span>
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
  const deleteProduct = useDeleteProduct();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categoriesData } = useCategoriesQuery();
  const categoryOptions = useMemo(() => categoriesData ?? [], [categoriesData]);
  const categoryById = useMemo(
    () => new Map(categoryOptions.map((category) => [category.id, category])),
    [categoryOptions],
  );

  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(() => {
    const modal = searchParams.get("modal");
    return modal === "add" || modal === "edit";
  });
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(
    searchParams.get("modal") === "import"
  );
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);

  // Process States
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(searchParams.get("modal") === "edit");

  // Selection Data
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    const catParam = searchParams.get("cat");
    if (!catParam) return "all";
    return catParam.split(",")[0] || "all";
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: productsResponse, isLoading, refetch: refetchProducts } = useProducts(
    currentPage,
    itemsPerPage,
    {
      search: debouncedSearchQuery,
      categoryId: selectedCategoryId !== "all" ? selectedCategoryId : undefined,
    }
  );

  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    setProducts(productsResponse?.data || []);
  }, [productsResponse?.data]);

  const totalPages = productsResponse?.totalPages || 1;

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    // จัดการ Search
    if (searchQuery) params.set("q", searchQuery);
    else params.delete("q");

    // จัดการ Categories
    if (selectedCategoryId !== "all") {
      params.set("cat", selectedCategoryId);
    } else {
      params.delete("cat");
    }

    // จัดการ Modal 
    if (isImportDialogOpen) {
      params.set("modal", "import");
    } else if (isDialogOpen) {
      // เช็คโหมด เพิ่ม หรือ แก้ไข
      params.set("modal", isEditing ? "edit" : "add");
    } else {
      // ถ้าไม่มี Modal ให้ลบ param
      params.delete("modal");
    }

    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedCategoryId, setSearchParams, isImportDialogOpen, isDialogOpen, isEditing]);

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
    category_id: "",
    brand: "",
    description: "",
    notes: "",
    price: "",
    unit: "Piece",
    image_url: "",
    initial_quantity: "1",
  });
  const [formErrors, setFormErrors] = useState<{ category_id?: string }>({});

  const openAddDialog = () => {
    setIsEditing(false);
    setSelectedProduct(null);
    setIsImageZoomOpen(false);
    setFormData({
      p_id: "",
      name: "",
      model: "",
      category_id: "",
      brand: "",
      description: "",
      notes: "",
      price: "",
      unit: "",
      image_url: "",
      initial_quantity: "1",
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setIsEditing(true);
    setSelectedProduct(product);
    setIsImageZoomOpen(false);
    const matchedCategoryId = product.category_id || product.categories?.id || "";
    setFormData({
      p_id: product.p_id,
      name: product.name,
      model: product.model || "",
      category_id: matchedCategoryId,
      brand: product.brand || "",
      description: product.description || "",
      notes: product.notes || "",
      price: product.price.toString(),
      unit: product.unit,
      image_url: product.image_url || "",
      initial_quantity: (product.stock_total || 0).toString(),
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const openViewDialog = (product: Product) => {
    setSelectedProduct(product);
    setIsViewDialogOpen(true);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryId((prev) => (prev === categoryId ? "all" : categoryId));
  };

  const clearFilters = () => {
    setSelectedCategoryId("all");
    setSearchQuery("");
  };

  const getCategoryLabel = (category: Pick<Category, "name" | "code">) => {
    return category.code ? `${category.name} (${category.code})` : category.name;
  };

  const getProductCategoryMeta = (product: Pick<Product, "category_id" | "categories">) => {
    const linkedCategory = product.category_id ? categoryById.get(product.category_id) : null;
    const name = linkedCategory?.name ?? product.categories?.name ?? "-";
    const code = linkedCategory?.code ?? product.categories?.code ?? null;
    return { name, code };
  };

  const requestNextSku = async (categoryId: string) => {
    return regeneratePid(categoryId);
  };

  const applyGeneratedSku = async (categoryId: string, options?: { force?: boolean }) => {
    if (!categoryId) return;
    if (!options?.force && formData.p_id) return;

    setIsGeneratingSku(true);
    try {
      const nextSku = await requestNextSku(categoryId);
      // Keep the generated SKU aligned with the currently selected category.
      setFormData((prev) =>
        prev.category_id === categoryId
          ? {
              ...prev,
              p_id: nextSku,
            }
          : prev,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถสร้าง SKU ได้";
      toast.error(message);
    } finally {
      setIsGeneratingSku(false);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setFormErrors((prev) => ({ ...prev, category_id: undefined }));
    setFormData((prev) => ({
      ...prev,
      category_id: categoryId,
      ...(isEditing ? {} : { p_id: "" }),
    }));

    if (!isEditing || !formData.p_id.trim()) {
      void applyGeneratedSku(categoryId, { force: true });
    }
  };

  useEffect(() => {
    if (!isDialogOpen) return;
    if (!formData.category_id || formData.p_id) return;

    void applyGeneratedSku(formData.category_id, { force: true });
  }, [isDialogOpen, formData.category_id, formData.p_id]);

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
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "อัปโหลดล้มเหลว";
      console.error('Upload error:', error);
      toast.error(`อัปโหลดล้มเหลว: ${message}`);
      // ถ้าพัง ให้ล้างค่าทิ้ง
      e.target.value = '';
    } finally {
      // ปลดล็อคปุ่มเมื่อเสร็จ
      setIsUploading(false);
    } 
  };

  type CategoryRelation = { name: string | null; code: string | null };
  type ProductRow = {
    id: string;
    p_id: string;
    name: string;
    model: string | null;
    category_id: string | null;
    brand: string | null;
    description: string | null;
    notes: string | null;
    price: number | null;
    unit: string | null;
    image_url: string | null;
    created_at: string | null;
    updated_at: string | null;
    categories: CategoryRelation | CategoryRelation[] | null;
  };

  const normalizeProductRow = (row: ProductRow, fallback?: Product): Product => {
    const categoryRel = Array.isArray(row.categories) ? (row.categories[0] ?? null) : row.categories;

    return {
      id: row.id,
      p_id: row.p_id,
      name: row.name,
      model: row.model,
      category_id: row.category_id ?? fallback?.category_id ?? null,
      category: categoryRel?.name ?? "-",
      category_code: categoryRel?.code ?? null,
      categories: categoryRel,
      brand: row.brand,
      description: row.description,
      notes: row.notes,
      price: row.price ?? 0,
      unit: row.unit ?? "",
      image_url: row.image_url,
      created_at: row.created_at ?? fallback?.created_at ?? "",
      updated_at: row.updated_at,
      stock_total: fallback?.stock_total ?? 0,
      stock_available: fallback?.stock_available ?? 0,
    };
  };

  const isDuplicatePidError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const maybeError = error as { code?: string; message?: string; details?: string; hint?: string };
    const text = `${maybeError.message ?? ""} ${maybeError.details ?? ""} ${maybeError.hint ?? ""}`.toLowerCase();
    return (
      (maybeError.code === "23505" || text.includes("duplicate key")) &&
      (text.includes("p_id") || text.includes("products_p_id"))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const selectedCategory = categoryById.get(formData.category_id);
    if (!selectedCategory) {
      setFormErrors((prev) => ({ ...prev, category_id: "กรุณาเลือกหมวดหมู่" }));
      toast.error("กรุณาเลือกหมวดหมู่ก่อนบันทึก");
      return;
    }

    if (!formData.p_id.trim()) {
      toast.error("กรุณาสร้าง SKU ก่อนบันทึก");
      return;
    }

    if (isEditing && selectedProduct) {
      const newQuantity = parseInt(formData.initial_quantity, 10) || 0;
      const currentQuantity = selectedProduct.stock_total || 0;

      if (newQuantity < currentQuantity) {
        const { data: borrowedSerials, error: checkError } = await supabase
          .from("product_serials")
          .select("serial_code")
          .eq("product_id", selectedProduct.id)
          .in("status", ["Borrowed", "In Use", "กำลังยืม"])
          .order("serial_code", { ascending: false })
          .limit(1);

        if (checkError) {
          toast.error("ไม่สามารถตรวจสอบสถานะการยืมได้");
          return;
        }

        if (borrowedSerials && borrowedSerials.length > 0) {
          const serialCode = borrowedSerials[0].serial_code;
          const highestBorrowedSerial = parseInt(serialCode.split("-").pop() || "0", 10);
          if (newQuantity < highestBorrowedSerial) {
            toast.error(
              `ไม่สามารถลดจำนวนได้! มีของกำลังถูกยืมอยู่ที่ Serial ${serialCode} (ขั้นต่ำ ${highestBorrowedSerial})`,
              { duration: 6000 },
            );
            return;
          }
        }
      }
    }

    setIsSaving(true);
    try {
      const parsedPrice = formData.price ? parseFloat(formData.price) : 0;
      const parsedQuantity = parseInt(formData.initial_quantity, 10) || 0;

      const productPayload = {
        p_id: formData.p_id.trim(),
        name: formData.name.trim(),
        category_id: formData.category_id,
        brand: formData.brand || null,
        model: formData.model || null,
        description: formData.description || null,
        notes: formData.notes || null,
        price: parsedPrice,
        unit: formData.unit,
        image_url: formData.image_url || null,
      };

      if (isEditing && selectedProduct) {
        const { error: rpcError } = await supabase.rpc("update_product_and_stock", {
          arg_product_id: selectedProduct.id,
          arg_sku: productPayload.p_id,
          arg_name: productPayload.name,
          arg_category: selectedCategory.name,
          arg_brand: productPayload.brand,
          arg_model: productPayload.model,
          arg_description: productPayload.description,
          arg_notes: productPayload.notes,
          arg_price: productPayload.price,
          arg_unit: productPayload.unit,
          arg_image_url: productPayload.image_url,
          arg_new_total_quantity: parsedQuantity,
        });
        if (rpcError) throw rpcError;

        // Return updated row from DB so UI maps against server-confirmed values.
        const updatedRow = await updateProductRecord(selectedProduct.id, productPayload);
        const normalizedProduct = normalizeProductRow(updatedRow as unknown as ProductRow, selectedProduct);
        setProducts((prev) =>
          prev.map((product) => (product.id === normalizedProduct.id ? { ...product, ...normalizedProduct } : product)),
        );
        setSelectedProduct((prev) => (prev && prev.id === normalizedProduct.id ? { ...prev, ...normalizedProduct } : prev));
        await refetchProducts();

        toast.success("อัปเดตสินค้าสำเร็จ");
        setIsDialogOpen(false);
        return;
      }

      const { error: createError } = await supabase.rpc("create_product_and_serials", {
        arg_p_id: productPayload.p_id,
        arg_name: productPayload.name,
        arg_category: selectedCategory.name,
        arg_brand: productPayload.brand,
        arg_model: productPayload.model,
        arg_description: productPayload.description,
        arg_notes: productPayload.notes,
        arg_price: productPayload.price,
        arg_unit: productPayload.unit,
        arg_image_url: productPayload.image_url,
        arg_initial_quantity: parsedQuantity,
      });
      if (createError) throw createError;

      const { data: createdProduct, error: createdProductError } = await supabase
        .from("products")
        .select("id")
        .eq("p_id", productPayload.p_id)
        .single();
      if (createdProductError || !createdProduct) {
        throw createdProductError ?? new Error("Created product not found after save");
      }

      // Update created row once to persist category_id, then sync local list and refetch once.
      const createdRow = await updateProductRecord(createdProduct.id, productPayload);
      const normalizedProduct = normalizeProductRow(createdRow as unknown as ProductRow);
      setProducts((prev) => {
        const exists = prev.some((product) => product.id === normalizedProduct.id);
        if (exists) {
          return prev.map((product) =>
            product.id === normalizedProduct.id ? { ...product, ...normalizedProduct } : product,
          );
        }
        return [normalizedProduct, ...prev].slice(0, itemsPerPage);
      });
      await refetchProducts();

      toast.success("เพิ่มสินค้าสำเร็จ");
      setIsDialogOpen(false);
    } catch (error: unknown) {
      if (isDuplicatePidError(error)) {
        toast.error("SKU ซ้ำ กรุณากด Regenerate", {
          action: {
            label: "Regenerate",
            onClick: () => {
              void applyGeneratedSku(formData.category_id, { force: true });
            },
          },
        });
        return;
      }

      const message = error instanceof Error ? error.message : "Product save failed";
      console.error("Submit error:", error);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const selectedProductCategoryMeta = selectedProduct ? getProductCategoryMeta(selectedProduct) : null;

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
                      {selectedCategoryId !== "all" && (
                        <Badge variant="secondary" className="h-5 px-1.5 rounded-sm">1</Badge>
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
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                            selectedCategoryId === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
                          )}
                          aria-pressed={selectedCategoryId === "all"}
                          onClick={() => setSelectedCategoryId("all")}
                        >
                          <div
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border",
                              selectedCategoryId === "all"
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground",
                            )}
                          >
                            {selectedCategoryId === "all" && <Check className="h-3 w-3" />}
                          </div>
                          <span>All</span>
                        </button>

                        {categoryOptions.map((category) => {
                          const isSelected = selectedCategoryId === category.id;
                          return (
                            <button
                              key={category.id}
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                                isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
                              )}
                              aria-pressed={isSelected}
                              onClick={() => toggleCategory(category.id)}
                            >
                              <div
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded border",
                                  isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground",
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <span>{getCategoryLabel(category)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    {selectedCategoryId !== "all" && (
                      <>
                        <Separator />
                        <div className="p-2">
                          <Button variant="ghost" className="w-full h-8 text-xs" onClick={() => setSelectedCategoryId("all")}>ล้างตัวกรอง</Button>
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
          {selectedCategoryId !== "all" && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <span className="text-xs text-muted-foreground shrink-0">Filter:</span>
              {(() => {
                const category = categoryById.get(selectedCategoryId);
                if (!category) return null;
                return (
                  <Badge key={category.id} variant="secondary" className="gap-1 pr-1 shrink-0">
                    {getCategoryLabel(category)}
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSelectedCategoryId("all")} />
                  </Badge>
                );
              })()}
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
        ) : products.length > 0 ? (
          <>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((product) => {
                const categoryMeta = getProductCategoryMeta(product);
                return (
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
                      <div className="mb-2">
                        <Badge variant="secondary" className="max-w-full truncate rounded-full bg-muted/70 px-2 py-0.5 text-[10px] font-medium">
                          {categoryMeta.name}
                          {categoryMeta.code ? ` (${categoryMeta.code})` : ""}
                        </Badge>
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
                            <span className="font-semibold">{product.stock_available ?? 0}</span>
                            <span className="text-muted-foreground/50">/</span>
                            <span className="text-muted-foreground">{product.stock_total ?? 0}</span>
                           </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )})}
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
            {(searchQuery || selectedCategoryId !== "all") && <Button variant="outline" className="mt-4" onClick={clearFilters}>ล้างการค้นหาและตัวกรอง</Button>}
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
                            <div className="space-y-1"><Label className="text-xs text-muted-foreground">หมวดหมู่</Label><p className="font-medium">{selectedProductCategoryMeta?.name ?? "-"}{selectedProductCategoryMeta?.code ? ` (${selectedProductCategoryMeta.code})` : ""}</p></div>
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
                  <SearchableSelect
                    items={categoryOptions.map((category) => ({
                      value: category.id,
                      label: getCategoryLabel(category),
                    }))}
                    value={formData.category_id}
                    onValueChange={handleCategoryChange}
                    placeholder="เลือกหมวดหมู่"
                    searchPlaceholder="ค้นหาหมวดหมู่..."
                    emptyMessage="ไม่พบหมวดหมู่"
                  />
                  {formErrors.category_id && <p className="text-xs text-rose-600">{formErrors.category_id}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p_id" className="text-xs text-muted-foreground">SKU (Auto)</Label>
                  <div className="flex gap-2">
                    <Input id="p_id" value={formData.p_id} readOnly className="bg-muted font-mono" placeholder="รหัส SKU อัตโนมัติ" />
                    {isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void applyGeneratedSku(formData.category_id, { force: true })}
                        disabled={!formData.category_id || isGeneratingSku}
                        aria-label="Regenerate SKU"
                      >
                        {isGeneratingSku ? "กำลังสร้าง..." : "Regenerate"}
                      </Button>
                    )}
                  </div>
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
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">รูปภาพ</Label>
                  <button
                    type="button"
                    className="group relative flex min-h-[240px] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/30"
                    onClick={() => {
                      if (formData.image_url) setIsImageZoomOpen(true);
                    }}
                    aria-label={formData.image_url ? "View full image" : "No image available"}
                  >
                    {formData.image_url ? (
                      <>
                        <img src={formData.image_url} alt={formData.name || "Product image"} className="max-h-[300px] w-full object-contain" />
                        <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Click to zoom
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-xs">ยังไม่มีรูปภาพ</span>
                      </div>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <Input
                      id="product-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                    <Button type="button" variant="outline" disabled={isUploading} asChild>
                      <label htmlFor="product-image-upload" className="cursor-pointer">
                        {isUploading ? "กำลังอัปโหลด..." : "อัปโหลด / เปลี่ยนรูป"}
                      </label>
                    </Button>
                    {formData.image_url && (
                      <Button type="button" variant="ghost" onClick={() => setFormData((prev) => ({ ...prev, image_url: "" }))}>
                        ลบรูป
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs text-muted-foreground">หมายเหตุ (ภายใน)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-background shrink-0 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
              <Button 
                type="submit" 
                disabled={isSaving || isGeneratingSku || isUploading}
              >
                {(isSaving || isUploading)
                ? (isUploading ? 'กำลังอัปโหลดรูป...' : 'กำลังบันทึก...')
                : 'บันทึก'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isImageZoomOpen} onOpenChange={setIsImageZoomOpen}>
        <DialogContent className="h-[95vh] w-[95vw] max-w-none border-none bg-black/95 p-4 [&>button]:hidden">
          <button
            type="button"
            onClick={() => setIsImageZoomOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/30"
            aria-label="Close image preview"
          >
            <X className="h-5 w-5" />
          </button>
          {formData.image_url ? (
            <div className="flex h-full w-full items-center justify-center">
              <img src={formData.image_url} alt={formData.name || "Product image"} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/70">No image available</div>
          )}
        </DialogContent>
      </Dialog>

      <ImportProductDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} onSuccess={() => { void refetchProducts(); }} />
    </MainLayout>
  );
}



