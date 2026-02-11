
/**
 * Refactor Summary (System Settings / Master Data)
 * - Rebuilt layout for mobile/tablet/desktop with sticky segmented tabs and clearer hierarchy.
 * - Added reusable components: SegmentedTabs, mobile form drawer, confirm dialog, empty/skeleton states.
 * - Improved CRUD UX: debounced search, sorting, loading/submit states, and friendly RLS messages.
 * - Simplified Categories as a flat master list for faster admin workflows.
 */

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  Loader2,
  MapPin,
  MoreHorizontal,
  PencilLine,
  Plus,
  Search,
  Tags,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { MasterDataConfirmDialog } from "@/components/master-data/MasterDataConfirmDialog";
import { MasterDataEmptyState } from "@/components/master-data/MasterDataEmptyState";
import { MasterDataFormDrawer } from "@/components/master-data/MasterDataFormDrawer";
import { MasterDataCardSkeleton, MasterDataTableSkeleton } from "@/components/master-data/MasterDataSkeleton";
import { SegmentedTabs, type SegmentedTabItem } from "@/components/master-data/SegmentedTabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useCreateCategory,
  useCreateDepartment,
  useCreateLocation,
  useDeleteCategory,
  useDeleteDepartment,
  useDeleteLocation,
  useDepartments,
  useEmployees,
  useLocations,
  useUpdateCategory,
  useUpdateDepartment,
  useUpdateLocation,
  type Category,
  type Department,
  type Location,
} from "@/hooks/useMasterData";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type MasterTab = "departments" | "locations" | "categories";
type SortMode = "name-asc" | "name-desc" | "recent-desc";

type DeleteTarget = {
  id: string;
  name: string;
  type: MasterTab;
  warning?: string | null;
};

type SupabaseErrorLike = { message?: string; code?: string | null; status?: number };

const TAB_ITEMS: SegmentedTabItem[] = [
  { value: "departments", label: "แผนก" },
  { value: "locations", label: "สถานที่" },
  { value: "categories", label: "หมวดหมู่" },
];

const SORT_OPTIONS = [
  { value: "name-asc", label: "ชื่อ (A-Z)" },
  { value: "name-desc", label: "ชื่อ (Z-A)" },
  { value: "recent-desc", label: "อัปเดตล่าสุด" },
] as const;

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
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

const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase();

const parseDate = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortByMode = <T,>(
  list: T[],
  mode: SortMode,
  getName: (item: T) => string,
  getDate: (item: T) => string | null | undefined,
) => {
  const sorted = [...list];
  sorted.sort((a, b) => {
    if (mode === "name-desc") return getName(b).localeCompare(getName(a), "th");
    if (mode === "recent-desc") return parseDate(getDate(b)) - parseDate(getDate(a));
    return getName(a).localeCompare(getName(b), "th");
  });
  return sorted;
};

const toFriendlyActionError = (error: unknown, action: "create" | "update" | "delete", entity: string) => {
  const raw = (error as SupabaseErrorLike | null) ?? {};
  const message = raw.message ?? "";
  const lower = message.toLowerCase();
  const permissionIssue =
    raw.status === 401 ||
    raw.status === 403 ||
    raw.code === "42501" ||
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized");

  if (permissionIssue) {
    const actionLabel = action === "create" ? "เพิ่ม" : action === "update" ? "แก้ไข" : "ลบ";
    return `ไม่มีสิทธิ์${actionLabel}ข้อมูล${entity} (Permission denied). กรุณาตรวจสอบสิทธิ์หรือ RLS policy`;
  }

  if (action === "delete" && (raw.code === "23503" || lower.includes("foreign key"))) {
    return `ลบ${entity}ไม่ได้ เนื่องจากมีข้อมูลที่เชื่อมโยงอยู่`;
  }

  if (message) return message;
  return action === "delete" ? `ลบ${entity}ไม่สำเร็จ` : `บันทึก${entity}ไม่สำเร็จ`;
};

const toFriendlyReadError = (error: unknown, entity: string) => {
  const raw = (error as SupabaseErrorLike | null) ?? {};
  const lower = (raw.message ?? "").toLowerCase();
  if (
    raw.status === 401 ||
    raw.status === 403 ||
    raw.code === "42501" ||
    lower.includes("row-level security") ||
    lower.includes("permission denied")
  ) {
    return `ไม่มีสิทธิ์ดูข้อมูล${entity} (Permission denied). กรุณาตรวจสอบสิทธิ์หรือ RLS policy`;
  }
  return raw.message || `โหลดข้อมูล${entity}ไม่สำเร็จ`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("th-TH");
};

function StatsCard({
  title,
  value,
  subtext,
  icon,
  isLoading,
}: {
  title: string;
  value: string | number;
  subtext: string;
  icon: ReactNode;
  isLoading: boolean;
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold leading-none">{isLoading ? "-" : value}</p>
          <p className="text-xs text-muted-foreground">{subtext}</p>
        </div>
        <div className="rounded-xl bg-orange-50 p-2 text-orange-600">{icon}</div>
      </CardContent>
    </Card>
  );
}

function ListErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <Button type="button" variant="outline" onClick={onRetry} className="h-10 rounded-xl">
        ลองอีกครั้ง
      </Button>
    </div>
  );
}

