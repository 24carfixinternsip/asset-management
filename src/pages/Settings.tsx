
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  useCategories,
  useCreateCategory,
  useCreateDepartment,
  useCreateLocation,
  useDeleteCategoriesBatch,
  useDeleteCategory,
  useDeleteDepartment,
  useDeleteLocation,
  useDepartments,
  useEmployees,
  useLocations,
  useReorderCategories,
  useUpdateCategory,
  useUpdateDepartment,
  useUpdateLocation,
  type Category,
} from "@/hooks/useMasterData";
import { SafeDeleteDialog } from "@/components/master-data/SafeDeleteDialog";
import { Building, MapPin, Plus, Tags, Trash2, PencilLine, GripVertical } from "lucide-react";
import { toast } from "sonner";

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const normalize = (value: string) => value.trim().toLowerCase();

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "departments";

  const { data: departments, isLoading: deptLoading } = useDepartments();
  const { data: employees } = useEmployees();
  const { data: locations, isLoading: locLoading } = useLocations();
  const { data: categories, isLoading: catLoading } = useCategories();

  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();

  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const deleteCategoriesBatch = useDeleteCategoriesBatch();
  const reorderCategories = useReorderCategories();

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
    address: "",
    note: "",
  });
  const [locationError, setLocationError] = useState("");

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    code: "",
    type: "main",
    parent_id: "",
    note: "",
  });
  const [categoryError, setCategoryError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: "department" | "location" | "category";
  } | null>(null);

  const [categoryDeleteOpen, setCategoryDeleteOpen] = useState(false);
  const [categoryDeleteOption, setCategoryDeleteOption] = useState<"cascade" | "reassign" | "block">("cascade");
  const [categoryReassignTarget, setCategoryReassignTarget] = useState("");

  const [dragItem, setDragItem] = useState<{ id: string; parentId: string | null } | null>(null);

  const departmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    (employees ?? []).forEach((emp) => {
      if (emp.department_id) {
        map.set(emp.department_id, (map.get(emp.department_id) ?? 0) + 1);
      }
    });
    return map;
  }, [employees]);

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

  const mainCategories = useMemo(() => {
    return filteredCategories.filter((cat) => !cat.parent_id);
  }, [filteredCategories]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    filteredCategories.forEach((cat) => {
      if (cat.parent_id) {
        const current = map.get(cat.parent_id) ?? [];
        map.set(cat.parent_id, [...current, cat]);
      }
    });
    map.forEach((list, key) => {
      map.set(key, [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    });
    return map;
  }, [filteredCategories]);
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

  const isCategoryDuplicate = (name: string, id?: string, parentId?: string | null) => {
    const normalized = normalize(name);
    return (categories ?? []).some(
      (cat) =>
        normalize(cat.name ?? "") === normalized &&
        cat.id !== id &&
        (parentId ? cat.parent_id === parentId : !cat.parent_id),
    );
  };

  const resetDepartmentForm = () => {
    setDepartmentForm({ id: "", name: "", code: "", note: "" });
    setDepartmentError("");
  };

  const resetLocationForm = () => {
    setLocationForm({ id: "", name: "", building: "", address: "", note: "" });
    setLocationError("");
  };

  const resetCategoryForm = () => {
    setCategoryForm({ id: "", name: "", code: "", type: "main", parent_id: "", note: "" });
    setCategoryError("");
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
    if (departmentForm.id) {
      await updateDepartment.mutateAsync({ id: departmentForm.id, ...payload });
    } else {
      await createDepartment.mutateAsync(payload);
    }
    resetDepartmentForm();
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
    const payload = {
      name,
      building: locationForm.building.trim() || null,
      address: locationForm.address.trim() || null,
      note: locationForm.note.trim() || null,
    };
    if (locationForm.id) {
      await updateLocation.mutateAsync({ id: locationForm.id, ...payload });
    } else {
      await createLocation.mutateAsync(payload);
    }
    resetLocationForm();
  };

  const handleCategorySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = categoryForm.name.trim();
    const parentId = categoryForm.type === "sub" ? categoryForm.parent_id || null : null;
    if (!name) {
      setCategoryError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }
    if (categoryForm.type === "sub" && !parentId) {
      setCategoryError("กรุณาเลือกหมวดหมู่หลัก");
      return;
    }
    if (isCategoryDuplicate(name, categoryForm.id || undefined, parentId)) {
      setCategoryError("มีชื่อหมวดหมู่นี้อยู่แล้ว");
      return;
    }

    const siblingList = (categories ?? []).filter((cat) =>
      parentId ? cat.parent_id === parentId : !cat.parent_id,
    );
    const nextOrder = (siblingList.length || 0) + 1;

    const payload: Partial<Category> & { name: string; code: string | null; parent_id: string | null; type: string } = {
      name,
      code: categoryForm.code.trim() || null,
      parent_id: parentId,
      type: parentId ? "sub" : "main",
      sort_order: categoryForm.id ? undefined : nextOrder,
      note: categoryForm.note.trim() || null,
    };

    if (categoryForm.id) {
      delete payload.sort_order;
      await updateCategory.mutateAsync({ id: categoryForm.id, ...payload });
    } else {
      await createCategory.mutateAsync(payload);
    }
    resetCategoryForm();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "department") {
        await deleteDepartment.mutateAsync(deleteTarget.id);
      } else if (deleteTarget.type === "location") {
        await deleteLocation.mutateAsync(deleteTarget.id);
      } else if (deleteTarget.type === "category") {
        await deleteCategory.mutateAsync(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
    }
  };

  const openCategoryDeleteDialog = (category: Category) => {
    setCategoryDeleteOption("cascade");
    setCategoryReassignTarget("");
    setDeleteTarget({ id: category.id, name: category.name ?? "", type: "category" });
    setCategoryDeleteOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!deleteTarget) return;
    const category = categories?.find((cat) => cat.id === deleteTarget.id);
    if (!category) return;

    const { data: usedProducts } = await supabase
      .from("products")
      .select("id")
      .eq("category", category.name)
      .limit(1);

    if (usedProducts && usedProducts.length > 0) {
      toast.error("หมวดหมู่นี้ถูกใช้งานอยู่ กรุณาย้ายสินค้าออกก่อน");
      return;
    }

    const children = (categories ?? []).filter((cat) => cat.parent_id === category.id);

    if (children.length > 0 && categoryDeleteOption === "reassign") {
      if (!categoryReassignTarget) {
        toast.error("กรุณาเลือกหมวดหมู่หลักสำหรับย้าย");
        return;
      }
      await supabase
        .from("categories")
        .update({ parent_id: categoryReassignTarget, type: "sub" })
        .eq("parent_id", category.id);
    }

    if (children.length > 0 && categoryDeleteOption === "cascade") {
      await deleteCategoriesBatch.mutateAsync(children.map((child) => child.id));
    }

    await deleteCategory.mutateAsync(category.id);
    setCategoryDeleteOpen(false);
    setDeleteTarget(null);
  };

  const handleReorder = async (parentId: string | null, orderedIds: string[]) => {
    const updates = orderedIds.map((id, index) => ({ id, sort_order: index + 1 }));
    await reorderCategories.mutateAsync(updates);
  };

  const renderCategoryRow = (category: Category, level: number) => {
    const children = childrenByParent.get(category.id) ?? [];
    return (
      <div key={category.id} className="space-y-2">
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
            level === 0 ? "bg-background" : "bg-muted/40",
          )}
          draggable
          onDragStart={() => setDragItem({ id: category.id, parentId: category.parent_id ?? null })}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!dragItem) return;
            if ((dragItem.parentId ?? null) !== (category.parent_id ?? null)) return;
            const siblings = (category.parent_id
              ? childrenByParent.get(category.parent_id) ?? []
              : mainCategories) ?? [];
            const ordered = siblings.map((item) => item.id);
            const fromIndex = ordered.indexOf(dragItem.id);
            const toIndex = ordered.indexOf(category.id);
            if (fromIndex === -1 || toIndex === -1) return;
            ordered.splice(fromIndex, 1);
            ordered.splice(toIndex, 0, dragItem.id);
            handleReorder(category.parent_id ?? null, ordered);
          }}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{category.name}</div>
              {category.code && <div className="text-xs text-muted-foreground">รหัส: {category.code}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {level === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCategoryForm({
                    id: "",
                    name: "",
                    code: "",
                    type: "sub",
                    parent_id: category.id,
                    note: "",
                  });
                }}
              >
                เพิ่มหมวดหมู่ย่อย
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setCategoryForm({
                  id: category.id,
                  name: category.name ?? "",
                  code: category.code ?? "",
                  type: category.parent_id ? "sub" : "main",
                  parent_id: category.parent_id ?? "",
                  note: category.note ?? "",
                });
              }}
            >
              <PencilLine className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => openCategoryDeleteDialog(category)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        {children.length > 0 && (
          <div className="space-y-2 pl-6">
            {children.map((child) => renderCategoryRow(child, 1))}
          </div>
        )}
      </div>
    );
  };

  const isDeleting =
    deleteDepartment.isPending || deleteLocation.isPending || deleteCategory.isPending;
  return (
    <MainLayout title="ตั้งค่าข้อมูล">
      <div className="space-y-6">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="departments">แผนก</TabsTrigger>
            <TabsTrigger value="locations">สถานที่</TabsTrigger>
            <TabsTrigger value="categories">หมวดหมู่</TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-5 w-5" /> {departmentForm.id ? "แก้ไขแผนก" : "เพิ่มแผนก"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleDepartmentSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>ชื่อแผนก</Label>
                      <Input
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
                      <Label>โค้ดแผนก (ถ้ามี)</Label>
                      <Input
                        value={departmentForm.code}
                        onChange={(e) => setDepartmentForm((prev) => ({ ...prev, code: e.target.value }))}
                        placeholder="เช่น HR"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>หมายเหตุ</Label>
                      <Textarea
                        value={departmentForm.note}
                        onChange={(e) => setDepartmentForm((prev) => ({ ...prev, note: e.target.value }))}
                        placeholder="รายละเอียดเพิ่มเติม"
                      />
                    </div>
                    {departmentError && <p className="text-xs text-rose-600">{departmentError}</p>}
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={createDepartment.isPending || updateDepartment.isPending}>
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

              <Card>
                <CardHeader className="space-y-2">
                  <CardTitle className="text-lg">รายการแผนก</CardTitle>
                  <Input
                    value={searchText.departments}
                    onChange={(e) => setSearchText((prev) => ({ ...prev, departments: e.target.value }))}
                    placeholder="ค้นหาแผนก..."
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  {deptLoading ? (
                    <div className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</div>
                  ) : filteredDepartments.length === 0 ? (
                    <div className="text-sm text-muted-foreground">ยังไม่มีข้อมูลแผนก</div>
                  ) : (
                    filteredDepartments.map((dept) => (
                      <div key={dept.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div>
                          <div className="font-medium">{dept.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {dept.code ? `โค้ด ${dept.code}` : "ไม่มีโค้ด"} • {departmentCounts.get(dept.id) ?? 0} ผู้ใช้
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setDepartmentForm({
                                id: dept.id,
                                name: dept.name ?? "",
                                code: dept.code ?? "",
                                note: dept.note ?? "",
                              })
                            }
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTarget({ id: dept.id, name: dept.name ?? "", type: "department" })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="locations">
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" /> {locationForm.id ? "แก้ไขสถานที่" : "เพิ่มสถานที่"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLocationSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>ชื่อสถานที่</Label>
                      <Input
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
                      <Label>อาคาร/ชั้น</Label>
                      <Input
                        value={locationForm.building}
                        onChange={(e) => setLocationForm((prev) => ({ ...prev, building: e.target.value }))}
                        placeholder="เช่น อาคาร A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ที่อยู่/รายละเอียด</Label>
                      <Input
                        value={locationForm.address}
                        onChange={(e) => setLocationForm((prev) => ({ ...prev, address: e.target.value }))}
                        placeholder="รายละเอียดเพิ่มเติม"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>หมายเหตุ</Label>
                      <Textarea
                        value={locationForm.note}
                        onChange={(e) => setLocationForm((prev) => ({ ...prev, note: e.target.value }))}
                        placeholder="หมายเหตุ"
                      />
                    </div>
                    {locationError && <p className="text-xs text-rose-600">{locationError}</p>}
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={createLocation.isPending || updateLocation.isPending}>
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

              <Card>
                <CardHeader className="space-y-2">
                  <CardTitle className="text-lg">รายการสถานที่</CardTitle>
                  <Input
                    value={searchText.locations}
                    onChange={(e) => setSearchText((prev) => ({ ...prev, locations: e.target.value }))}
                    placeholder="ค้นหาสถานที่..."
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  {locLoading ? (
                    <div className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</div>
                  ) : filteredLocations.length === 0 ? (
                    <div className="text-sm text-muted-foreground">ยังไม่มีข้อมูลสถานที่</div>
                  ) : (
                    filteredLocations.map((loc) => (
                      <div key={loc.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div>
                          <div className="font-medium">{loc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {loc.building || "ไม่ระบุอาคาร"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setLocationForm({
                                id: loc.id,
                                name: loc.name ?? "",
                                building: loc.building ?? "",
                                address: loc.address ?? "",
                                note: loc.note ?? "",
                              })
                            }
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTarget({ id: loc.id, name: loc.name ?? "", type: "location" })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="categories">
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tags className="h-5 w-5" /> {categoryForm.id ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCategorySubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>ชื่อหมวดหมู่</Label>
                      <Input
                        value={categoryForm.name}
                        onChange={(e) => {
                          setCategoryForm((prev) => ({ ...prev, name: e.target.value }));
                          setCategoryError("");
                        }}
                        placeholder="เช่น IT"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>โค้ดหมวดหมู่</Label>
                      <Input
                        value={categoryForm.code}
                        onChange={(e) => setCategoryForm((prev) => ({ ...prev, code: e.target.value }))}
                        placeholder="เช่น IT"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ประเภทหมวดหมู่</Label>
                      <Select
                        value={categoryForm.type}
                        onValueChange={(value) =>
                          setCategoryForm((prev) => ({
                            ...prev,
                            type: value,
                            parent_id: value === "main" ? "" : prev.parent_id,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกประเภท" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">หมวดหมู่หลัก</SelectItem>
                          <SelectItem value="sub">หมวดหมู่ย่อย</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {categoryForm.type === "sub" && (
                      <div className="space-y-2">
                        <Label>เลือกหมวดหมู่หลัก</Label>
                        <Select
                          value={categoryForm.parent_id}
                          onValueChange={(value) => setCategoryForm((prev) => ({ ...prev, parent_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกหมวดหมู่หลัก" />
                          </SelectTrigger>
                          <SelectContent>
                            {mainCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>หมายเหตุ</Label>
                      <Textarea
                        value={categoryForm.note}
                        onChange={(e) => setCategoryForm((prev) => ({ ...prev, note: e.target.value }))}
                        placeholder="หมายเหตุเพิ่มเติม"
                      />
                    </div>
                    {categoryError && <p className="text-xs text-rose-600">{categoryError}</p>}
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={createCategory.isPending || updateCategory.isPending}>
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

              <Card>
                <CardHeader className="space-y-2">
                  <CardTitle className="text-lg">โครงสร้างหมวดหมู่</CardTitle>
                  <Input
                    value={searchText.categories}
                    onChange={(e) => setSearchText((prev) => ({ ...prev, categories: e.target.value }))}
                    placeholder="ค้นหาหมวดหมู่..."
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  {catLoading ? (
                    <div className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</div>
                  ) : mainCategories.length === 0 ? (
                    <div className="text-sm text-muted-foreground">ยังไม่มีหมวดหมู่</div>
                  ) : (
                    mainCategories
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((category) => renderCategoryRow(category, 0))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <SafeDeleteDialog
          isOpen={!!deleteTarget && deleteTarget.type !== "category"}
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

        <AlertDialog open={categoryDeleteOpen} onOpenChange={setCategoryDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" /> ยืนยันการลบหมวดหมู่
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <div>คุณต้องการลบหมวดหมู่ "{deleteTarget?.name}" หรือไม่?</div>
                <div className="space-y-2">
                  <Label>ตัวเลือกการลบ</Label>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryDeleteOption("cascade")}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                        categoryDeleteOption === "cascade"
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-border bg-background",
                      )}
                    >
                      <span>ลบทั้งหมวดหลักและหมวดย่อย</span>
                      {categoryDeleteOption === "cascade" && <Badge>แนะนำ</Badge>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryDeleteOption("reassign")}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                        categoryDeleteOption === "reassign"
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-border bg-background",
                      )}
                    >
                      <span>ย้ายหมวดย่อยไปหมวดอื่น</span>
                      {categoryDeleteOption === "reassign" && <Badge>ต้องเลือกหมวด</Badge>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryDeleteOption("block")}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                        categoryDeleteOption === "block"
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-border bg-background",
                      )}
                    >
                      <span>ไม่ลบ (ปิดหน้าต่าง)</span>
                    </button>
                  </div>
                </div>
                {categoryDeleteOption === "reassign" && (
                  <div className="space-y-2">
                    <Label>ย้ายหมวดย่อยไปยัง</Label>
                    <Select value={categoryReassignTarget} onValueChange={setCategoryReassignTarget}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกหมวดหมู่หลัก" />
                      </SelectTrigger>
                      <SelectContent>
                        {mainCategories
                          .filter((cat) => cat.id !== deleteTarget?.id)
                          .map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCategoryDeleteOpen(false)}>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  if (categoryDeleteOption === "block") {
                    setCategoryDeleteOpen(false);
                    return;
                  }
                  handleDeleteCategory();
                }}
              >
                ยืนยันลบ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
