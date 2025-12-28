import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Building, MapPin, Tags } from "lucide-react";
import { 
  useDepartments, 
  useCreateDepartment, 
  useDeleteDepartment,
  useLocations,
  useCreateLocation,
  useDeleteLocation,
  useCategories,
  useCreateCategory,
  useDeleteCategory
} from "@/hooks/useMasterData";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "departments";

  // Departments
  const { data: departments, isLoading: deptLoading } = useDepartments();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const [newDeptName, setNewDeptName] = useState("");

  // Locations
  const { data: locations, isLoading: locLoading } = useLocations();
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();
  const [newLocName, setNewLocName] = useState("");
  const [newLocBuilding, setNewLocBuilding] = useState("");

  // Category
  const { data: categories, isLoading: catLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [newCatName, setNewCatName] = useState("");

  // Handlers
  const handleTabChange = (value: string) => {
    // อัปเดต URL เมื่อเปลี่ยน Tab
    setSearchParams({ tab: value }, { replace: true });
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    await createDepartment.mutateAsync(newDeptName.trim());
    setNewDeptName("");
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;
    await createLocation.mutateAsync({
      name: newLocName.trim(),
      building: newLocBuilding.trim() || undefined,
    });
    setNewLocName("");
    setNewLocBuilding("");
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await createCategory.mutateAsync(newCatName.trim());
    setNewCatName("");
  };

  return (
    <MainLayout title="ตั้งค่าข้อมูล">
      <div className="space-y-6">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="departments">แผนก</TabsTrigger>
            <TabsTrigger value="locations">สถานที่</TabsTrigger>
            <TabsTrigger value="categories">หมวดหมู่</TabsTrigger>
          </TabsList>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Add Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    เพิ่มแผนก
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddDepartment} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deptName">ชื่อแผนก</Label>
                      <Input
                        id="deptName"
                        placeholder="ระบุชื่อแผนก"
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full gap-2"
                      disabled={createDepartment.isPending}
                    >
                      <Plus className="h-4 w-4" />
                      {createDepartment.isPending ? 'กำลังบันทึก...' : 'เพิ่มแผนก'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* List */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">รายการแผนก</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {deptLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : departments && departments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ชื่อแผนก</TableHead>
                          <TableHead className="text-right w-[100px]">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departments.map((dept) => (
                          <TableRow key={dept.id}>
                            <TableCell className="font-medium">{dept.name}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteDepartment.mutate(dept.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Building className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">ยังไม่มีข้อมูลแผนก</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Add Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    เพิ่มสถานที่
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddLocation} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="locName">ชื่อสถานที่</Label>
                      <Input
                        id="locName"
                        placeholder="เช่น ห้องเซิร์ฟเวอร์"
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="locBuilding">อาคาร (ถ้ามี)</Label>
                      <Input
                        id="locBuilding"
                        placeholder="เช่น อาคาร A"
                        value={newLocBuilding}
                        onChange={(e) => setNewLocBuilding(e.target.value)}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full gap-2"
                      disabled={createLocation.isPending}
                    >
                      <Plus className="h-4 w-4" />
                      {createLocation.isPending ? 'กำลังบันทึก...' : 'เพิ่มสถานที่'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* List */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">รายการสถานที่</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {locLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : locations && locations.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ชื่อสถานที่</TableHead>
                          <TableHead>อาคาร</TableHead>
                          <TableHead className="text-right w-[100px]">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locations.map((loc) => (
                          <TableRow key={loc.id}>
                            <TableCell className="font-medium">{loc.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {loc.building || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteLocation.mutate(loc.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <MapPin className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">ยังไม่มีข้อมูลสถานที่</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* --- Category Tab --- */}
          <TabsContent value="categories">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Add Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tags className="h-5 w-5" />
                    เพิ่มหมวดหมู่
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddCategory} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="catName">ชื่อหมวดหมู่</Label>
                      <Input
                        id="catName"
                        placeholder="เช่น ไอที (IT)"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full gap-2"
                      disabled={createCategory.isPending}
                    >
                      <Plus className="h-4 w-4" />
                      {createCategory.isPending ? 'กำลังบันทึก...' : 'เพิ่มหมวดหมู่'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* List */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">รายการหมวดหมู่สินค้า</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {catLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : categories && categories.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ชื่อหมวดหมู่</TableHead>
                          <TableHead className="text-right w-[100px]">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((cat) => (
                          <TableRow key={cat.id}>
                            <TableCell className="font-medium">{cat.name}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteCategory.mutate(cat.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Tags className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">ยังไม่มีข้อมูลหมวดหมู่</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
