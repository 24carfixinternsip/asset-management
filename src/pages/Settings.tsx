import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableCell } from "@/components/ui/table";
import { Building, MapPin, Tags, Plus } from "lucide-react";

// Hooks
import {
  useDepartments,
  useCreateDepartment,
  useDeleteDepartment,
  useLocations,
  useCreateLocation,
  useDeleteLocation,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
} from "@/hooks/useMasterData";

// New Components
import { SafeDeleteDialog } from "@/components/master-data/SafeDeleteDialog";
import { MasterDataTable } from "@/components/master-data/MasterDataTable";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "departments";

  // --- State for Delete Dialog ---
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: "department" | "location" | "category";
  } | null>(null);

  // --- Departments ---
  const { data: departments, isLoading: deptLoading } = useDepartments();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const [newDeptName, setNewDeptName] = useState("");

  // --- Locations ---
  const { data: locations, isLoading: locLoading } = useLocations();
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();
  const [newLocName, setNewLocName] = useState("");
  const [newLocBuilding, setNewLocBuilding] = useState("");

  // --- Categories ---
  const { data: categories, isLoading: catLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [newCatName, setNewCatName] = useState("");

  // --- Handlers ---
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
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
      setDeleteTarget(null); // Close dialog on success
    } catch (error) {
      // Error is handled in hook (toast), keep dialog open if needed or close it
      console.error(error);
    }
  };

  const isDeleting = 
    deleteDepartment.isPending || 
    deleteLocation.isPending || 
    deleteCategory.isPending;

  return (
    <MainLayout title="ตั้งค่าข้อมูล">
      <div className="space-y-6">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="departments">แผนก</TabsTrigger>
            <TabsTrigger value="locations">สถานที่</TabsTrigger>
            <TabsTrigger value="categories">หมวดหมู่</TabsTrigger>
          </TabsList>

          {/* === Departments Tab === */}
          <TabsContent value="departments">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-5 w-5" /> เพิ่มแผนก
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newDeptName.trim()) {
                        createDepartment.mutateAsync(newDeptName.trim()).then(() => setNewDeptName(""));
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>ชื่อแผนก</Label>
                      <Input
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                        placeholder="ระบุชื่อแผนก"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full gap-2" disabled={createDepartment.isPending}>
                      <Plus className="h-4 w-4" /> {createDepartment.isPending ? "บันทึก..." : "เพิ่มแผนก"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-lg">รายการแผนก</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <MasterDataTable
                    data={departments}
                    isLoading={deptLoading}
                    emptyMessage="ยังไม่มีข้อมูลแผนก"
                    columns={[{ header: "ชื่อแผนก" }]}
                    renderRow={(dept) => <TableCell className="font-medium">{dept.name}</TableCell>}
                    onDelete={(dept) => setDeleteTarget({ id: dept.id, name: dept.name, type: "department" })}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* === Locations Tab === */}
          <TabsContent value="locations">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" /> เพิ่มสถานที่
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newLocName.trim()) {
                        createLocation
                          .mutateAsync({ name: newLocName.trim(), building: newLocBuilding.trim() })
                          .then(() => {
                            setNewLocName("");
                            setNewLocBuilding("");
                          });
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>ชื่อสถานที่</Label>
                      <Input
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        placeholder="เช่น ห้อง Server"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>อาคาร (ถ้ามี)</Label>
                      <Input
                        value={newLocBuilding}
                        onChange={(e) => setNewLocBuilding(e.target.value)}
                        placeholder="เช่น อาคาร A"
                      />
                    </div>
                    <Button type="submit" className="w-full gap-2" disabled={createLocation.isPending}>
                      <Plus className="h-4 w-4" /> {createLocation.isPending ? "บันทึก..." : "เพิ่มสถานที่"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-lg">รายการสถานที่</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <MasterDataTable
                    data={locations}
                    isLoading={locLoading}
                    emptyMessage="ยังไม่มีข้อมูลสถานที่"
                    columns={[{ header: "ชื่อสถานที่" }, { header: "อาคาร" }]}
                    renderRow={(loc) => (
                      <>
                        <TableCell className="font-medium">{loc.name}</TableCell>
                        <TableCell className="text-muted-foreground">{loc.building || "-"}</TableCell>
                      </>
                    )}
                    onDelete={(loc) => setDeleteTarget({ id: loc.id, name: loc.name, type: "location" })}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* === Categories Tab === */}
          <TabsContent value="categories">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tags className="h-5 w-5" /> เพิ่มหมวดหมู่
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newCatName.trim()) {
                        createCategory.mutateAsync(newCatName.trim()).then(() => setNewCatName(""));
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>ชื่อหมวดหมู่</Label>
                      <Input
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="เช่น IT"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full gap-2" disabled={createCategory.isPending}>
                      <Plus className="h-4 w-4" /> {createCategory.isPending ? "บันทึก..." : "เพิ่มหมวดหมู่"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-lg">รายการหมวดหมู่</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <MasterDataTable
                    data={categories}
                    isLoading={catLoading}
                    emptyMessage="ยังไม่มีข้อมูลหมวดหมู่"
                    columns={[{ header: "ชื่อหมวดหมู่" }]}
                    renderRow={(cat) => <TableCell className="font-medium">{cat.name}</TableCell>}
                    onDelete={(cat) => setDeleteTarget({ id: cat.id, name: cat.name, type: "category" })}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* --- Global Delete Dialog --- */}
        <SafeDeleteDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          itemName={deleteTarget?.name || ""}
          itemType={
            deleteTarget?.type === "department" ? "แผนก" : 
            deleteTarget?.type === "location" ? "สถานที่" : "หมวดหมู่"
          }
          isLoading={isDeleting}
        />
      </div>
    </MainLayout>
  );
}