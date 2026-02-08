
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/hooks/useMasterData";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { SafeDeleteDialog } from "@/components/master-data/SafeDeleteDialog";
import {
  Building2,
  MapPin,
  MoreHorizontal,
  Plus,
  Tags,
  Trash2,
  PencilLine,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable } from "@/components/shared/ResponsiveTable";

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const normalize = (value: string) => value.trim().toLowerCase();

const getErrorMessage = (error: unknown, fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่") =>
  error instanceof Error ? error.message : fallback;

const getLocationErrorMessage = (error: unknown, action: "create" | "update" | "delete") => {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return action === "delete"
      ? "คุณไม่มีสิทธิ์ลบสถานที่ กรุณาติดต่อผู้ดูแลระบบ"
      : "คุณไม่มีสิทธิ์เพิ่ม/แก้ไขสถานที่ กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (action === "delete" && message.includes("foreign key")) {
    return "ลบไม่ได้ เนื่องจากมีรายการใช้งานสถานที่นี้อยู่";
  }
  return "เกิดข้อผิดพลาดในการบันทึกสถานที่ กรุณาลองใหม่";
};

const getDepartmentErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "คุณไม่มีสิทธิ์ลบแผนก กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (message.includes("foreign key")) {
    return "ลบไม่ได้ เนื่องจากมีผู้ใช้อยู่ในแผนกนี้";
  }
  return getErrorMessage(error);
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("th-TH");
};