function DesktopActionButton({ label, onClick, icon, danger = false }: { label: string; onClick: () => void; icon: ReactNode; danger?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 rounded-xl", danger && "text-rose-600 hover:bg-rose-50 hover:text-rose-700")}
          onClick={onClick}
          aria-label={label}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
function MobileActionMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-xl" aria-label="จัดการรายการ">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl">
        <DropdownMenuItem onClick={onEdit}>แก้ไข</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-rose-600 focus:text-rose-700">
          ลบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const currentTab: MasterTab = tabParam === "locations" || tabParam === "categories" ? tabParam : "departments";
  const isPhone = useIsPhone();

  const { data: departments, isLoading: deptLoading, isError: deptError, error: deptErrorObj, refetch: refetchDepartments } = useDepartments();
  const { data: locations, isLoading: locationLoading, isError: locationError, error: locationErrorObj, refetch: refetchLocations } = useLocations();
  const { data: categories, isLoading: categoryLoading, isError: categoryError, error: categoryErrorObj, refetch: refetchCategories } = useCategoriesQuery();
  const { data: employees, isLoading: employeeLoading } = useEmployees();

  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [search, setSearch] = useState<Record<MasterTab, string>>({ departments: "", locations: "", categories: "" });
  const [sortMode, setSortMode] = useState<Record<MasterTab, SortMode>>({ departments: "name-asc", locations: "name-asc", categories: "name-asc" });

  const [departmentForm, setDepartmentForm] = useState({ id: "", name: "", code: "", note: "" });
  const [locationForm, setLocationForm] = useState({ id: "", name: "", building: "", note: "" });
  const [categoryForm, setCategoryForm] = useState({ id: "", name: "", code: "", note: "" });

  const [departmentErrorMessage, setDepartmentErrorMessage] = useState("");
  const [locationErrorMessage, setLocationErrorMessage] = useState("");
  const [categoryErrorMessage, setCategoryErrorMessage] = useState("");

  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const departmentNameRef = useRef<HTMLInputElement>(null);
  const locationNameRef = useRef<HTMLInputElement>(null);
  const categoryNameRef = useRef<HTMLInputElement>(null);

  const debouncedDepartmentSearch = useDebouncedValue(search.departments);
  const debouncedLocationSearch = useDebouncedValue(search.locations);
  const debouncedCategorySearch = useDebouncedValue(search.categories);

  useEffect(() => setMobileFormOpen(false), [currentTab]);
  useEffect(() => {
    if (!isPhone) setMobileFormOpen(false);
  }, [isPhone]);

  const categoryList = useMemo(() => categories ?? [], [categories]);
  const primaryCategoryList = useMemo(
    () => categoryList.filter((category) => !category.parent_id),
    [categoryList],
  );

  const departmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    (employees ?? []).forEach((employee) => {
      if (employee.department_id) map.set(employee.department_id, (map.get(employee.department_id) ?? 0) + 1);
    });
    return map;
  }, [employees]);

  const locationCounts = useMemo(() => {
    const map = new Map<string, number>();
    (employees ?? []).forEach((employee) => {
      if (employee.location_id) map.set(employee.location_id, (map.get(employee.location_id) ?? 0) + 1);
    });
    return map;
  }, [employees]);


  const totalDepartments = departments?.length ?? 0;
  const totalLocations = locations?.length ?? 0;
  const totalCategories = primaryCategoryList.length;
  const totalEmployees = employees?.length ?? 0;
  const assignedEmployees = useMemo(() => (employees ?? []).filter((employee) => employee.department_id || employee.location_id).length, [employees]);

  const statsLoading = deptLoading || locationLoading || categoryLoading || employeeLoading;

  const filteredDepartments = useMemo(() => {
    const term = normalize(debouncedDepartmentSearch);
    const list = (departments ?? []).filter((department) => !term || normalize(department.name).includes(term) || normalize(department.code).includes(term));
    return sortByMode(list, sortMode.departments, (department) => department.name ?? "", (department) => department.created_at);
  }, [departments, debouncedDepartmentSearch, sortMode.departments]);

  const filteredLocations = useMemo(() => {
    const term = normalize(debouncedLocationSearch);
    const list = (locations ?? []).filter((location) => !term || normalize(location.name).includes(term) || normalize(location.building).includes(term));
    return sortByMode(list, sortMode.locations, (location) => location.name ?? "", (location) => location.created_at);
  }, [locations, debouncedLocationSearch, sortMode.locations]);

  const filteredCategories = useMemo(() => {
    const term = normalize(debouncedCategorySearch);
    const list = primaryCategoryList.filter((category) =>
      !term || normalize(category.name).includes(term) || normalize(category.code).includes(term),
    );
    return sortByMode(
      list,
      sortMode.categories,
      (category) => category.name ?? "",
      (category) => (category as { updated_at?: string | null }).updated_at ?? category.created_at,
    );
  }, [primaryCategoryList, debouncedCategorySearch, sortMode.categories]);

  const departmentSubmitting = createDepartment.isPending || updateDepartment.isPending;
  const locationSubmitting = createLocation.isPending || updateLocation.isPending;
  const categorySubmitting = createCategory.isPending || updateCategory.isPending;
  const isDeleting = deleteDepartment.isPending || deleteLocation.isPending || deleteCategory.isPending;

  const resetDepartmentForm = () => {
    setDepartmentForm({ id: "", name: "", code: "", note: "" });
    setDepartmentErrorMessage("");
  };

  const resetLocationForm = () => {
    setLocationForm({ id: "", name: "", building: "", note: "" });
    setLocationErrorMessage("");
  };

  const resetCategoryForm = () => {
    setCategoryForm({ id: "", name: "", code: "", note: "" });
    setCategoryErrorMessage("");
  };

  const focusCurrentForm = () => {
    const target = currentTab === "departments" ? departmentNameRef : currentTab === "locations" ? locationNameRef : categoryNameRef;
    window.setTimeout(() => target.current?.focus(), 50);
  };

  const openCreateFormForActiveTab = () => {
    if (currentTab === "departments") resetDepartmentForm();
    if (currentTab === "locations") resetLocationForm();
    if (currentTab === "categories") resetCategoryForm();
    if (isPhone) {
      setMobileFormOpen(true);
      return;
    }
    focusCurrentForm();
  };

  const editDepartment = (department: Department) => {
    setDepartmentForm({ id: department.id, name: department.name ?? "", code: department.code ?? "", note: department.note ?? "" });
    setDepartmentErrorMessage("");
    if (isPhone) return setMobileFormOpen(true);
    focusCurrentForm();
  };

  const editLocation = (location: Location) => {
    setLocationForm({ id: location.id, name: location.name ?? "", building: location.building ?? "", note: location.note ?? "" });
    setLocationErrorMessage("");
    if (isPhone) return setMobileFormOpen(true);
    focusCurrentForm();
  };

  const editCategory = (category: Category) => {
    setCategoryForm({ id: category.id, name: category.name ?? "", code: (category.code ?? "").toUpperCase(), note: category.note ?? "" });
    setCategoryErrorMessage("");
    if (isPhone) return setMobileFormOpen(true);
    focusCurrentForm();
  };

  const isDepartmentDuplicate = (name: string, id?: string) => (departments ?? []).some((department) => normalize(department.name) === normalize(name) && department.id !== id);
  const isLocationDuplicate = (name: string, id?: string) => (locations ?? []).some((location) => normalize(location.name) === normalize(name) && location.id !== id);

  const getCategoryConflict = (name: string, code: string, id?: string) => {
    const duplicateName = categoryList.some((category) => normalize(category.name) === normalize(name) && category.id !== id);
    if (duplicateName) return "มีชื่อหมวดหมู่นี้อยู่แล้ว";
    const duplicateCode = categoryList.some((category) => normalize(category.code) === normalize(code) && category.id !== id);
    if (duplicateCode) return "มีโค้ดหมวดหมู่นี้อยู่แล้ว";
    return "";
  };
  const handleDepartmentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = departmentForm.name.trim();
    if (!name) return setDepartmentErrorMessage("กรุณากรอกชื่อแผนก");
    if (isDepartmentDuplicate(name, departmentForm.id || undefined)) return setDepartmentErrorMessage("มีชื่อแผนกนี้อยู่แล้ว");

    const payload = { name, code: departmentForm.code.trim() || null, note: departmentForm.note.trim() || null };
    try {
      if (departmentForm.id) await updateDepartment.mutateAsync({ id: departmentForm.id, ...payload });
      else await createDepartment.mutateAsync(payload);
      resetDepartmentForm();
      if (isPhone) setMobileFormOpen(false);
    } catch (error) {
      const message = toFriendlyActionError(error, departmentForm.id ? "update" : "create", "แผนก");
      setDepartmentErrorMessage(message);
      toast.error(message);
    }
  };

  const handleLocationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = locationForm.name.trim();
    if (!name) return setLocationErrorMessage("กรุณากรอกชื่อสถานที่");
    if (isLocationDuplicate(name, locationForm.id || undefined)) return setLocationErrorMessage("มีชื่อสถานที่นี้อยู่แล้ว");

    const payload = { name, building: locationForm.building.trim() || null, note: locationForm.note.trim() || null };
    try {
      if (locationForm.id) await updateLocation.mutateAsync({ id: locationForm.id, ...payload });
      else await createLocation.mutateAsync(payload);
      resetLocationForm();
      if (isPhone) setMobileFormOpen(false);
    } catch (error) {
      const message = toFriendlyActionError(error, locationForm.id ? "update" : "create", "สถานที่");
      setLocationErrorMessage(message);
      toast.error(message);
    }
  };

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = categoryForm.name.trim();
    const code = categoryForm.code.trim().toUpperCase();

    if (!name) return setCategoryErrorMessage("กรุณากรอกชื่อหมวดหมู่");
    if (!/^[A-Z0-9]{2,3}$/.test(code)) return setCategoryErrorMessage("โค้ดหมวดหมู่ใช้ได้เฉพาะ A-Z และ 0-9 (2-3 ตัว)");

    const conflict = getCategoryConflict(name, code, categoryForm.id || undefined);
    if (conflict) return setCategoryErrorMessage(conflict);

    const payload = {
      name,
      code,
      note: categoryForm.note.trim() || null,
      parent_id: null,
      type: "main",
    };
    const previousCategoryName = categoryForm.id
      ? categoryList.find((category) => category.id === categoryForm.id)?.name ?? null
      : null;

    try {
      if (categoryForm.id) {
        await updateCategory.mutateAsync({ id: categoryForm.id, ...payload });
        const { error: linkedProductsError } = await supabase
          .from("products")
          .update({ category: payload.name })
          .eq("category_id", categoryForm.id);

        if (linkedProductsError) {
          toast.message("บันทึกหมวดหมู่แล้ว แต่ซิงค์ชื่อสินค้าบางส่วนไม่สำเร็จ", {
            description: linkedProductsError.message,
          });
        }

        if (previousCategoryName && previousCategoryName !== payload.name) {
          const { error: legacyProductsError } = await supabase
            .from("products")
            .update({ category: payload.name, category_id: categoryForm.id })
            .is("category_id", null)
            .eq("category", previousCategoryName);

          if (legacyProductsError) {
            toast.message("บันทึกหมวดหมู่แล้ว แต่ซิงค์สินค้าเดิมไม่สมบูรณ์", {
              description: legacyProductsError.message,
            });
          }
        }

        toast.success("อัปเดตหมวดหมู่สำเร็จ");
      } else {
        await createCategory.mutateAsync(payload);
        toast.success("เพิ่มหมวดหมู่สำเร็จ");
      }
      await refetchCategories();
      resetCategoryForm();
      if (isPhone) setMobileFormOpen(false);
    } catch (error) {
      const message = toFriendlyActionError(error, categoryForm.id ? "update" : "create", "หมวดหมู่");
      setCategoryErrorMessage(message);
      toast.error(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "departments") {
        await deleteDepartment.mutateAsync(deleteTarget.id);
        await refetchDepartments();
      }

      if (deleteTarget.type === "locations") {
        await deleteLocation.mutateAsync(deleteTarget.id);
        await refetchLocations();
      }

      if (deleteTarget.type === "categories") {
        const category = categoryList.find((item) => item.id === deleteTarget.id);
        if (!category) throw new Error("ไม่พบหมวดหมู่ที่ต้องการลบ");

        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("id")
          .eq("category_id", category.id)
          .limit(1);

        if (productsError) throw productsError;
        if ((products?.length ?? 0) > 0) throw new Error("หมวดหมู่นี้ถูกใช้งานอยู่ กรุณาย้ายสินค้าออกก่อนลบ");

        const { data: legacyProducts, error: legacyProductsError } = await supabase
          .from("products")
          .select("id")
          .is("category_id", null)
          .eq("category", category.name)
          .limit(1);

        if (legacyProductsError) throw legacyProductsError;
        if ((legacyProducts?.length ?? 0) > 0) throw new Error("หมวดหมู่นี้ถูกใช้งานอยู่ กรุณาย้ายสินค้าออกก่อนลบ");

        await deleteCategory.mutateAsync(category.id);
        await refetchCategories();
        toast.success("ลบหมวดหมู่สำเร็จ");
      }

      setDeleteTarget(null);
    } catch (error) {
      const entity = deleteTarget.type === "departments" ? "แผนก" : deleteTarget.type === "locations" ? "สถานที่" : "หมวดหมู่";
      toast.error(toFriendlyActionError(error, "delete", entity));
    }
  };

  const activeLabel = currentTab === "departments" ? "แผนก" : currentTab === "locations" ? "สถานที่" : "หมวดหมู่";
  const activeFormTitle = currentTab === "departments" ? (departmentForm.id ? "แก้ไขแผนก" : "เพิ่มแผนก") : currentTab === "locations" ? (locationForm.id ? "แก้ไขสถานที่" : "เพิ่มสถานที่") : categoryForm.id ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่";

  const DepartmentForm = () => (
    <form onSubmit={handleDepartmentSubmit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="department-name">ชื่อแผนก *</Label><Input id="department-name" ref={departmentNameRef} value={departmentForm.name} onChange={(e) => { setDepartmentForm((p) => ({ ...p, name: e.target.value })); setDepartmentErrorMessage(""); }} className="h-11 rounded-xl" required /></div>
      <div className="space-y-2"><Label htmlFor="department-code">โค้ดแผนก</Label><Input id="department-code" value={departmentForm.code} onChange={(e) => { setDepartmentForm((p) => ({ ...p, code: e.target.value })); setDepartmentErrorMessage(""); }} className="h-11 rounded-xl" /></div>
      <div className="space-y-2"><Label htmlFor="department-note">หมายเหตุ</Label><Textarea id="department-note" value={departmentForm.note} onChange={(e) => { setDepartmentForm((p) => ({ ...p, note: e.target.value })); setDepartmentErrorMessage(""); }} className="min-h-[96px] rounded-xl" /></div>
      {departmentErrorMessage ? <p className="text-xs text-rose-600">{departmentErrorMessage}</p> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={departmentSubmitting} className="h-11 flex-1 rounded-xl">{departmentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{departmentForm.id ? "บันทึกการแก้ไข" : "เพิ่มแผนก"}</Button>{departmentForm.id ? <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={resetDepartmentForm}>ยกเลิก</Button> : null}</div>
    </form>
  );

  const LocationForm = () => (
    <form onSubmit={handleLocationSubmit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="location-name">ชื่อสถานที่ *</Label><Input id="location-name" ref={locationNameRef} value={locationForm.name} onChange={(e) => { setLocationForm((p) => ({ ...p, name: e.target.value })); setLocationErrorMessage(""); }} className="h-11 rounded-xl" required /></div>
      <div className="space-y-2"><Label htmlFor="location-building">อาคาร/ชั้น</Label><Input id="location-building" value={locationForm.building} onChange={(e) => { setLocationForm((p) => ({ ...p, building: e.target.value })); setLocationErrorMessage(""); }} className="h-11 rounded-xl" /></div>
      <div className="space-y-2"><Label htmlFor="location-note">หมายเหตุ</Label><Textarea id="location-note" value={locationForm.note} onChange={(e) => { setLocationForm((p) => ({ ...p, note: e.target.value })); setLocationErrorMessage(""); }} className="min-h-[96px] rounded-xl" /></div>
      {locationErrorMessage ? <p className="text-xs text-rose-600">{locationErrorMessage}</p> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={locationSubmitting} className="h-11 flex-1 rounded-xl">{locationSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{locationForm.id ? "บันทึกการแก้ไข" : "เพิ่มสถานที่"}</Button>{locationForm.id ? <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={resetLocationForm}>ยกเลิก</Button> : null}</div>
    </form>
  );

  const CategoryForm = () => (
    <form onSubmit={handleCategorySubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category-name">หมวดหลัก *</Label>
        <Input
          id="category-name"
          ref={categoryNameRef}
          value={categoryForm.name}
          onChange={(e) => {
            setCategoryForm((p) => ({ ...p, name: e.target.value }));
            setCategoryErrorMessage("");
          }}
          className="h-11 rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-orange-300"
          placeholder="เช่น อุปกรณ์สำนักงาน"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category-code">โค้ดหมวดหมู่ *</Label>
        <Input
          id="category-code"
          value={categoryForm.code}
          onChange={(e) => {
            const next = e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 3);
            setCategoryForm((p) => ({ ...p, code: next }));
            setCategoryErrorMessage("");
          }}
          className="h-11 rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-orange-300"
          placeholder="เช่น IT"
          required
        />
        <p className="text-xs text-muted-foreground">รูปแบบโค้ด: A-Z/0-9 ความยาว 2-3 ตัวอักษร</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="category-note">หมายเหตุ</Label>
        <Textarea
          id="category-note"
          value={categoryForm.note}
          onChange={(e) => {
            setCategoryForm((p) => ({ ...p, note: e.target.value }));
            setCategoryErrorMessage("");
          }}
          className="min-h-[96px] rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-orange-300"
          placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
        />
      </div>
      {categoryErrorMessage ? <p className="text-xs text-rose-600">{categoryErrorMessage}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={categorySubmitting}
          className="h-11 flex-1 rounded-xl transition-all duration-200 hover:translate-y-[-1px]"
        >
          {categorySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {categoryForm.id ? "บันทึกการแก้ไข" : "เพิ่มหมวดหมู่"}
        </Button>
        {categoryForm.id ? (
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={resetCategoryForm}>
            ยกเลิก
          </Button>
        ) : null}
      </div>
    </form>
  );

  const renderSortSelect = (tab: MasterTab) => (
    <Select value={sortMode[tab]} onValueChange={(value) => setSortMode((p) => ({ ...p, [tab]: value as SortMode }))}>
      <SelectTrigger className="h-9 w-[148px] rounded-xl text-xs"><SelectValue placeholder="เรียงลำดับ" /></SelectTrigger>
      <SelectContent>{SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  );

  const basePageClass = "settings-page-enter space-y-5 sm:space-y-6 [font-family:var(--font-admin)]";
  return (
    <MainLayout>
      <div className={basePageClass}>
        <PageHeader
          title="System Settings"
          description="จัดการข้อมูล Master Data (แผนก สถานที่ หมวดหมู่) ได้จากหน้าจอเดียว"
          eyebrow={<div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Master Data</div>}
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Badge variant="outline" className="h-9 rounded-full px-3 text-xs">Admin Settings</Badge>
              <Button type="button" onClick={openCreateFormForActiveTab} className="h-10 w-full rounded-full px-4 sm:w-auto">
                <Plus className="h-4 w-4" /> เพิ่ม{activeLabel}
              </Button>
            </div>
          }
        />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatsCard title="Departments" value={totalDepartments} subtext="Active records" icon={<Building2 className="h-5 w-5" />} isLoading={statsLoading} />
          <StatsCard title="Locations" value={totalLocations} subtext="Active records" icon={<MapPin className="h-5 w-5" />} isLoading={statsLoading} />
          <StatsCard title="Categories" value={totalCategories} subtext="Active records" icon={<Tags className="h-5 w-5" />} isLoading={statsLoading} />
          <StatsCard title="Employees" value={totalEmployees} subtext={`${assignedEmployees} assigned`} icon={<Users className="h-5 w-5" />} isLoading={statsLoading} />
        </section>

        <Tabs value={currentTab} onValueChange={(value) => {
          if (value === "departments" || value === "locations" || value === "categories") {
            setSearchParams({ tab: value }, { replace: true });
          }
        }} className="space-y-4">
          <div className="sticky top-[4.1rem] z-20 -mx-1 rounded-xl bg-background/95 px-1 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
            <SegmentedTabs value={currentTab} onValueChange={(value) => {
              if (value === "departments" || value === "locations" || value === "categories") {
                setSearchParams({ tab: value }, { replace: true });
              }
            }} items={TAB_ITEMS} className="mx-auto max-w-3xl" />
          </div>

          <TabsContent value="departments" className="settings-tab-panel mt-0">
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
              <Card className="hidden border-border/70 shadow-sm sm:block"><CardHeader className="space-y-2 border-b border-border/70 bg-muted/20"><div className="flex items-center justify-between"><CardTitle className="text-lg">{departmentForm.id ? "แก้ไขแผนก" : "เพิ่มแผนก"}</CardTitle>{departmentForm.id ? <Badge variant="secondary">Editing</Badge> : null}</div><CardDescription>กำหนดชื่อ โค้ด และหมายเหตุของแผนก</CardDescription></CardHeader><CardContent className="pt-5"><DepartmentForm /></CardContent></Card>
              <Card className="border-border/70 shadow-sm"><CardHeader className="space-y-3 border-b border-border/70 bg-muted/20"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-lg">รายการแผนก</CardTitle><CardDescription>ค้นหา จัดเรียง และจัดการข้อมูล</CardDescription></div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{filteredDepartments.length} รายการ</Badge>{renderSortSelect("departments")}</div></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search.departments} onChange={(e) => setSearch((p) => ({ ...p, departments: e.target.value }))} placeholder="ค้นหาแผนก..." className="h-11 rounded-xl pl-9" /></div></CardHeader><CardContent className="p-0">
                {deptError ? <ListErrorBlock message={toFriendlyReadError(deptErrorObj, "แผนก")} onRetry={() => void refetchDepartments()} /> : deptLoading ? <><div className="hidden p-4 lg:block"><Table><TableHeader><TableRow><TableHead>ชื่อแผนก</TableHead><TableHead>โค้ด</TableHead><TableHead>ผู้ใช้</TableHead><TableHead className="text-right">จัดการ</TableHead></TableRow></TableHeader><MasterDataTableSkeleton rows={5} columns={4} /></Table></div><div className="lg:hidden"><MasterDataCardSkeleton rows={4} /></div></> : filteredDepartments.length === 0 ? <MasterDataEmptyState title="ไม่พบข้อมูลแผนก" description="เริ่มต้นเพิ่มแผนกแรกเพื่อจัดโครงสร้างทีม" actionLabel="เพิ่มแผนกใหม่" onAction={openCreateFormForActiveTab} /> : <>
                  <div className="hidden lg:block"><div className="max-h-[calc(100vh-20rem)] overflow-auto"><Table className="table-fixed"><TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead className="w-[46%]">ชื่อแผนก</TableHead><TableHead className="w-[18%]">โค้ด</TableHead><TableHead className="w-[18%]">ผู้ใช้</TableHead><TableHead className="w-[18%] text-right">จัดการ</TableHead></TableRow></TableHeader><TableBody>{filteredDepartments.map((department) => <TableRow key={department.id} className="settings-list-item hover:bg-orange-50/40"><TableCell><p className="break-words text-sm font-semibold" title={department.name ?? "-"}>{department.name || "-"}</p>{department.note ? <p className="line-clamp-2 text-xs text-muted-foreground" title={department.note}>{department.note}</p> : null}</TableCell><TableCell className="break-words whitespace-normal text-xs" title={department.code || "-"}>{department.code || "-"}</TableCell><TableCell className="text-xs text-muted-foreground">{departmentCounts.get(department.id) ?? 0} คน</TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-1"><DesktopActionButton label="แก้ไข" onClick={() => editDepartment(department)} icon={<PencilLine className="h-4 w-4" />} /><DesktopActionButton label="ลบ" onClick={() => setDeleteTarget({ id: department.id, name: department.name ?? "", type: "departments", warning: (departmentCounts.get(department.id) ?? 0) > 0 ? `แผนกนี้มีผู้ใช้ ${departmentCounts.get(department.id) ?? 0} คน อาจลบไม่สำเร็จหากยังมีการอ้างอิง` : "หากมีข้อมูลเชื่อมโยง ระบบจะไม่อนุญาตให้ลบ" })} icon={<Trash2 className="h-4 w-4" />} danger /></div></TableCell></TableRow>)}</TableBody></Table></div></div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2 lg:hidden">{filteredDepartments.map((department) => <article key={department.id} className="settings-list-item rounded-2xl border border-border/70 bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0 space-y-1"><p className="break-words text-sm font-semibold" title={department.name ?? "-"}>{department.name || "-"}</p>{department.note ? <p className="line-clamp-2 text-xs text-muted-foreground" title={department.note}>{department.note}</p> : null}</div><MobileActionMenu onEdit={() => editDepartment(department)} onDelete={() => setDeleteTarget({ id: department.id, name: department.name ?? "", type: "departments", warning: (departmentCounts.get(department.id) ?? 0) > 0 ? `แผนกนี้มีผู้ใช้ ${departmentCounts.get(department.id) ?? 0} คน อาจลบไม่สำเร็จหากยังมีการอ้างอิง` : "หากมีข้อมูลเชื่อมโยง ระบบจะไม่อนุญาตให้ลบ" })} /></div><div className="mt-3 grid gap-1 text-xs text-muted-foreground"><p>โค้ด: <span className="break-words text-foreground">{department.code || "-"}</span></p><p>ผู้ใช้ในแผนก: {departmentCounts.get(department.id) ?? 0} คน</p></div></article>)}</div>
                </>}
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="locations" className="settings-tab-panel mt-0">
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
              <Card className="hidden border-border/70 shadow-sm sm:block"><CardHeader className="space-y-2 border-b border-border/70 bg-muted/20"><div className="flex items-center justify-between"><CardTitle className="text-lg">{locationForm.id ? "แก้ไขสถานที่" : "เพิ่มสถานที่"}</CardTitle>{locationForm.id ? <Badge variant="secondary">Editing</Badge> : null}</div><CardDescription>กำหนดชื่อสถานที่ อาคาร/ชั้น และหมายเหตุ</CardDescription></CardHeader><CardContent className="pt-5"><LocationForm /></CardContent></Card>
              <Card className="border-border/70 shadow-sm"><CardHeader className="space-y-3 border-b border-border/70 bg-muted/20"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-lg">รายการสถานที่</CardTitle><CardDescription>ค้นหา จัดเรียง และจัดการข้อมูล</CardDescription></div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{filteredLocations.length} รายการ</Badge>{renderSortSelect("locations")}</div></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search.locations} onChange={(e) => setSearch((p) => ({ ...p, locations: e.target.value }))} placeholder="ค้นหาสถานที่..." className="h-11 rounded-xl pl-9" /></div></CardHeader><CardContent className="p-0">
                {locationError ? <ListErrorBlock message={toFriendlyReadError(locationErrorObj, "สถานที่")} onRetry={() => void refetchLocations()} /> : locationLoading ? <><div className="hidden p-4 lg:block"><Table><TableHeader><TableRow><TableHead>ชื่อสถานที่</TableHead><TableHead>อาคาร/ชั้น</TableHead><TableHead>ผู้ใช้</TableHead><TableHead className="text-right">จัดการ</TableHead></TableRow></TableHeader><MasterDataTableSkeleton rows={5} columns={4} /></Table></div><div className="lg:hidden"><MasterDataCardSkeleton rows={4} /></div></> : filteredLocations.length === 0 ? <MasterDataEmptyState title="ไม่พบข้อมูลสถานที่" description="เริ่มต้นเพิ่มสถานที่เพื่อจัดระเบียบพื้นที่ใช้งาน" actionLabel="เพิ่มสถานที่ใหม่" onAction={openCreateFormForActiveTab} /> : <><div className="hidden lg:block"><div className="max-h-[calc(100vh-20rem)] overflow-auto"><Table className="table-fixed"><TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead className="w-[44%]">ชื่อสถานที่</TableHead><TableHead className="w-[22%]">อาคาร/ชั้น</TableHead><TableHead className="w-[16%]">ผู้ใช้</TableHead><TableHead className="w-[18%] text-right">จัดการ</TableHead></TableRow></TableHeader><TableBody>{filteredLocations.map((location) => <TableRow key={location.id} className="settings-list-item hover:bg-orange-50/40"><TableCell><p className="break-words text-sm font-semibold" title={location.name ?? "-"}>{location.name || "-"}</p>{location.note ? <p className="line-clamp-2 text-xs text-muted-foreground" title={location.note}>{location.note}</p> : null}</TableCell><TableCell className="text-xs" title={location.building || "-"}>{location.building || "-"}</TableCell><TableCell className="text-xs text-muted-foreground">{locationCounts.get(location.id) ?? 0} คน</TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-1"><DesktopActionButton label="แก้ไข" onClick={() => editLocation(location)} icon={<PencilLine className="h-4 w-4" />} /><DesktopActionButton label="ลบ" onClick={() => setDeleteTarget({ id: location.id, name: location.name ?? "", type: "locations", warning: (locationCounts.get(location.id) ?? 0) > 0 ? `สถานที่นี้มีผู้ใช้ ${locationCounts.get(location.id) ?? 0} คน อาจลบไม่สำเร็จหากยังมีการอ้างอิง` : "หากมีข้อมูลเชื่อมโยง ระบบจะไม่อนุญาตให้ลบ" })} icon={<Trash2 className="h-4 w-4" />} danger /></div></TableCell></TableRow>)}</TableBody></Table></div></div><div className="grid gap-3 p-4 sm:grid-cols-2 lg:hidden">{filteredLocations.map((location) => <article key={location.id} className="settings-list-item rounded-2xl border border-border/70 bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0 space-y-1"><p className="break-words text-sm font-semibold" title={location.name ?? "-"}>{location.name || "-"}</p><p className="text-xs text-muted-foreground">อาคาร/ชั้น: {location.building || "-"}</p>{location.note ? <p className="line-clamp-2 text-xs text-muted-foreground" title={location.note}>{location.note}</p> : null}</div><MobileActionMenu onEdit={() => editLocation(location)} onDelete={() => setDeleteTarget({ id: location.id, name: location.name ?? "", type: "locations", warning: (locationCounts.get(location.id) ?? 0) > 0 ? `สถานที่นี้มีผู้ใช้ ${locationCounts.get(location.id) ?? 0} คน อาจลบไม่สำเร็จหากยังมีการอ้างอิง` : "หากมีข้อมูลเชื่อมโยง ระบบจะไม่อนุญาตให้ลบ" })} /></div><div className="mt-3 text-xs text-muted-foreground">ผู้ใช้ในสถานที่: {locationCounts.get(location.id) ?? 0} คน</div></article>)}</div></>}
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="settings-tab-panel mt-0">
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
              <Card className="hidden border-border/70 shadow-sm transition-all duration-200 hover:shadow-md sm:block">
                <CardHeader className="space-y-2 border-b border-border/70 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{categoryForm.id ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}</CardTitle>
                    {categoryForm.id ? <Badge variant="secondary">Editing</Badge> : null}
                  </div>
                  <CardDescription>กำหนดหมวดหลัก โค้ดหมวดหมู่ และหมายเหตุ</CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <CategoryForm />
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-sm transition-all duration-200 hover:shadow-md">
                <CardHeader className="space-y-3 border-b border-border/70 bg-muted/20">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">รายการหมวดหมู่</CardTitle>
                      <CardDescription>ค้นหา จัดเรียง และจัดการข้อมูล</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{filteredCategories.length} รายการ</Badge>
                      {renderSortSelect("categories")}
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search.categories}
                      onChange={(e) => setSearch((p) => ({ ...p, categories: e.target.value }))}
                      placeholder="ค้นหาหมวดหมู่..."
                      className="h-11 rounded-xl pl-9 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-orange-300"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {categoryError ? (
                    <ListErrorBlock message={toFriendlyReadError(categoryErrorObj, "หมวดหมู่")} onRetry={() => void refetchCategories()} />
                  ) : categoryLoading ? (
                    <>
                      <div className="hidden p-4 lg:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>หมวดหลัก</TableHead>
                              <TableHead>โค้ดหมวดหมู่</TableHead>
                              <TableHead>หมายเหตุ</TableHead>
                              <TableHead className="text-right">จัดการ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <MasterDataTableSkeleton rows={5} columns={4} />
                        </Table>
                      </div>
                      <div className="lg:hidden">
                        <MasterDataCardSkeleton rows={4} />
                      </div>
                    </>
                  ) : filteredCategories.length === 0 ? (
                    <MasterDataEmptyState
                      title="ไม่พบข้อมูลหมวดหมู่"
                      description="เพิ่มหมวดหลักเพื่อเริ่มต้นจัดกลุ่มสินค้า"
                      actionLabel="เพิ่มหมวดหมู่ใหม่"
                      onAction={openCreateFormForActiveTab}
                    />
                  ) : (
                    <>
                      <div className="hidden lg:block">
                        <div className="max-h-[calc(100vh-20rem)] overflow-auto">
                          <Table className="table-fixed">
                            <TableHeader className="sticky top-0 z-10 bg-card">
                              <TableRow>
                                <TableHead className="w-[34%]">หมวดหลัก</TableHead>
                                <TableHead className="w-[18%]">โค้ดหมวดหมู่</TableHead>
                                <TableHead className="w-[30%]">หมายเหตุ</TableHead>
                                <TableHead className="w-[18%] text-right">จัดการ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredCategories.map((category) => (
                                <TableRow key={category.id} className="settings-list-item transition-colors duration-200 hover:bg-orange-50/40">
                                  <TableCell>
                                    <p className="break-words text-sm font-semibold" title={category.name ?? "-"}>
                                      {category.name || "-"}
                                    </p>
                                  </TableCell>
                                  <TableCell className="break-words whitespace-normal text-xs">{(category.code || "-").toUpperCase()}</TableCell>
                                  <TableCell>
                                    <p className="line-clamp-2 text-xs text-muted-foreground" title={category.note || "-"}>
                                      {category.note || "-"}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <DesktopActionButton label="แก้ไข" onClick={() => editCategory(category)} icon={<PencilLine className="h-4 w-4" />} />
                                      <DesktopActionButton
                                        label="ลบ"
                                        onClick={() =>
                                          setDeleteTarget({
                                            id: category.id,
                                            name: category.name ?? "",
                                            type: "categories",
                                            warning: "หากหมวดหมู่นี้ถูกใช้งานโดยสินค้า ระบบจะไม่อนุญาตให้ลบ",
                                          })
                                        }
                                        icon={<Trash2 className="h-4 w-4" />}
                                        danger
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:hidden">
                        {filteredCategories.map((category) => (
                          <article key={category.id} className="settings-list-item rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <p className="break-words text-sm font-semibold">{category.name || "-"}</p>
                                <p className="text-xs text-muted-foreground">
                                  โค้ด: <span className="break-words text-foreground">{(category.code || "-").toUpperCase()}</span>
                                </p>
                                <p className="line-clamp-2 text-xs text-muted-foreground">{category.note || "-"}</p>
                              </div>
                              <MobileActionMenu
                                onEdit={() => editCategory(category)}
                                onDelete={() =>
                                  setDeleteTarget({
                                    id: category.id,
                                    name: category.name ?? "",
                                    type: "categories",
                                    warning: "หากหมวดหมู่นี้ถูกใช้งานโดยสินค้า ระบบจะไม่อนุญาตให้ลบ",
                                  })
                                }
                              />
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {isPhone && !mobileFormOpen ? <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-40 px-4"><Button type="button" onClick={openCreateFormForActiveTab} className="pointer-events-auto h-12 w-full rounded-full shadow-lg"><Plus className="h-4 w-4" /> เพิ่ม{activeLabel}</Button></div> : null}

      <MasterDataFormDrawer open={isPhone && mobileFormOpen} onOpenChange={setMobileFormOpen} title={activeFormTitle} description={`จัดการข้อมูล${activeLabel}`}>
        {currentTab === "departments" ? <DepartmentForm /> : null}
        {currentTab === "locations" ? <LocationForm /> : null}
        {currentTab === "categories" ? <CategoryForm /> : null}
      </MasterDataFormDrawer>

      <MasterDataConfirmDialog
        open={Boolean(deleteTarget)}
        title={`ลบ${deleteTarget?.type === "departments" ? "แผนก" : deleteTarget?.type === "locations" ? "สถานที่" : "หมวดหมู่"}?`}
        description="การลบข้อมูลไม่สามารถย้อนกลับได้"
        entityName={deleteTarget?.name || ""}
        warningMessage={deleteTarget?.warning || null}
        isLoading={isDeleting}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
      />
    </MainLayout>
  );
}
