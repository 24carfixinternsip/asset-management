import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDepartments } from "@/hooks/useMasterData";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCog,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type UserAccount = Tables<"employees"> & {
  departments?: { name: string } | null;
  role?: string | null;
};

type FormMode = "create" | "edit" | "view";
type UserStatus = "active" | "inactive" | "pending";

type UserFormState = {
  name: string;
  email: string;
  tel: string;
  department_id: string;
  role: "admin" | "viewer";
  status: "active" | "inactive";
  password: string;
  sendInvite: boolean;
};

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let value = "";
  for (let i = 0; i < 12; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

const ROLE_LABELS: Record<"admin" | "viewer", string> = {
  admin: "ผู้ดูแลระบบ",
  viewer: "พนักงาน",
};

const STATUS_LABELS: Record<UserStatus, string> = {
  active: "ใช้งานอยู่",
  inactive: "ปิดใช้งาน",
  pending: "รอเชิญเข้าระบบ",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function Users() {
  const queryClient = useQueryClient();
  const { data: departments } = useDepartments();

  const adminClient = useMemo(
    () =>
      createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    [],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "viewer">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");

  const [formMode, setFormMode] = useState<FormMode>("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formState, setFormState] = useState<UserFormState>({
    name: "",
    email: "",
    tel: "",
    department_id: "",
    role: "viewer",
    status: "active",
    password: "",
    sendInvite: true,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["user-accounts"],
    queryFn: async () => {
    const { data: employees, error } = await (supabase as any)
      .from("employees")
      .select("*, departments(name)")
      .order("name");

      if (error) throw error;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap = new Map((rolesData ?? []).map((row) => [row.user_id, row.role]));
      return (employees ?? []).map((emp) => ({
        ...emp,
        role: emp.user_id ? roleMap.get(emp.user_id) ?? "viewer" : null,
      })) as UserAccount[];
    },
  });

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const roleValue = (user.role ?? "viewer") as "admin" | "viewer";
      const statusValue = (user.status ?? "active") as UserStatus;
      const matchesSearch =
        !search ||
        user.name.toLowerCase().includes(search) ||
        (user.email ?? "").toLowerCase().includes(search) ||
        (user.tel ?? "").toLowerCase().includes(search);
      const matchesRole = roleFilter === "all" || roleValue === roleFilter;
      const matchesStatus = statusFilter === "all" || statusValue === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const resetForm = () => {
    setFormState({
      name: "",
      email: "",
      tel: "",
      department_id: "",
      role: "viewer",
      status: "active",
      password: "",
      sendInvite: true,
    });
    setPasswordConfirm("");
    setFormErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSelectedUser(null);
  };

  const openCreate = () => {
    resetForm();
    setFormMode("create");
    setDialogOpen(true);
  };

  const openEdit = (user: UserAccount, mode: FormMode) => {
    setSelectedUser(user);
    setFormMode(mode);
    setFormState({
      name: user.name ?? "",
      email: user.email ?? "",
      tel: user.tel ?? "",
      department_id: user.department_id ?? "",
      role: (user.role ?? "viewer") as "admin" | "viewer",
      status: (user.status ?? "active") as "active" | "inactive",
      password: "",
      sendInvite: false,
    });
    setPasswordConfirm("");
    setFormErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setDialogOpen(true);
  };

  const validateForm = (forCreate: boolean) => {
    const errors: Record<string, string> = {};
    if (!formState.name.trim()) errors.name = "กรุณากรอกชื่อ-นามสกุล";
    if (forCreate) {
      if (!formState.email.trim()) errors.email = "กรุณากรอกอีเมล";
      else if (!EMAIL_REGEX.test(formState.email.trim())) errors.email = "อีเมลไม่ถูกต้อง";
    }
    if (!formState.department_id) errors.department_id = "กรุณาเลือกแผนก";
    if (forCreate && !formState.sendInvite) {
      if (!formState.password.trim()) errors.password = "กรุณากรอกรหัสผ่าน";
      else if (!PASSWORD_REGEX.test(formState.password.trim())) {
        errors.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีตัวอักษรกับตัวเลข";
      }
      if (!passwordConfirm.trim()) errors.passwordConfirm = "กรุณายืนยันรหัสผ่าน";
      else if (formState.password.trim() !== passwordConfirm.trim()) {
        errors.passwordConfirm = "รหัสผ่านไม่ตรงกัน";
      }
    }
    return errors;
  };

  const isFormValid = useMemo(() => {
    if (formMode === "view") return true;
    return Object.keys(validateForm(formMode === "create")).length === 0;
  }, [formMode, formState, passwordConfirm]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateForm(true);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const password = formState.sendInvite
        ? generateTempPassword()
        : formState.password.trim();

      if (!password) {
        toast.error("กรุณาตั้งรหัสผ่านหรือเลือกส่งลิงก์เชิญ");
        return;
      }

      const { data: existingEmployee } = await supabase
        .from("employees")
        .select("id, user_id")
        .eq("email", formState.email.trim())
        .maybeSingle();

      if (existingEmployee?.user_id) {
        toast.error("อีเมลนี้ถูกใช้งานแล้ว");
        return;
      }

      const { data, error } = await adminClient.auth.signUp({
        email: formState.email.trim(),
        password,
        options: {
          data: {
            name: formState.name.trim(),
            tel: formState.tel.trim() || null,
            department_id: formState.department_id || null,
          },
        },
      });

      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) throw new Error("ไม่สามารถสร้างบัญชีผู้ใช้ได้");

      if (existingEmployee) {
        const { error: updateError } = await supabase
          .from("employees")
          .update({
            name: formState.name.trim(),
            tel: formState.tel.trim() || null,
            department_id: formState.department_id || null,
            status: formState.status,
            user_id: userId,
          })
          .eq("id", existingEmployee.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("employees")
          .insert({
            name: formState.name.trim(),
            email: formState.email.trim(),
            tel: formState.tel.trim() || null,
            department_id: formState.department_id || null,
            status: formState.status,
            user_id: userId,
          });

        if (insertError) throw insertError;
      }

      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole) {
        await supabase
          .from("user_roles")
          .update({ role: formState.role })
          .eq("user_id", userId);
      } else {
        await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: formState.role });
      }

      if (formState.sendInvite) {
        await adminClient.auth.resetPasswordForEmail(formState.email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      }

      toast.success("สร้างผู้ใช้สำเร็จ");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["user-accounts"] });
    } catch (error: any) {
      console.error(error);
      const message = String(error?.message ?? "");
      if (message.toLowerCase().includes("already") || message.toLowerCase().includes("duplicate")) {
        toast.error("อีเมลนี้ถูกใช้งานแล้ว");
      } else {
        toast.error(message || "สร้างผู้ใช้ไม่สำเร็จ");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;

    const errors = validateForm(false);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          name: formState.name.trim(),
          tel: formState.tel.trim() || null,
          department_id: formState.department_id || null,
          status: formState.status,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      if (selectedUser.user_id) {
        await supabase
          .from("user_roles")
          .update({ role: formState.role })
          .eq("user_id", selectedUser.user_id);
      }

      toast.success("อัปเดตข้อมูลผู้ใช้สำเร็จ");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["user-accounts"] });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "อัปเดตข้อมูลผู้ใช้ไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    const nextStatus = (user.status ?? "active") === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase
        .from("employees")
        .update({ status: nextStatus })
        .eq("id", user.id);

      if (error) throw error;
      toast.success(nextStatus === "active" ? "เปิดใช้งานผู้ใช้แล้ว" : "ปิดใช้งานผู้ใช้แล้ว");
      queryClient.invalidateQueries({ queryKey: ["user-accounts"] });
    } catch (error: any) {
      toast.error(error.message || "อัปเดตสถานะไม่สำเร็จ");
    }
  };

  const handleResetPassword = async (email?: string | null) => {
    if (!email) {
      toast.error("ไม่พบอีเมลของผู้ใช้");
      return;
    }
    try {
      await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast.success("ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว");
    } catch (error: any) {
      toast.error(error.message || "ส่งลิงก์รีเซ็ตรหัสผ่านไม่สำเร็จ");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from("employees")
        .update({ status: "inactive" })
        .eq("id", deleteTarget.id);

      if (error) throw error;
      toast.success("ลบผู้ใช้สำเร็จ");
      setDeleteOpen(false);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["user-accounts"] });
    } catch (error: any) {
      toast.error(error.message || "ลบผู้ใช้ไม่สำเร็จ");
    }
  };

  const handleCopyPassword = async () => {
    if (!formState.password) return;
    try {
      await navigator.clipboard.writeText(formState.password);
      toast.success("คัดลอกรหัสผ่านแล้ว");
    } catch (error: any) {
      toast.error(error?.message || "คัดลอกรหัสผ่านไม่สำเร็จ");
    }
  };

  const handleGeneratePassword = () => {
    const generated = generateTempPassword();
    setFormState((prev) => ({ ...prev, password: generated }));
    setPasswordConfirm(generated);
  };

  return (
    <MainLayout title="Users">
      <div className="space-y-6">
        <Card className="border border-border/60 bg-card/80 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600">
                <UserCog className="h-3.5 w-3.5" />
                สิทธิ์ผู้ดูแล
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">จัดการผู้ใช้งาน</h2>
              <p className="text-sm text-muted-foreground">
                สร้างและจัดการบัญชีพนักงานสำหรับการเบิกทรัพย์สิน
              </p>
            </div>
            <Button className="h-10 gap-2 rounded-full" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              เพิ่มผู้ใช้
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/80 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">ค้นหา</Label>
                <Input
                  placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="w-full md:w-[180px] space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">บทบาท</Label>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="ทุกบทบาท" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                    <SelectItem value="viewer">พนักงาน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-[180px] space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">สถานะ</Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="ทุกสถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="active">ใช้งานอยู่</SelectItem>
                    <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
                    <SelectItem value="pending">รอเชิญเข้าระบบ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="h-10 gap-2"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["user-accounts"] })}
              >
                <RefreshCw className="h-4 w-4" />
                รีเฟรช
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/80 shadow-sm">
          <CardContent className="p-0">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ผู้ใช้</TableHead>
                    <TableHead>แผนก</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">การทำงาน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        กำลังโหลดรายการผู้ใช้...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        ไม่พบรายการผู้ใช้
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const roleValue = (user.role ?? "viewer") as "admin" | "viewer";
                      const statusValue = (user.status ?? "active") as UserStatus;
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{user.name ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{user.email ?? "-"}</div>
                              {user.tel && <div className="text-xs text-muted-foreground">{user.tel}</div>}
                            </div>
                          </TableCell>
                          <TableCell>{user.departments?.name ?? "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-3",
                                roleValue === "admin"
                                  ? "border-orange-200 bg-orange-50 text-orange-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700",
                              )}
                            >
                              {ROLE_LABELS[roleValue]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-3",
                                statusValue === "active"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : statusValue === "pending"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-slate-200 bg-slate-50 text-slate-700",
                              )}
                            >
                              {STATUS_LABELS[statusValue]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="User actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(user, "view")}>
                                  ดูรายละเอียด
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(user, "edit")}>
                                  แก้ไข
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                                  {statusValue === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleResetPassword(user.email)}>
                                  ส่งลิงก์รีเซ็ตรหัสผ่าน
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-rose-600"
                                  onClick={() => {
                                    setDeleteTarget(user);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  ลบผู้ใช้
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 p-4 md:hidden">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">กำลังโหลดรายการผู้ใช้...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">ไม่พบรายการผู้ใช้</div>
              ) : (
                filteredUsers.map((user) => {
                  const roleValue = (user.role ?? "viewer") as "admin" | "viewer";
                  const statusValue = (user.status ?? "active") as UserStatus;
                  return (
                    <Card key={user.id} className="border border-border/60">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold">{user.name ?? "-"}</div>
                            <div className="text-xs text-muted-foreground">{user.email ?? "-"}</div>
                            {user.tel && <div className="text-xs text-muted-foreground">{user.tel}</div>}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(user, "view")}>
                                ดูรายละเอียด
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(user, "edit")}>แก้ไข</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                                {statusValue === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetPassword(user.email)}>
                                ส่งลิงก์รีเซ็ตรหัสผ่าน
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-rose-600"
                                onClick={() => {
                                  setDeleteTarget(user);
                                  setDeleteOpen(true);
                                }}
                              >
                                ลบผู้ใช้
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full px-3">
                            {ROLE_LABELS[roleValue]}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3",
                              statusValue === "active"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : statusValue === "pending"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700",
                            )}
                          >
                            {STATUS_LABELS[statusValue]}
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3">
                            {user.departments?.name ?? "ไม่ระบุแผนก"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formMode === "create" ? <UserCog className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              {formMode === "create" && "เพิ่มผู้ใช้"}
              {formMode === "edit" && "แก้ไขผู้ใช้"}
              {formMode === "view" && "รายละเอียดผู้ใช้"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {formMode === "create" && "กรอกข้อมูลพนักงานเพื่อสร้างบัญชีสำหรับการเบิกทรัพย์สิน"}
              {formMode === "edit" && "อัปเดตข้อมูลผู้ใช้งานให้ถูกต้อง"}
              {formMode === "view" && "รายละเอียดข้อมูลผู้ใช้งาน"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={formMode === "create" ? handleCreate : handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อ-นามสกุล</Label>
              <Input
                id="name"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                disabled={formMode === "view"}
                required
              />
              {formErrors.name && <p className="text-xs text-rose-600">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                disabled={formMode !== "create"}
                required
              />
              {formErrors.email && <p className="text-xs text-rose-600">{formErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tel">เบอร์โทร</Label>
              <Input
                id="tel"
                value={formState.tel}
                onChange={(event) => setFormState((prev) => ({ ...prev, tel: event.target.value }))}
                disabled={formMode === "view"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>บทบาท</Label>
                <Select
                  value={formState.role}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, role: value as "admin" | "viewer" }))
                  }
                  disabled={formMode === "view"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกบทบาท" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                    <SelectItem value="viewer">พนักงาน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>สถานะ</Label>
                <Select
                  value={formState.status}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, status: value as "active" | "inactive" }))
                  }
                  disabled={formMode === "view"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">ใช้งานอยู่</SelectItem>
                    <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>แผนก</Label>
              <Select
                value={formState.department_id}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, department_id: value }))}
                disabled={formMode === "view"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกแผนก" />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.department_id && <p className="text-xs text-rose-600">{formErrors.department_id}</p>}
            </div>

            {formMode === "create" && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label className="text-xs font-medium text-muted-foreground">ตั้งค่าการเข้าถึง</Label>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setFormState((prev) => ({ ...prev, sendInvite: true }))}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                      formState.sendInvite
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-border bg-background",
                    )}
                  >
                    <span>ส่งลิงก์เชิญเข้าระบบ</span>
                    {formState.sendInvite && <Check className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState((prev) => ({ ...prev, sendInvite: false }))}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                      !formState.sendInvite
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-border bg-background",
                    )}
                  >
                    <span>ตั้งรหัสผ่านเริ่มต้น</span>
                    {!formState.sendInvite && <Check className="h-4 w-4" />}
                  </button>
                </div>

                {!formState.sendInvite && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="password">รหัสผ่านเริ่มต้น</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={formState.password}
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, password: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-2 text-muted-foreground"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {formErrors.password && <p className="text-xs text-rose-600">{formErrors.password}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passwordConfirm">ยืนยันรหัสผ่าน</Label>
                      <div className="relative">
                        <Input
                          id="passwordConfirm"
                          type={showConfirmPassword ? "text" : "password"}
                          value={passwordConfirm}
                          onChange={(event) => setPasswordConfirm(event.target.value)}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-2 text-muted-foreground"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {formErrors.passwordConfirm && (
                        <p className="text-xs text-rose-600">{formErrors.passwordConfirm}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="h-9" onClick={handleGeneratePassword}>
                        สร้างรหัสผ่าน
                      </Button>
                      <Button type="button" variant="outline" className="h-9 gap-2" onClick={handleCopyPassword}>
                        <Copy className="h-4 w-4" />
                        คัดลอก
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                ปิด
              </Button>
              {formMode !== "view" && (
                <Button type="submit" disabled={isSubmitting || !isFormValid}>
                  {isSubmitting ? "กำลังบันทึก..." : formMode === "create" ? "สร้างผู้ใช้" : "บันทึก"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบผู้ใช้</AlertDialogTitle>
            <AlertDialogDescription>
              การลบจะทำให้ผู้ใช้นี้ไม่สามารถเข้าใช้งานได้อีก คุณต้องการดำเนินการต่อหรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>ลบผู้ใช้</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