const TableSkeleton = ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => (
  <TableBody>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <TableRow key={`sk-${rowIndex}`}>
        {Array.from({ length: columns }).map((__, colIndex) => (
          <TableCell key={`sk-${rowIndex}-${colIndex}`}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </TableBody>
);

const ListErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
    <p className="text-sm text-destructive">{message}</p>
    <Button variant="outline" onClick={onRetry}>
      ลองอีกครั้ง
    </Button>
  </div>
);

const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) => (
  <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
    <div className="space-y-1">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <Button variant="outline" onClick={onAction}>
      {actionLabel}
    </Button>
  </div>
);

const ActionButton = ({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9"
        onClick={onClick}
        aria-label={label}
      >
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

const MobileActionMenu = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="เมนูจัดการ">
        <MoreHorizontal className="h-5 w-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-40">
      <DropdownMenuItem onClick={onEdit}>แก้ไข</DropdownMenuItem>
      <DropdownMenuItem
        onClick={onDelete}
        className="text-destructive focus:text-destructive"
      >
        ลบ
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const StackedSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="grid gap-3 p-4">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={`sk-${index}`} className="rounded-xl border border-border/60 bg-background p-4 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
);

const StatsCard = ({
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
}) => (
  <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-background via-background to-muted/40 shadow-sm">
    <CardContent className="flex items-center justify-between gap-4 p-4">
      <div className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </div>
        {isLoading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-semibold">{value}</div>}
        <div className="text-xs text-muted-foreground">{subtext}</div>
      </div>
      <div className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
    </CardContent>
  </Card>
);

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "departments";

  const {
    data: departments,
    isLoading: deptLoading,
    isError: deptError,
    error: deptErrorObj,
    refetch: refetchDepartments,
  } = useDepartments();
  const { data: employees, isLoading: empLoading } = useEmployees();
  const {
    data: locations,
    isLoading: locLoading,
    isError: locError,
    error: locErrorObj,
    refetch: refetchLocations,
  } = useLocations();
  const {
    data: categories,
    isLoading: catLoading,
    isError: catError,
    error: catErrorObj,
    refetch: refetchCategories,
  } = useCategoriesQuery();

  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();

  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  // Category delete is handled via a single confirm flow to reduce admin complexity.

  const [searchText, setSearchText] = useState({
    departments: "",
    locations: "",
    categories: "",
  });

  const debouncedDepartmentSearch = useDebouncedValue(searchText.departments);
  const debouncedLocationSearch = useDebouncedValue(searchText.locations);
  const debouncedCategorySearch = useDebouncedValue(searchText.categories);

  const [departmentForm, setDepartmentForm] = useState({
    id: "",
    name: "",
    code: "",
    note: "",
  });
  const [departmentError, setDepartmentError] = useState("");

  const [locationForm, setLocationForm] = useState({
    id: "",
    name: "",
    building: "",
    note: "",
  });
  const [locationError, setLocationError] = useState("");

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    code: "",
    note: "",
  });
  const [categoryError, setCategoryError] = useState("");

  const departmentNameRef = useRef<HTMLInputElement>(null);
  const locationNameRef = useRef<HTMLInputElement>(null);
  const categoryNameRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: "department" | "location" | "category";
  } | null>(null);

  const [categorySort, setCategorySort] = useState<"name-asc" | "name-desc" | "updated-desc" | "updated-asc">(
    "name-asc",
  );

  const departmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    (employees ?? []).forEach((emp) => {
      if (emp.department_id) {
        map.set(emp.department_id, (map.get(emp.department_id) ?? 0) + 1);
      }
    });
    return map;
  }, [employees]);

  const totalDepartments = departments?.length ?? 0;
  const totalLocations = locations?.length ?? 0;
  const totalCategories = categories?.length ?? 0;
  const totalEmployees = employees?.length ?? 0;
  const assignedEmployees = useMemo(
    () => (employees ?? []).filter((emp) => emp.department_id || emp.location_id).length,
    [employees],
  );
  const statsLoading = deptLoading || locLoading || catLoading || empLoading;

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const filteredDepartments = useMemo(() => {
    const term = normalize(debouncedDepartmentSearch);
    return (departments ?? []).filter((dept) =>
      !term ? true : normalize(dept.name ?? "").includes(term) || normalize(dept.code ?? "").includes(term),
    );
  }, [departments, debouncedDepartmentSearch]);

  const filteredLocations = useMemo(() => {
    const term = normalize(debouncedLocationSearch);
    return (locations ?? []).filter((loc) =>
      !term ? true : normalize(loc.name ?? "").includes(term) || normalize(loc.building ?? "").includes(term),
    );
  }, [locations, debouncedLocationSearch]);

  const categoryList = useMemo(() => categories ?? [], [categories]);

  const filteredCategories = useMemo(() => {
    const term = normalize(debouncedCategorySearch);
    if (!term) return categoryList;
    return categoryList.filter((cat) =>
      normalize(cat.name ?? "").includes(term) || normalize(cat.code ?? "").includes(term),
    );
  }, [categoryList, debouncedCategorySearch]);

  const sortedCategories = useMemo(() => {
    const list = [...filteredCategories];
    list.sort((a, b) => {
      if (categorySort === "name-desc") return (b.name ?? "").localeCompare(a.name ?? "");
      if (categorySort === "updated-desc")
        return new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      if (categorySort === "updated-asc")
        return new Date(a.updated_at ?? a.created_at ?? 0).getTime() - new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
    return list;
  }, [filteredCategories, categorySort]);
  const isDepartmentDuplicate = (name: string, id?: string) => {
    const normalized = normalize(name);
    return (departments ?? []).some(
      (dept) => normalize(dept.name ?? "") === normalized && dept.id !== id,
    );
  };

  const isLocationDuplicate = (name: string, id?: string) => {
    const normalized = normalize(name);
    return (locations ?? []).some(
      (loc) => normalize(loc.name ?? "") === normalized && loc.id !== id,
    );
  };

  const getCategoryConflict = (name: string, code: string, id?: string) => {
    const normalizedName = normalize(name);
    const normalizedCode = normalize(code);
    const nameDup = (categories ?? []).some(
      (cat) => normalize(cat.name ?? "") === normalizedName && cat.id !== id,
    );
    if (nameDup) return "มีชื่อหมวดหมู่นี้อยู่แล้ว";

    const codeDup = (categories ?? []).some(
      (cat) => normalize(cat.code ?? "") === normalizedCode && cat.id !== id,
    );
    if (codeDup) return "มีโค้ดนี้อยู่แล้ว";

    return "";
  };

  const resetDepartmentForm = () => {
    setDepartmentForm({ id: "", name: "", code: "", note: "" });
    setDepartmentError("");
  };

  const resetLocationForm = () => {
    setLocationForm({ id: "", name: "", building: "", note: "" });
    setLocationError("");
  };

  const resetCategoryForm = () => {
    setCategoryForm({ id: "", name: "", code: "", note: "" });
    setCategoryError("");
  };

  const buildCategoryMatchFilters = (name?: string | null, code?: string | null) => {
    const filters: string[] = [];
    const trimmedName = (name ?? "").trim();
    if (trimmedName) {
      filters.push(`category.eq.${trimmedName}`);
    }
    const trimmedCode = (code ?? "").trim().toUpperCase();
    if (trimmedCode) {
      filters.push(`category.ilike.%(${trimmedCode})%`);
    }
    return filters;
  };

  const syncCategoryProducts = async (params: {
    id: string;
    newName: string;
    newCode: string;
    previousName?: string | null;
    previousCode?: string | null;
  }) => {
    const { id, newName, newCode, previousName, previousCode } = params;
    const matchFilters = [
      ...buildCategoryMatchFilters(previousName, previousCode),
      ...buildCategoryMatchFilters(newName, newCode),
    ];
    const uniqueFilters = Array.from(new Set(matchFilters));

    if (uniqueFilters.length > 0) {
      const { error: backfillError } = await supabase
        .from("products")
        .update({ category_id: id, category: newName })
        .is("category_id", null)
        .or(uniqueFilters.join(","));

      if (backfillError) {
        console.error("Backfill product categories failed:", backfillError);
        toast.message("บันทึกหมวดหมู่แล้ว แต่ซิงค์สินค้าไม่สำเร็จ", {
          description: backfillError.message,
        });
      }
    }

    const { error: renameError } = await supabase
      .from("products")
      .update({ category: newName })
      .eq("category_id", id);

    if (renameError) {
      console.error("Update product category names failed:", renameError);
      toast.message("บันทึกหมวดหมู่แล้ว แต่ซิงค์ชื่อสินค้าไม่สำเร็จ", {
        description: renameError.message,
      });
    }
  };

  const handleDepartmentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = departmentForm.name.trim();
    if (!name) {
      setDepartmentError("กรุณากรอกชื่อแผนก");
      return;
    }
    if (isDepartmentDuplicate(name, departmentForm.id || undefined)) {
      setDepartmentError("มีชื่อแผนกนี้อยู่แล้ว");
      return;
    }
    const payload = {
      name,
      code: departmentForm.code.trim() || null,
      note: departmentForm.note.trim() || null,
    };
    try {
      if (departmentForm.id) {
        await updateDepartment.mutateAsync({ id: departmentForm.id, ...payload });
      } else {
        await createDepartment.mutateAsync(payload);
      }
      resetDepartmentForm();
    } catch (error) {
      // Fix: surface API errors inline so CRUD failures are visible beyond toast.
      setDepartmentError(getErrorMessage(error));
    }
  };

  const handleLocationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = locationForm.name.trim();
    if (!name) {
      setLocationError("กรุณากรอกชื่อสถานที่");
      return;
    }
    if (isLocationDuplicate(name, locationForm.id || undefined)) {
      setLocationError("มีชื่อสถานที่นี้อยู่แล้ว");
      return;
    }
    // Address column was missing in the schema cache; keep payload to known columns.
    const payload = {
      name,
      building: locationForm.building.trim() || null,
      note: locationForm.note.trim() || null,
    };
    try {
      if (locationForm.id) {
        await updateLocation.mutateAsync({ id: locationForm.id, ...payload });
      } else {
        await createLocation.mutateAsync(payload);
      }
      resetLocationForm();
    } catch (error) {
      setLocationError(getLocationErrorMessage(error, locationForm.id ? "update" : "create"));
    }
  };

  const handleCategorySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = categoryForm.name.trim();
    const code = categoryForm.code.trim().toUpperCase();
    if (!name) {
      setCategoryError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }
    if (!code) {
      setCategoryError("กรุณากรอกโค้ดหมวดหมู่");
      return;
    }
    if (code.length < 2 || code.length > 3) {
      setCategoryError("โค้ดหมวดหมู่ต้องมี 2-3 ตัวอักษร");
      return;
    }
    if (/\s/.test(code)) {
      setCategoryError("โค้ดหมวดหมู่ต้องไม่มีช่องว่าง");
      return;
    }
    if (!/^[A-Z0-9]{2,3}$/.test(code)) {
      setCategoryError("โค้ดหมวดหมู่ใช้ได้เฉพาะ A-Z และ 0-9 (2-3 ตัว)");
      return;
    }
    const conflictMessage = getCategoryConflict(name, code, categoryForm.id || undefined);
    if (conflictMessage) {
      setCategoryError(conflictMessage);
      return;
    }

    const payload: Partial<Category> & { name: string; code: string } = {
      name,
      code,
      note: categoryForm.note.trim() || null,
    };

    const previousCategory = categoryForm.id
      ? categories?.find((cat) => cat.id === categoryForm.id) ?? null
      : null;

    try {
      if (categoryForm.id) {
        await updateCategory.mutateAsync({
          id: categoryForm.id,
          ...payload,
          updated_at: new Date().toISOString(),
        });
        await syncCategoryProducts({
          id: categoryForm.id,
          newName: payload.name,
          newCode: payload.code,
          previousName: previousCategory?.name ?? null,
          previousCode: previousCategory?.code ?? null,
        });
        toast.success("อัปเดตหมวดหมู่สำเร็จ");
      } else {
        await createCategory.mutateAsync(payload);
        toast.success("เพิ่มหมวดหมู่สำเร็จ");
      }
      await refetchCategories();
      resetCategoryForm();
    } catch (error) {
      const rawMessage = getErrorMessage(error);
      const lower = rawMessage.toLowerCase();
      if (lower.includes("categories_code_key") || (lower.includes("duplicate") && lower.includes("code"))) {
        setCategoryError("โค้ดนี้มีอยู่แล้ว");
        toast.error("โค้ดนี้มีอยู่แล้ว");
        return;
      }
      if (lower.includes("categories_name_key") || (lower.includes("duplicate") && lower.includes("name"))) {
        setCategoryError("ชื่อหมวดหมู่นี้มีอยู่แล้ว");
        toast.error("ชื่อหมวดหมู่นี้มีอยู่แล้ว");
        return;
      }
      setCategoryError(rawMessage);
      toast.error(rawMessage);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "department") {
        await deleteDepartment.mutateAsync(deleteTarget.id);
        await refetchDepartments();
      } else if (deleteTarget.type === "location") {
        await deleteLocation.mutateAsync(deleteTarget.id);
      } else if (deleteTarget.type === "category") {
        const category = categories?.find((cat) => cat.id === deleteTarget.id);
        if (!category) return;

        const children = (categories ?? []).filter((cat) => cat.parent_id === category.id);
        if (children.length > 0) {
          toast.error("หมวดหมู่หลักนี้มีหมวดย่อยอยู่ กรุณาย้ายออกก่อนลบ");
          return;
        }

        const { data: usedByCategoryId, error: usedByCategoryIdError } = await supabase
          .from("products")
          .select("id")
          .eq("category_id", category.id)
          .limit(1);
        if (usedByCategoryIdError) throw usedByCategoryIdError;

        if ((usedByCategoryId?.length ?? 0) > 0) {
          toast.error("หมวดหมู่นี้ถูกใช้งานอยู่ กรุณาย้ายสินค้าออกก่อน");
          return;
        }

        await deleteCategory.mutateAsync(category.id);
        await refetchCategories();
        toast.success("ลบหมวดหมู่สำเร็จ");
      }
      setDeleteTarget(null);
    } catch (error) {
      if (deleteTarget?.type === "department") {
        toast.error(getDepartmentErrorMessage(error));
        return;
      }
      if (deleteTarget?.type === "location") {
        toast.error(getLocationErrorMessage(error, "delete"));
        return;
      }
      toast.error(getErrorMessage(error));
    }
  };

  const isDeleting =
    deleteDepartment.isPending || deleteLocation.isPending || deleteCategory.isPending;
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="System Settings"
          description="ดูภาพรวมและจัดการแผนก สถานที่ และหมวดหมู่ได้จากหน้าจอเดียว"
          eyebrow={
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Master Data
            </div>
          }
          actions={
            <Badge variant="outline" className="w-fit text-xs">
              Admin Settings
            </Badge>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Departments"
            value={totalDepartments}
            subtext="Active records"
            isLoading={statsLoading}
            icon={<Building2 className="h-5 w-5" />}
          />
          <StatsCard
            title="Locations"
            value={totalLocations}
            subtext="Active records"
            isLoading={statsLoading}
            icon={<MapPin className="h-5 w-5" />}
          />
          <StatsCard
            title="Categories"
            value={totalCategories}
            subtext="Active records"
            isLoading={statsLoading}
            icon={<Tags className="h-5 w-5" />}
          />
          <StatsCard
            title="Employees"
            value={totalEmployees}
            subtext={`${assignedEmployees} assigned`}
            isLoading={statsLoading}
            icon={<Users className="h-5 w-5" />}
          />
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-3 rounded-full border border-border/60 bg-muted/40 p-1.5">
            <TabsTrigger value="departments">แผนก</TabsTrigger>
            <TabsTrigger value="locations">สถานที่</TabsTrigger>
            <TabsTrigger value="categories">หมวดหมู่</TabsTrigger>
          </TabsList>

          <TabsContent value="departments" className="mt-0">
            <div className="grid items-start gap-6 lg:grid-cols-[420px_1fr] xl:grid-cols-[460px_1fr]">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="space-y-2 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" /> {departmentForm.id ? "แก้ไขแผนก" : "เพิ่มแผนก"}
                    </CardTitle>
                    {departmentForm.id && (
                      <Badge variant="secondary" className="text-xs">
                        Editing
                      </Badge>
                    )}
                  </div>
                  <CardDescription>บันทึกชื่อแผนก โค้ด และหมายเหตุสำหรับการใช้งานในระบบ</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleDepartmentSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="department-name">ชื่อแผนก</Label>
                      <Input
                        id="department-name"
                        ref={departmentNameRef}
                        value={departmentForm.name}
                        onChange={(e) => {
                          setDepartmentForm((prev) => ({ ...prev, name: e.target.value }));
                          setDepartmentError("");
                        }}
                        placeholder="ระบุชื่อแผนก"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department-code">โค้ดแผนก (ถ้ามี)</Label>
                      <Input
                        id="department-code"
                        value={departmentForm.code}
                        onChange={(e) => {
                          setDepartmentForm((prev) => ({ ...prev, code: e.target.value }));
                          setDepartmentError("");
                        }}
                        placeholder="เช่น HR"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department-note">หมายเหตุ</Label>
                      <Textarea
                        id="department-note"
                        value={departmentForm.note}
                        onChange={(e) => {
                          setDepartmentForm((prev) => ({ ...prev, note: e.target.value }));
                          setDepartmentError("");
                        }}
                        placeholder="รายละเอียดเพิ่มเติม"
                      />
                    </div>
                    {departmentError && <p className="text-xs text-rose-600">{departmentError}</p>}
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={createDepartment.isPending || updateDepartment.isPending}
                      >
                        <Plus className="h-4 w-4" />
                        {departmentForm.id ? "บันทึกการแก้ไข" : "เพิ่มแผนก"}
                      </Button>
                      {departmentForm.id && (
                        <Button type="button" variant="outline" onClick={resetDepartmentForm}>
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="space-y-3 border-b bg-muted/30">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">รายการแผนก</CardTitle>
                      <CardDescription>ค้นหาและจัดการข้อมูลแผนก</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {filteredDepartments.length} รายการ
                    </Badge>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchText.departments}
                      onChange={(e) => setSearchText((prev) => ({ ...prev, departments: e.target.value }))}
                      placeholder="ค้นหาแผนก..."
                      className="pl-9 h-11"
                      aria-label="ค้นหาแผนก"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveTable
                    table={
                      deptError ? (
                        <ListErrorState message={getErrorMessage(deptErrorObj)} onRetry={refetchDepartments} />
                      ) : deptLoading ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  ชื่อแผนก
                                </TableHead>
                                <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  โค้ด
                                </TableHead>
                                <TableHead className="w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  เมตา
                                </TableHead>
                                <TableHead className="text-right w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  จัดการ
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableSkeleton columns={4} />
                          </Table>
                        </div>
                      ) : filteredDepartments.length === 0 ? (
                        <EmptyState
                          title="ยังไม่มีแผนกในระบบ"
                          description="เริ่มต้นสร้างแผนกแรกได้จากแบบฟอร์มด้านซ้าย"
                          actionLabel="สร้างแผนกใหม่"
                          onAction={() => departmentNameRef.current?.focus()}
                        />
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  ชื่อแผนก
                                </TableHead>
                                <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  โค้ด
                                </TableHead>
                                <TableHead className="w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  เมตา
                                </TableHead>
                                <TableHead className="text-right w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  จัดการ
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredDepartments.map((dept) => (
                                <TableRow key={dept.id} className="hover:bg-muted/30">
                                  <TableCell>
                                    <div className="font-medium">{dept.name}</div>
                                    {dept.note && (
                                      <div className="text-xs text-muted-foreground line-clamp-1">{dept.note}</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs font-mono">{dept.code ?? "-"}</TableCell>
                                  <TableCell>
                                    <div className="text-xs text-muted-foreground">
                                      {departmentCounts.get(dept.id) ?? 0} ผู้ใช้
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <ActionButton
                                        label="แก้ไข"
                                        onClick={() =>
                                          setDepartmentForm({
                                            id: dept.id,
                                            name: dept.name ?? "",
                                            code: dept.code ?? "",
                                            note: dept.note ?? "",
                                          })
                                        }
                                        icon={<PencilLine className="h-4 w-4" />}
                                      />
                                      <ActionButton
                                        label="ลบ"
                                        onClick={() =>
                                          setDeleteTarget({ id: dept.id, name: dept.name ?? "", type: "department" })
                                        }
                                        icon={<Trash2 className="h-4 w-4 text-destructive" />}
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )
                    }
                    stacked={
                      deptError ? (
                        <ListErrorState message={getErrorMessage(deptErrorObj)} onRetry={refetchDepartments} />
                      ) : deptLoading ? (
                        <StackedSkeleton rows={4} />
                      ) : filteredDepartments.length === 0 ? (
                        <EmptyState
                          title="ยังไม่มีแผนกในระบบ"
                          description="เริ่มต้นสร้างแผนกแรกได้จากแบบฟอร์มด้านซ้าย"
                          actionLabel="สร้างแผนกใหม่"
                          onAction={() => departmentNameRef.current?.focus()}
                        />
                      ) : (
                        <div className="grid gap-3 p-4">
                          {filteredDepartments.map((dept) => (
                            <div key={dept.id} className="rounded-xl border border-border/60 bg-background p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="font-semibold">{dept.name}</div>
                                  {dept.note && (
                                    <div className="text-xs text-muted-foreground line-clamp-2">{dept.note}</div>
                                  )}
                                </div>
                                <MobileActionMenu
                                  onEdit={() =>
                                    setDepartmentForm({
                                      id: dept.id,
                                      name: dept.name ?? "",
                                      code: dept.code ?? "",
                                      note: dept.note ?? "",
                                    })
                                  }
                                  onDelete={() =>
                                    setDeleteTarget({ id: dept.id, name: dept.name ?? "", type: "department" })
                                  }
                                />
                              </div>
                              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                                <div>
                                  โค้ด: <span className="font-mono text-foreground">{dept.code ?? "-"}</span>
                                </div>
                                <div>ผู้ใช้งาน: {departmentCounts.get(dept.id) ?? 0} คน</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="locations" className="mt-0">
            <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="space-y-2 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5" /> {locationForm.id ? "แก้ไขสถานที่" : "เพิ่มสถานที่"}
                    </CardTitle>
                    {locationForm.id && (
                      <Badge variant="secondary" className="text-xs">
                        Editing
                      </Badge>
                    )}
                  </div>
                  <CardDescription>ระบุชื่อสถานที่ อาคาร และรายละเอียดเพื่อใช้งานในระบบ</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleLocationSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="location-name">ชื่อสถานที่</Label>
                      <Input
                        id="location-name"
                        ref={locationNameRef}
                        value={locationForm.name}
                        onChange={(e) => {
                          setLocationForm((prev) => ({ ...prev, name: e.target.value }));
                          setLocationError("");
                        }}
                        placeholder="เช่น ห้อง Server"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-building">อาคาร/ชั้น</Label>
                      <Input
                        id="location-building"
                        value={locationForm.building}
                        onChange={(e) => {
                          setLocationForm((prev) => ({ ...prev, building: e.target.value }));
                          setLocationError("");
                        }}
                        placeholder="เช่น อาคาร A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-note">หมายเหตุ</Label>
                      <Textarea
                        id="location-note"
                        value={locationForm.note}
                        onChange={(e) => {
                          setLocationForm((prev) => ({ ...prev, note: e.target.value }));
                          setLocationError("");
                        }}
                        placeholder="หมายเหตุ"
                      />
                    </div>
                    {locationError && <p className="text-xs text-rose-600">{locationError}</p>}
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={createLocation.isPending || updateLocation.isPending}
                      >
                        <Plus className="h-4 w-4" />
                        {locationForm.id ? "บันทึกการแก้ไข" : "เพิ่มสถานที่"}
                      </Button>
                      {locationForm.id && (
                        <Button type="button" variant="outline" onClick={resetLocationForm}>
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="space-y-3 border-b bg-muted/30">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">รายการสถานที่</CardTitle>
                      <CardDescription>ค้นหาและจัดการข้อมูลสถานที่</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {filteredLocations.length} รายการ
                    </Badge>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchText.locations}
                      onChange={(e) => setSearchText((prev) => ({ ...prev, locations: e.target.value }))}
                      placeholder="ค้นหาสถานที่..."
                      className="pl-9 h-11"
                      aria-label="ค้นหาสถานที่"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveTable
                    table={
                      locError ? (
                        <ListErrorState message={getErrorMessage(locErrorObj)} onRetry={refetchLocations} />
                      ) : locLoading ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  ชื่อสถานที่
                                </TableHead>
                                <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  อาคาร/ชั้น
                                </TableHead>
                                <TableHead className="w-[200px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  รายละเอียด
                                </TableHead>
                                <TableHead className="text-right w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  จัดการ
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableSkeleton columns={4} />
                          </Table>
                        </div>
                      ) : filteredLocations.length === 0 ? (
                        <EmptyState
                          title="ยังไม่มีสถานที่ในระบบ"
                          description="เริ่มต้นเพิ่มสถานที่แรกเพื่อจัดระเบียบข้อมูลทรัพย์สิน"
                          actionLabel="เพิ่มสถานที่ใหม่"
                          onAction={() => locationNameRef.current?.focus()}
                        />
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  ชื่อสถานที่
                                </TableHead>
                                <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  อาคาร/ชั้น
                                </TableHead>
                                <TableHead className="w-[200px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  รายละเอียด
                                </TableHead>
                                <TableHead className="text-right w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  จัดการ
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredLocations.map((loc) => (
                                <TableRow key={loc.id} className="hover:bg-muted/30">
                                  <TableCell>
                                    <div className="font-medium">{loc.name}</div>
                                    {loc.note && (
                                      <div className="text-xs text-muted-foreground line-clamp-1">{loc.note}</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">{loc.building || "-"}</TableCell>
                                  <TableCell>
                                    <div className="text-xs text-muted-foreground line-clamp-1">
                                      {loc.note || "ไม่มีรายละเอียด"}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <ActionButton
                                        label="แก้ไข"
                                        onClick={() =>
                                          setLocationForm({
                                            id: loc.id,
                                            name: loc.name ?? "",
                                            building: loc.building ?? "",
                                            note: loc.note ?? "",
                                          })
                                        }
                                        icon={<PencilLine className="h-4 w-4" />}
                                      />
                                      <ActionButton
                                        label="ลบ"
                                        onClick={() =>
                                          setDeleteTarget({ id: loc.id, name: loc.name ?? "", type: "location" })
                                        }
                                        icon={<Trash2 className="h-4 w-4 text-destructive" />}
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )
                    }
                    stacked={
                      locError ? (
                        <ListErrorState message={getErrorMessage(locErrorObj)} onRetry={refetchLocations} />
                      ) : locLoading ? (
                        <StackedSkeleton rows={4} />
                      ) : filteredLocations.length === 0 ? (
                        <EmptyState
                          title="ยังไม่มีสถานที่ในระบบ"
                          description="เริ่มต้นเพิ่มสถานที่แรกเพื่อจัดระเบียบข้อมูลทรัพย์สิน"
                          actionLabel="เพิ่มสถานที่ใหม่"
                          onAction={() => locationNameRef.current?.focus()}
                        />
                      ) : (
                        <div className="grid gap-3 p-4">
                          {filteredLocations.map((loc) => (
                            <div key={loc.id} className="rounded-xl border border-border/60 bg-background p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="font-semibold">{loc.name}</div>
                                  {loc.note && (
                                    <div className="text-xs text-muted-foreground line-clamp-2">{loc.note}</div>
                                  )}
                                </div>
                                <MobileActionMenu
                                  onEdit={() =>
                                    setLocationForm({
                                      id: loc.id,
                                      name: loc.name ?? "",
                                      building: loc.building ?? "",
                                      note: loc.note ?? "",
                                    })
                                  }
                                  onDelete={() =>
                                    setDeleteTarget({ id: loc.id, name: loc.name ?? "", type: "location" })
                                  }
                                />
                              </div>
                              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                                <div>
                                  อาคาร/ชั้น: <span className="text-foreground">{loc.building || "-"}</span>
                                </div>
                                <div>
                                  รายละเอียด: <span className="text-foreground">{loc.note || "ไม่มีรายละเอียด"}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="categories" className="mt-0">
            <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="space-y-2 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Tags className="h-5 w-5" /> {categoryForm.id ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}
                    </CardTitle>
                    {categoryForm.id && (
                      <Badge variant="secondary" className="text-xs">
                        Editing
                      </Badge>
                    )}
                  </div>
                  <CardDescription>บันทึกชื่อ โค้ด และหมายเหตุหมวดหมู่สำหรับใช้งานในระบบ</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleCategorySubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="category-name">ชื่อหมวดหมู่</Label>
                      <Input
                        id="category-name"
                        ref={categoryNameRef}
                        value={categoryForm.name}
                        onChange={(e) => {
                          setCategoryForm((prev) => ({ ...prev, name: e.target.value }));
                          setCategoryError("");
                        }}
                        placeholder="เช่น IT"
                        className="h-11"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category-code">โค้ดหมวดหมู่</Label>
                      <Input
                        id="category-code"
                        value={categoryForm.code}
                        onChange={(e) => {
                          const next = e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 3);
                          setCategoryForm((prev) => ({ ...prev, code: next }));
                          setCategoryError("");
                        }}
                        placeholder="เช่น IT"
                        className="h-11"
                        maxLength={3}
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
                          setCategoryForm((prev) => ({ ...prev, note: e.target.value }));
                          setCategoryError("");
                        }}
                        placeholder="หมายเหตุเพิ่มเติม"
                        className="min-h-[120px]"
                      />
                    </div>
                    {categoryError && <p className="text-xs text-rose-600">{categoryError}</p>}
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        className="flex-1 h-11 text-base shadow-sm"
                        disabled={createCategory.isPending || updateCategory.isPending}
                      >
                        <Plus className="h-4 w-4" />
                        {categoryForm.id ? "บันทึกการแก้ไข" : "เพิ่มหมวดหมู่"}
                      </Button>
                      {categoryForm.id && (
                        <Button type="button" variant="outline" onClick={resetCategoryForm}>
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="space-y-3 border-b bg-muted/30">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">รายการหมวดหมู่</CardTitle>
                      <CardDescription>จัดการหมวดหมู่ได้อย่างรวดเร็วและชัดเจน</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Badge variant="secondary" className="text-xs">
                        {sortedCategories.length} รายการ
                      </Badge>
                      <Select
                        value={categorySort}
                        onValueChange={(value) =>
                          setCategorySort(value as "name-asc" | "name-desc" | "updated-desc" | "updated-asc")
                        }
                      >
                        <SelectTrigger className="h-9 w-full text-xs sm:w-[150px]">
                          <SelectValue placeholder="เรียงลำดับ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name-asc">ชื่อ (A-Z)</SelectItem>
                          <SelectItem value="name-desc">ชื่อ (Z-A)</SelectItem>
                          <SelectItem value="updated-desc">อัปเดตล่าสุด</SelectItem>
                          <SelectItem value="updated-asc">อัปเดตเก่าสุด</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchText.categories}
                      onChange={(e) => setSearchText((prev) => ({ ...prev, categories: e.target.value }))}
                      placeholder="ค้นหาหมวดหมู่..."
                      className="pl-9 h-11"
                      aria-label="ค้นหาหมวดหมู่"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveTable
                    table={
                      catError ? (
                        <ListErrorState message={getErrorMessage(catErrorObj)} onRetry={refetchCategories} />
                      ) : catLoading ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  ชื่อหมวดหมู่
                                </TableHead>
                                <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  SKU
                                </TableHead>
                                <TableHead className="w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  อัปเดตล่าสุด
                                </TableHead>
                                <TableHead className="text-right w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  จัดการ
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableSkeleton columns={4} />
                          </Table>
                        </div>
                      ) : sortedCategories.length === 0 ? (
                        <EmptyState
                          title="ยังไม่มีหมวดหมู่"
                          description="สร้างหมวดหมู่แรกเพื่อเริ่มต้นใช้งาน"
                          actionLabel="เพิ่มหมวดหมู่ใหม่"
                          onAction={() => categoryNameRef.current?.focus()}
                        />
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  ชื่อหมวดหมู่
                                </TableHead>
                                <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  SKU
                                </TableHead>
                                <TableHead className="w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  อัปเดตล่าสุด
                                </TableHead>
                                <TableHead className="text-right w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  จัดการ
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedCategories.map((category) => (
                                <TableRow key={category.id} className="hover:bg-muted/30">
                                  <TableCell>
                                    <div className="font-medium">{category.name}</div>
                                    {category.note && (
                                      <div className="text-xs text-muted-foreground line-clamp-1">{category.note}</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs font-mono">{category.code ?? ""}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {formatDate(category.updated_at ?? category.created_at)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <ActionButton
                                        label="แก้ไข"
                                        onClick={() =>
                                          setCategoryForm({
                                            id: category.id,
                                            name: category.name ?? "",
                                            code: (category.code ?? "").toUpperCase(),
                                            note: category.note ?? "",
                                          })
                                        }
                                        icon={<PencilLine className="h-4 w-4" />}
                                      />
                                      <ActionButton
                                        label="ลบ"
                                        onClick={() =>
                                          setDeleteTarget({ id: category.id, name: category.name ?? "", type: "category" })
                                        }
                                        icon={<Trash2 className="h-4 w-4 text-destructive" />}
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )
                    }
                    stacked={
                      catError ? (
                        <ListErrorState message={getErrorMessage(catErrorObj)} onRetry={refetchCategories} />
                      ) : catLoading ? (
                        <StackedSkeleton rows={4} />
                      ) : sortedCategories.length === 0 ? (
                        <EmptyState
                          title="ยังไม่มีหมวดหมู่"
                          description="สร้างหมวดหมู่แรกเพื่อเริ่มต้นใช้งาน"
                          actionLabel="เพิ่มหมวดหมู่ใหม่"
                          onAction={() => categoryNameRef.current?.focus()}
                        />
                      ) : (
                        <div className="grid gap-3 p-4">
                          {sortedCategories.map((category) => (
                            <div key={category.id} className="rounded-xl border border-border/60 bg-background p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="font-semibold">{category.name}</div>
                                  {category.note && (
                                    <div className="text-xs text-muted-foreground line-clamp-2">{category.note}</div>
                                  )}
                                </div>
                                <MobileActionMenu
                                  onEdit={() =>
                                    setCategoryForm({
                                      id: category.id,
                                      name: category.name ?? "",
                                      code: (category.code ?? "").toUpperCase(),
                                      note: category.note ?? "",
                                    })
                                  }
                                  onDelete={() =>
                                    setDeleteTarget({ id: category.id, name: category.name ?? "", type: "category" })
                                  }
                                />
                              </div>
                              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                                <div>
                                  SKU: <span className="font-mono text-foreground">{category.code ?? "-"}</span>
                                </div>
                                <div>
                                  อัปเดตล่าสุด: <span className="text-foreground">{formatDate(category.updated_at ?? category.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <SafeDeleteDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          itemName={deleteTarget?.name || ""}
          itemType={
            deleteTarget?.type === "department"
              ? "แผนก"
              : deleteTarget?.type === "location"
                ? "สถานที่"
                : "หมวดหมู่"
          }
          isLoading={isDeleting}
        />
      </div>
    </MainLayout>
  );
}
