import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList, 
  CommandSeparator 
} from "@/components/ui/command";
import { 
  Plus, Trash2, Users, Camera, Mail, Phone, MapPin, 
  Pencil, Eye, Package, Search, Filter, X, Check, Upload 
} from "lucide-react";
import { useEmployees, useCreateEmployee, useDeleteEmployee, useDepartments, useUpdateEmployee, useLocations, Employee } from "@/hooks/useMasterData";
import { useEmployeeTransactions } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ImportEmployeeDialog } from "@/components/employees/ImportEmployeeDialog";

export default function Employees() {
  // Setup URL Params
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: employees, isLoading } = useEmployees();
  const { data: departments } = useDepartments();
  const { data: locations } = useLocations();

  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  
  // --- Initialize States from URL ---
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  
  // แปลง dept=1,2,3 จาก URL กลับเป็น Array
  const [filterDeptIds, setFilterDeptIds] = useState<string[]>(() => {
    const deptParam = searchParams.get("dept");
    return deptParam ? deptParam.split(",") : [];
  });

  // Modal States from URL
  const modalParam = searchParams.get("modal");
  const idParam = searchParams.get("id");

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(modalParam === "import");
  const [isDialogOpen, setIsDialogOpen] = useState(modalParam === "add" || modalParam === "edit");
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(modalParam === "view");
  const [isEditing, setIsEditing] = useState(modalParam === "edit");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(idParam);

  const [isUploading, setIsUploading] = useState(false);
  
  // Transaction Data for View Mode
  const { data: empTransactions, isLoading: isTransLoading } = useEmployeeTransactions(selectedEmployeeId);

  // --- Form Data ---
  const [formData, setFormData] = useState({
    emp_code: "",
    name: "",
    nickname: "",
    gender: "",
    email: "",
    tel: "",
    location_id: "",
    department_id: "",
    image_url: "",
  });

  // Sync State -> URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    // Search
    if (searchTerm) params.set("q", searchTerm);
    else params.delete("q");

    // Dept Filter
    if (filterDeptIds.length > 0) params.set("dept", filterDeptIds.join(","));
    else params.delete("dept");

    // Modals & ID
    if (isImportDialogOpen) {
      params.set("modal", "import");
      params.delete("id");
    } else if (isViewDialogOpen && selectedEmployeeId) {
      params.set("modal", "view");
      params.set("id", selectedEmployeeId);
    } else if (isDialogOpen) {
      params.set("modal", isEditing ? "edit" : "add");
      if (isEditing && selectedEmployeeId) {
        params.set("id", selectedEmployeeId);
      } else {
        params.delete("id");
      }
    } else {
      params.delete("modal");
      params.delete("id");
    }

    setSearchParams(params, { replace: true });
  }, [searchTerm, filterDeptIds, isImportDialogOpen, isDialogOpen, isViewDialogOpen, isEditing, selectedEmployeeId, setSearchParams]);

  // Auto-Fill Form when refreshing on Edit Mode
  // เมื่อโหลดข้อมูลพนักงานเสร็จ และ URL บอกว่าเป็นโหมด Edit ให้เติมข้อมูลลง Form
  useEffect(() => {
    if (employees && isEditing && selectedEmployeeId && isDialogOpen) {
      // เช็คว่า Form ว่างอยู่ไหม (ป้องกันการทับข้อมูลที่กำลังพิมพ์)
      if (!formData.name) {
        const emp = employees.find(e => e.id === selectedEmployeeId);
        if (emp) {
          setFormData({
            emp_code: emp.emp_code,
            name: emp.name,
            nickname: emp.nickname || "",
            gender: emp.gender || "",
            email: emp.email || "",
            tel: emp.tel || "",
            location_id: emp.location_id || "",
            department_id: emp.department_id || "",
            image_url: emp.image_url || "",
          });
        }
      }
    }
  }, [employees, isEditing, selectedEmployeeId, isDialogOpen]);

  // Logic การกรองข้อมูล
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    
    return employees.filter(emp => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        emp.name.toLowerCase().includes(searchLower) ||
        (emp.nickname && emp.nickname.toLowerCase().includes(searchLower)) ||
        emp.emp_code.toLowerCase().includes(searchLower);

      const matchesDept = 
        filterDeptIds.length === 0 || 
        (emp.department_id && filterDeptIds.includes(emp.department_id));

      return matchesSearch && matchesDept;
    });
  }, [employees, searchTerm, filterDeptIds]);

  // Reset Form
  const resetForm = () => {
    setFormData({ 
      emp_code: "", name: "", nickname: "", gender: "", 
      email: "", tel: "", location_id: "", department_id: "", image_url: "" 
    });
    setSelectedEmployeeId(null);
    setIsEditing(false);
  };

  // Handlers
  const handleOpenAdd = () => {
    resetForm();
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setFormData({
      emp_code: emp.emp_code,
      name: emp.name,
      nickname: emp.nickname || "",
      gender: emp.gender || "",
      email: emp.email || "",
      tel: emp.tel || "",
      location_id: emp.location_id || "",
      department_id: emp.department_id || "",
      image_url: emp.image_url || "",
    });
    setSelectedEmployeeId(emp.id);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleOpenView = (id: string) => {
    setSelectedEmployeeId(id);
    setIsViewDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    // รอ animation จบแล้วค่อยเคลียร์ form ก็ได้ หรือเคลียร์เลยก็ได้
    setTimeout(() => resetForm(), 300);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `employees/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('asset-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('asset-images')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      console.error(error);
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const commonData = {
      emp_code: formData.emp_code ? formData.emp_code : null, 
      name: formData.name,
      nickname: formData.nickname || null,
      gender: formData.gender || null,
      email: formData.email || null,
      tel: formData.tel || null,
      location_id: formData.location_id || null,
      department_id: formData.department_id || null,
      image_url: formData.image_url || null,
    };

    try {
      if (isEditing && selectedEmployeeId) {
        await updateEmployee.mutateAsync({
          id: selectedEmployeeId,
          ...commonData //
        });
      } else {
        await createEmployee.mutateAsync(commonData);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in hook
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'd MMM yy HH:mm', { locale: th });
  };

  return (
    <MainLayout title="จัดการพนักงาน">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-muted-foreground">
              จัดการข้อมูลพนักงาน รายละเอียดการติดต่อ และประวัติการเบิกอุปกรณ์
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button className="gap-2" onClick={handleOpenAdd}>
              <Plus className="h-4 w-4" />
              เพิ่มพนักงาน
            </Button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="ค้นหาชื่อ, ชื่อเล่น, หรือรหัสพนักงาน..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Department Filter (Multi-select) */}
            <div className="w-full sm:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[250px] justify-start border-dashed h-10">
                    <Filter className="mr-2 h-4 w-4" />
                    แผนก
                    {filterDeptIds.length > 0 && (
                      <>
                        <Separator orientation="vertical" className="mx-2 h-4" />
                        <Badge
                          variant="secondary"
                          className="rounded-sm px-1 font-normal lg:hidden"
                        >
                          {filterDeptIds.length}
                        </Badge>
                        <div className="hidden space-x-1 lg:flex">
                          {filterDeptIds.length > 2 ? (
                            <Badge
                              variant="secondary"
                              className="rounded-sm px-1 font-normal"
                            >
                              {filterDeptIds.length} รายการ
                            </Badge>
                          ) : (
                            departments
                              ?.filter((dept) => filterDeptIds.includes(dept.id))
                              .map((dept) => (
                                <Badge
                                  variant="secondary"
                                  key={dept.id}
                                  className="rounded-sm px-1 font-normal"
                                >
                                  {dept.name}
                                </Badge>
                              ))
                          )}
                        </div>
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="ค้นหาแผนก..." />
                    <CommandList>
                      <CommandEmpty>ไม่พบแผนก</CommandEmpty>
                      <CommandGroup>
                        {departments?.map((dept) => {
                          const isSelected = filterDeptIds.includes(dept.id);
                          return (
                            <CommandItem
                              key={dept.id}
                              onSelect={() => {
                                if (isSelected) {
                                  setFilterDeptIds(filterDeptIds.filter((id) => id !== dept.id));
                                } else {
                                  setFilterDeptIds([...filterDeptIds, dept.id]);
                                }
                              }}
                            >
                              <div
                                className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50 [&_svg]:invisible"
                                )}
                              >
                                <Check className={cn("h-4 w-4")} />
                              </div>
                              <span>{dept.name}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                      {filterDeptIds.length > 0 && (
                        <>
                          <CommandSeparator />
                          <CommandGroup>
                            <CommandItem
                              onSelect={() => setFilterDeptIds([])}
                              className="justify-center text-center cursor-pointer"
                            >
                              ล้างตัวกรอง
                            </CommandItem>
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Employee List Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredEmployees && filteredEmployees.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">รูป</TableHead>
                    <TableHead>รหัส / ชื่อ</TableHead>
                    <TableHead>ข้อมูลส่วนตัว</TableHead>
                    <TableHead>การติดต่อ</TableHead>
                    <TableHead>ตำแหน่งงาน</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage src={emp.image_url || undefined} alt={emp.name} className="object-cover" />
                          <AvatarFallback>{emp.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-muted-foreground">{emp.emp_code}</span>
                          <span className="font-medium">{emp.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {emp.nickname && <Badge variant="secondary" className="mr-2">{emp.nickname}</Badge>}
                          <span className="text-muted-foreground text-xs">{emp.gender}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          {emp.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {emp.email}
                            </div>
                          )}
                          {emp.tel && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {emp.tel}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span>{emp.departments?.name || '-'}</span>
                          {emp.locations?.name && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" /> {emp.locations.name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="ดูประวัติ"
                            onClick={() => handleOpenView(emp.id)}
                          >
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="แก้ไข"
                            onClick={() => handleOpenEdit(emp)}
                          >
                            <Pencil className="h-4 w-4 text-orange-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="ลบ"
                            onClick={() => {
                              if(confirm(`ต้องการลบพนักงาน ${emp.name} ใช่หรือไม่?`)) {
                                deleteEmployee.mutate(emp.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm || filterDeptIds.length > 0
                    ? "ไม่พบข้อมูลที่ค้นหา" 
                    : "ยังไม่มีข้อมูลพนักงาน"}
                </p>
                {searchTerm || filterDeptIds.length > 0 ? (
                   <Button variant="link" onClick={() => { setSearchTerm(""); setFilterDeptIds([]); }}>
                     ล้างตัวกรอง
                   </Button>
                ) : (
                   <Button className="mt-4" onClick={handleOpenAdd}>
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่มพนักงานคนแรก
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              
              {/* Image Upload Section */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24 border-2 border-dashed border-gray-200">
                  <AvatarImage src={formData.image_url} className="object-cover" />
                  <AvatarFallback className="bg-muted">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    className="w-full max-w-[250px]"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1 */}
                <div className="space-y-2">
                  <Label htmlFor="emp_code">รหัสพนักงาน (ถ้ามี)</Label>
                  <Input
                    id="emp_code"
                    placeholder="EMP-001 (เว้นว่างได้)"
                    value={formData.emp_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, emp_code: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="department">แผนก</Label>
                  <Select
                    value={formData.department_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกแผนก" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">ชื่อ-นามสกุล <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    placeholder="ระบุชื่อเต็ม"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nickname">ชื่อเล่น</Label>
                  <Input
                    id="nickname"
                    placeholder="ระบุชื่อเล่น"
                    value={formData.nickname}
                    onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">เพศ</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกเพศ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ชาย">ชาย</SelectItem>
                      <SelectItem value="หญิง">หญิง</SelectItem>
                      <SelectItem value="อื่นๆ">อื่นๆ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">สถานที่นั่งทำงาน</Label>
                  <Select
                    value={formData.location_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ระบุชั้น" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tel">เบอร์โทร</Label>
                  <Input
                    id="tel"
                    placeholder="0xx-xxx-xxxx"
                    value={formData.tel}
                    onChange={(e) => setFormData(prev => ({ ...prev, tel: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={createEmployee.isPending || updateEmployee.isPending || isUploading}>
                  {(createEmployee.isPending || updateEmployee.isPending) ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                ประวัติการครอบครองทรัพย์สิน
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-2 mt-2">
              {isTransLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : empTransactions && empTransactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รูป</TableHead>
                      <TableHead>รหัสทรัพย์สิน</TableHead>
                      <TableHead>ชื่อทรัพย์สิน</TableHead>
                      <TableHead>วันที่ยืม</TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          {tx.product_serials?.products?.image_url ? (
                            <img 
                              src={tx.product_serials.products.image_url} 
                              alt="Asset" 
                              className="h-8 w-8 rounded object-cover border" 
                            />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.product_serials?.serial_code}
                        </TableCell>
                        <TableCell className="text-sm">
                          {tx.product_serials?.products?.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(tx.borrow_date)}
                          {tx.return_date && (
                            <div className="text-emerald-600">
                              คืน: {formatDate(tx.return_date)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={tx.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mb-2 opacity-20" />
                  <p>ไม่พบประวัติการยืมอุปกรณ์</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Import CSV Dialog */}
        <ImportEmployeeDialog 
          isOpen={isImportDialogOpen} 
          onClose={() => setIsImportDialogOpen(false)} 
        />

      </div>
    </MainLayout>
  );
}