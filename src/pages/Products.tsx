import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Package, Trash2, Image as ImageIcon,
  X, Pencil, Box, Search, Filter, Eye, Check, Clock, Loader2,
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
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 639px)").matches;
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsPhone(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isPhone;
}

export default function Products() {
  const deleteProduct = useDeleteProduct();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPhone = useIsPhone();
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
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [isImageDragActive, setIsImageDragActive] = useState(false);

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

  const { data: productsResponse, isLoading, isFetching, refetch: refetchProducts } = useProducts(
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

  const getStockMeta = (product: Product) => {
    const available = product.stock_available ?? 0;
    const total = product.stock_total ?? 0;

    if (available <= 0) {
      return {
        label: total > 0 ? `ไม่พร้อมใช้ ${available} / ${total}` : "หมด",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    }

    return {
      label: `คงเหลือ ${available} / ${total}`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
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

  const uploadProductImage = async (file: File) => {
    setIsUploading(true);
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1000,
        useWebWorker: true,
        initialQuality: 0.8,
      };

      const compressedFile = await imageCompression(file, options);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("asset-images")
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("asset-images").getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
      toast.success("Image uploaded successfully");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload failed";
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadProductImage(file);
    e.target.value = "";
  };

  const handleImageDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsImageDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadProductImage(file);
  };

  const openImageZoom = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return;
    setZoomImageUrl(imageUrl);
    setIsImageZoomOpen(true);
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
      (text.includes("p_id") || text.includes("products_p_id") || text.includes("idx_products_p_id_unique_normalized"))
    );
  };

  const getSubmitErrorMessage = (error: unknown, fallback = "บันทึกสินค้าไม่สำเร็จ") => {
    if (!error) return fallback;
    if (error instanceof Error) return error.message || fallback;
    if (typeof error === "string") return error || fallback;

    if (typeof error === "object") {
      const maybeError = error as { message?: string; details?: string; hint?: string };
      const message = [maybeError.message, maybeError.details, maybeError.hint]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join(" ")
        .trim();
      if (message) return message;
    }

    return fallback;
  };

  const reportSyncWarning = (context: string, error: unknown) => {
    const message = getSubmitErrorMessage(error, "");
    console.warn(`${context} failed`, error);
    if (message) {
      toast.message("บันทึกสำเร็จ แต่ซิงค์ข้อมูลล่าสุดไม่ได้", {
        description: message,
        duration: 4500,
      });
    }
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

        try {
          // Return updated row from DB so UI maps against server-confirmed values.
          const updatedRow = await updateProductRecord(selectedProduct.id, productPayload);
          const normalizedProduct = normalizeProductRow(updatedRow as unknown as ProductRow, selectedProduct);
          setProducts((prev) =>
            prev.map((product) =>
              product.id === normalizedProduct.id ? { ...product, ...normalizedProduct } : product,
            ),
          );
          setSelectedProduct((prev) =>
            prev && prev.id === normalizedProduct.id ? { ...prev, ...normalizedProduct } : prev,
          );
        } catch (syncError) {
          reportSyncWarning("Post-update sync", syncError);
        }

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

      try {
        const { data: createdProduct, error: createdProductError } = await supabase
          .from("products")
          .select("id")
          .eq("p_id", productPayload.p_id)
          .maybeSingle();
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
      } catch (syncError) {
        reportSyncWarning("Post-create sync", syncError);
      }
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

      const message = getSubmitErrorMessage(error, "บันทึกสินค้าไม่สำเร็จ");
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
  const activeCategory = selectedCategoryId !== "all" ? categoryById.get(selectedCategoryId) ?? null : null;
  const selectedProductStockMeta = selectedProduct ? getStockMeta(selectedProduct) : null;

  const renderCategoryFilterOptions = (onSelected?: () => void) => (
    <div className="space-y-1">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
          selectedCategoryId === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
        )}
        aria-pressed={selectedCategoryId === "all"}
        onClick={() => {
          setSelectedCategoryId("all");
          onSelected?.();
        }}
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
        <span>ทั้งหมด</span>
      </button>

      {categoryOptions.map((category) => {
        const isSelected = selectedCategoryId === category.id;
        return (
          <button
            key={category.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
              isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
            )}
            aria-pressed={isSelected}
            onClick={() => {
              toggleCategory(category.id);
              onSelected?.();
            }}
          >
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border",
                isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground",
              )}
            >
              {isSelected && <Check className="h-3 w-3" />}
            </div>
            <span className="truncate">{getCategoryLabel(category)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <MainLayout title="สินค้า/ทรัพย์สิน (Products)">
      <div className="users-page-enter space-y-4 sm:space-y-6 [font-family:var(--font-admin)]">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาสินค้า เช่น AIO Dell, IT-001"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-xl pl-9 pr-9"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              {isPhone ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1 rounded-xl border-dashed"
                  onClick={() => setIsFilterDrawerOpen(true)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  ตัวกรอง
                  {selectedCategoryId !== "all" ? (
                    <Badge variant="secondary" className="ml-2 h-5 rounded-sm px-1.5">1</Badge>
                  ) : null}
                </Button>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-10 rounded-xl border-dashed">
                      <Filter className="mr-2 h-4 w-4" />
                      ตัวกรอง
                      {selectedCategoryId !== "all" ? (
                        <Badge variant="secondary" className="ml-2 h-5 rounded-sm px-1.5">1</Badge>
                      ) : null}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="end">
                    <div className="p-4 pb-2 text-sm font-semibold">หมวดหมู่สินค้า</div>
                    <Separator />
                    <ScrollArea className="h-[320px] px-2 py-2">
                      {renderCategoryFilterOptions()}
                    </ScrollArea>
                    <Separator />
                    <div className="p-2">
                      <Button type="button" variant="ghost" className="h-9 w-full text-xs" onClick={clearFilters}>
                        ล้างตัวกรอง
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <Button type="button" variant="outline" className="h-10 flex-1 rounded-xl sm:flex-none" onClick={() => setIsImportDialogOpen(true)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button type="button" className="h-10 flex-1 rounded-xl sm:flex-none" onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มสินค้า
              </Button>
            </div>
          </div>

          {isFetching && !isLoading ? (
            <div className="mt-3 text-xs text-muted-foreground">กำลังโหลดข้อมูล...</div>
          ) : null}

          {activeCategory || searchQuery ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">ตัวกรองที่ใช้งาน:</span>
              {activeCategory ? (
                <Badge variant="secondary" className="gap-1 rounded-full pr-1.5">
                  {getCategoryLabel(activeCategory)}
                  <button type="button" onClick={() => setSelectedCategoryId("all")} className="rounded-full p-0.5 hover:bg-muted">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null}
              {searchQuery ? (
                <Badge variant="secondary" className="gap-1 rounded-full pr-1.5">
                  ค้นหา: {searchQuery}
                  <button type="button" onClick={() => setSearchQuery("")} className="rounded-full p-0.5 hover:bg-muted">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null}
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
                ล้างตัวกรอง
              </Button>
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <Card key={index} className="overflow-hidden rounded-2xl border border-border/70 bg-card/90">
                <Skeleton className="aspect-[4/3] w-full" />
                <CardContent className="space-y-3 p-4">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {products.map((product) => {
                const categoryMeta = getProductCategoryMeta(product);
                const stockMeta = getStockMeta(product);
                return (
                  <Card
                    key={product.id}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <button
                      type="button"
                      className="relative aspect-[4/3] overflow-hidden bg-muted/20"
                      onClick={() => openViewDialog(product)}
                      aria-label={`View product ${product.name}`}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                            event.currentTarget.parentElement?.classList.add("bg-muted/30");
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Box className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
                        SKU: {product.p_id}
                      </span>
                    </button>

                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="secondary" className="max-w-[calc(100%-2rem)] truncate rounded-full px-2.5 py-1 text-[11px]">
                          {categoryMeta.name}
                          {categoryMeta.code ? ` (${categoryMeta.code})` : ""}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={(event) => event.stopPropagation()}
                              aria-label="Product actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(event) => { event.stopPropagation(); openViewDialog(product); }}>
                              <Eye className="mr-2 h-4 w-4" /> ดูรายละเอียด
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(event) => { event.stopPropagation(); openEditDialog(product); }}>
                              <Pencil className="mr-2 h-4 w-4" /> แก้ไข
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (confirm("ยืนยันการลบสินค้านี้ใช่หรือไม่?")) {
                                  deleteProduct.mutate(product.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> ลบ
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <h3 className="line-clamp-2 min-h-[2.8rem] text-[15px] font-semibold leading-snug" title={product.name}>
                        {product.name}
                      </h3>

                      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">ยี่ห้อ</dt>
                        <dd className="truncate font-medium text-foreground">{product.brand || "-"}</dd>
                        <dt className="text-muted-foreground">รุ่น</dt>
                        <dd className="truncate font-medium text-foreground">{product.model || "-"}</dd>
                      </dl>

                      <div className="mt-auto space-y-2 border-t border-dashed pt-2.5">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[11px] text-muted-foreground">ราคา</p>
                            <p className="text-base font-bold text-orange-600">{formatCurrency(product.price).replace(".00", "")}</p>
                          </div>
                          <Badge variant="outline" className={cn("h-7 rounded-full px-2.5 text-[11px] font-medium", stockMeta.className)}>
                            {stockMeta.label}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl transition-all active:scale-[0.98]" onClick={() => openViewDialog(product)}>
                            ดูรายละเอียด
                          </Button>
                          <Button type="button" size="sm" className="h-9 rounded-xl transition-all active:scale-[0.98]" onClick={() => openEditDialog(product)}>
                            แก้ไข
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {totalPages > 1 ? (
              <div className="mt-8 flex justify-center pb-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage((p) => p - 1); }}
                        className={cn("h-9 w-9 p-0 sm:w-auto sm:px-4", currentPage === 1 ? "pointer-events-none opacity-50" : "")}
                      />
                    </PaginationItem>
                    <div className="flex items-center px-4 text-xs font-medium text-muted-foreground sm:hidden">
                      {currentPage} / {totalPages}
                    </div>
                    <div className="hidden items-center gap-1 sm:flex">
                      {getPaginationItems().map((page, index) => {
                        if (page === "ellipsis") return <PaginationItem key={`el-${index}`}><PaginationEllipsis /></PaginationItem>;
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === page}
                              onClick={(e) => { e.preventDefault(); setCurrentPage(page as number); }}
                              className="h-9 w-9 cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                    </div>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage((p) => p + 1); }}
                        className={cn("h-9 w-9 p-0 sm:w-auto sm:px-4", currentPage === totalPages ? "pointer-events-none opacity-50" : "")}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/25 py-24 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Search className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">ไม่พบข้อมูลสินค้า</h3>
            <p className="mt-1 text-sm text-muted-foreground">ลองค้นหาด้วยคำอื่น หรือเคลียร์ตัวกรอง</p>
            {searchQuery || selectedCategoryId !== "all" ? (
              <Button variant="outline" className="mt-4 rounded-xl" onClick={clearFilters}>
                ล้างตัวกรอง
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <DrawerContent className="max-h-[80vh] rounded-t-2xl">
          <DrawerHeader>
            <DrawerTitle>ตัวกรองสินค้า</DrawerTitle>
            <DrawerDescription>เลือกหมวดหมู่เพื่อจำกัดผลการค้นหา</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="max-h-[50vh] px-4">
            {renderCategoryFilterOptions(() => setIsFilterDrawerOpen(false))}
          </ScrollArea>
          <DrawerFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={clearFilters}>
              ล้างตัวกรอง
            </Button>
            <Button type="button" className="rounded-xl" onClick={() => setIsFilterDrawerOpen(false)}>
              เสร็จสิ้น
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="h-[100dvh] w-[100vw] max-w-none gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:w-[96vw] sm:max-w-5xl sm:rounded-2xl">
          {selectedProduct ? (
            <>
              <DialogHeader className="border-b px-4 py-4 sm:px-6">
                <DialogTitle className="pr-10 text-xl font-semibold">{selectedProduct.name}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  รายละเอียดสินค้า ประวัติ และสถานะล่าสุด
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
                <div className="border-b px-4 py-3 sm:px-6">
                  <TabsList className="grid w-full max-w-[280px] grid-cols-2">
                    <TabsTrigger value="details">รายละเอียด</TabsTrigger>
                    <TabsTrigger value="history">ประวัติ</TabsTrigger>
                  </TabsList>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                  <TabsContent value="details" className="mt-0 space-y-4 data-[state=active]:animate-in data-[state=active]:fade-in-50">
                    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                      <button
                        type="button"
                        className="group relative overflow-hidden rounded-2xl border bg-muted/20 p-3 text-left"
                        onClick={() => openImageZoom(selectedProduct.image_url)}
                        aria-label="Zoom product image"
                      >
                        {selectedProduct.image_url ? (
                          <img
                            src={selectedProduct.image_url}
                            alt={selectedProduct.name}
                            className="h-[240px] w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.02] sm:h-[300px]"
                          />
                        ) : (
                          <div className="flex h-[240px] w-full items-center justify-center rounded-xl bg-muted sm:h-[300px]">
                            <Package className="h-12 w-12 text-muted-foreground/40" />
                          </div>
                        )}
                        <span className="mt-3 block text-xs text-muted-foreground">
                          แตะหรือคลิกที่รูปเพื่อขยาย
                        </span>
                      </button>

                      <div className="space-y-4">
                        <div className="rounded-2xl border bg-card p-4 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="rounded-full px-3 py-1">
                              {selectedProductCategoryMeta?.name ?? "-"}
                              {selectedProductCategoryMeta?.code ? ` (${selectedProductCategoryMeta.code})` : ""}
                            </Badge>
                            <Badge variant="outline" className="rounded-full px-3 py-1 font-mono">
                              SKU: {selectedProduct.p_id}
                            </Badge>
                          </div>
                          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                              <dt className="text-xs text-muted-foreground">ยี่ห้อ</dt>
                              <dd className="font-medium">{selectedProduct.brand || "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">รุ่น</dt>
                              <dd className="font-medium">{selectedProduct.model || "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">ราคาต่อหน่วย</dt>
                              <dd className="font-semibold text-orange-600">{formatCurrency(selectedProduct.price)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">จำนวนคงเหลือ</dt>
                              <dd>
                                {selectedProductStockMeta ? (
                                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-xs", selectedProductStockMeta.className)}>
                                    {selectedProductStockMeta.label}
                                  </Badge>
                                ) : (
                                  "-"
                                )}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">ราคา</p>
                            <p className="text-base font-semibold">{formatCurrency(selectedProduct.price).replace(".00", "")}</p>
                          </div>
                          <div className="rounded-xl border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">พร้อมใช้</p>
                            <p className="text-base font-semibold">{selectedProduct.stock_available ?? 0}</p>
                          </div>
                          <div className="rounded-xl border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">อัปเดตล่าสุด</p>
                            <p className="text-base font-semibold">
                              {selectedProduct.updated_at
                                ? format(new Date(selectedProduct.updated_at), "d MMM yyyy HH:mm", { locale: th })
                                : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border bg-card p-4">
                        <p className="mb-2 text-sm font-semibold">รายละเอียด</p>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {selectedProduct.description || "-"}
                        </p>
                      </div>
                      <div className="rounded-2xl border bg-card p-4">
                        <p className="mb-2 text-sm font-semibold">หมายเหตุ</p>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {selectedProduct.notes || "-"}
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-50">
                    <ProductHistory productId={selectedProduct.id} />
                  </TabsContent>
                </div>
              </Tabs>

              <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  ปิด
                </Button>
                <Button
                  onClick={() => {
                    setIsViewDialogOpen(false);
                    openEditDialog(selectedProduct);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  แก้ไขข้อมูล
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="h-[100dvh] w-[100vw] max-w-none gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:w-[96vw] sm:max-w-3xl sm:rounded-2xl">
          <DialogHeader className="border-b px-4 py-4 sm:px-6">
            <DialogTitle>{isEditing ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</DialogTitle>
            <DialogDescription>
              จัดการข้อมูลสินค้า ภาพ และจำนวนคงคลังได้จากฟอร์มเดียว
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
              <section className="space-y-3 rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold">ข้อมูลหลัก</h3>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor="category" className="text-xs text-muted-foreground">
                      หมวดหมู่
                    </Label>
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
                    {formErrors.category_id ? (
                      <p className="text-xs text-rose-600">{formErrors.category_id}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5 sm:w-[240px]">
                    <Label htmlFor="p_id" className="text-xs text-muted-foreground">
                      SKU
                    </Label>
                    <div className="flex gap-2">
                      <Input id="p_id" value={formData.p_id} readOnly className="bg-muted font-mono" placeholder="รหัสอัตโนมัติ" />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void applyGeneratedSku(formData.category_id, { force: true })}
                        disabled={!formData.category_id || isGeneratingSku}
                      >
                        {isGeneratingSku ? "กำลังสร้าง..." : "Regenerate"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs text-muted-foreground">
                    ชื่อสินค้า <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="เช่น Notebook, Printer, AIO"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="brand" className="text-xs text-muted-foreground">
                      ยี่ห้อ
                    </Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
                      placeholder="เช่น HP, Logitech"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="model" className="text-xs text-muted-foreground">
                      รุ่น (Model)
                    </Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                      placeholder="เช่น MOFYUO, EDF200120"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold">สต็อกและราคา</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="price" className="text-xs text-muted-foreground">
                      ราคา
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="initial_quantity" className="text-xs text-muted-foreground">
                      {isEditing ? "จำนวน" : "จำนวนเริ่มต้น"}
                    </Label>
                    <Input
                      id="initial_quantity"
                      type="number"
                      min="0"
                      value={formData.initial_quantity}
                      onChange={(e) => setFormData((prev) => ({ ...prev, initial_quantity: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unit" className="text-xs text-muted-foreground">
                      หน่วย
                    </Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                      placeholder="เช่น ชิ้น, เครื่อง"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold">รายละเอียดเพิ่มเติม</h3>
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs text-muted-foreground">
                    รายละเอียด
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="resize-none"
                    placeholder="เช่น RAM 8 GB, RTX 5090"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs text-muted-foreground">
                    หมายเหตุ (ภายใน)
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="resize-none"
                    placeholder="บันทึกภายในทีม..."
                  />
                </div>
              </section>

              <section className="space-y-3 rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold">รูปภาพสินค้า</h3>
                <div
                  className={cn(
                    "relative rounded-xl border-2 border-dashed bg-muted/20 p-4 transition-colors",
                    isImageDragActive ? "border-primary bg-primary/5" : "border-border",
                  )}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsImageDragActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsImageDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsImageDragActive(false);
                  }}
                  onDrop={handleImageDrop}
                >
                  <Input
                    id="product-image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                  {formData.image_url ? (
                    <button
                      type="button"
                      className="group relative w-full overflow-hidden rounded-lg border bg-card"
                      onClick={() => openImageZoom(formData.image_url)}
                    >
                      <img src={formData.image_url} alt={formData.name || "Product image"} className="h-64 w-full object-cover sm:h-72" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                        คลิกเพื่อขยายภาพ
                      </div>
                    </button>
                  ) : (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border bg-card px-4 py-10 text-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">ลากและวางรูปภาพที่นี่</p>
                      <p className="text-xs text-muted-foreground">หรือเลือกไฟล์จากเครื่องของคุณ</p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" disabled={isUploading} asChild>
                      <label htmlFor="product-image-upload" className="cursor-pointer">
                        {isUploading ? "กำลังอัปโหลด..." : "อัปโหลด / เปลี่ยนรูป"}
                      </label>
                    </Button>
                    {formData.image_url ? (
                      <Button type="button" variant="ghost" onClick={() => setFormData((prev) => ({ ...prev, image_url: "" }))}>
                        ลบรูป
                      </Button>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSaving || isGeneratingSku || isUploading} className="min-w-[120px]">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังอัปโหลด...
                  </>
                ) : (
                  "บันทึก"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImageZoomOpen}
        onOpenChange={(open) => {
          setIsImageZoomOpen(open);
          if (!open) setZoomImageUrl(null);
        }}
      >
        <DialogContent className="h-[95vh] w-[95vw] max-w-none border-none bg-black/95 p-4 [&>button]:hidden">
          <button
            type="button"
            onClick={() => {
              setIsImageZoomOpen(false);
              setZoomImageUrl(null);
            }}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/30"
            aria-label="Close image preview"
          >
            <X className="h-5 w-5" />
          </button>
          {zoomImageUrl ? (
            <div className="flex h-full w-full items-center justify-center">
              <img src={zoomImageUrl} alt={formData.name || "Product image"} className="h-full w-full object-contain" />
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
