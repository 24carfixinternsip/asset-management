import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDepartments, useEmployees, type Employee as EmployeeRecord } from "@/hooks/useMasterData";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveFilters } from "@/components/shared/ResponsiveFilters";
import { ResponsiveTable } from "@/components/shared/ResponsiveTable";
import type { Database } from "@/integrations/supabase/types";
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

type Role = "employee" | "admin";

type UserAccount = EmployeeRecord;

type FormMode = "create" | "edit" | "view";
type UserStatus = "active" | "inactive" | "pending";

type UserFormState = {
  name: string;
  email: string;
  tel: string;
  department_id: string;
  role: Role;
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

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  employee: "Employee",
};

const normalizeRole = (role?: string | null): Role => (role === "admin" ? "admin" : "employee");

const STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending Invitation",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function Users() {
  const queryClient = useQueryClient();
  const { data: departments } = useDepartments();
  const {
    data: employees = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useEmployees();

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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const [formMode, setFormMode] = useState<FormMode>("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
    role: "employee",
    status: "active",
    password: "",
    sendInvite: true,
  });

  // Show all employee names from the source of truth (employees/view_users_full),
  // not only rows already linked to auth.user.
  const users = useMemo(() => employees, [employees]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const usersErrorMessage = useMemo(() => {
    if (!isError) return null;
    if (error instanceof Error) return error.message;
    return "Failed to load users. Please try again.";
  }, [error, isError]);

  const filteredUsers = useMemo(() => {
    const search = debouncedSearchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const roleValue = normalizeRole(user.role);
      const statusValue = (user.status ?? "active") as UserStatus;
      const matchesSearch =
        !search ||
        user.name.toLowerCase().includes(search) ||
        (user.nickname ?? "").toLowerCase().includes(search) ||
        (user.emp_code ?? "").toLowerCase().includes(search) ||
        (user.email ?? "").toLowerCase().includes(search) ||
        (user.tel ?? "").toLowerCase().includes(search);
      const matchesRole = roleFilter === "all" || roleValue === roleFilter;
      const matchesStatus = statusFilter === "all" || statusValue === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, debouncedSearchTerm, roleFilter, statusFilter]);

  const resetForm = () => {
    setFormState({
      name: "",
      email: "",
      tel: "",
      department_id: "",
      role: "employee",
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
      role: normalizeRole(user.role),
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
    if (!formState.name.trim()) errors.name = "Please enter full name";
    if (forCreate) {
      if (!formState.email.trim()) errors.email = "Please enter email";
      else if (!EMAIL_REGEX.test(formState.email.trim())) errors.email = "Invalid email format";
    }
    if (!formState.department_id) errors.department_id = "Please select department";
    if (forCreate && !formState.sendInvite) {
      if (!formState.password.trim()) errors.password = "Please enter password";
      else if (!PASSWORD_REGEX.test(formState.password.trim())) {
        errors.password = "Password must be at least 8 chars with letters and numbers";
      }
      if (!passwordConfirm.trim()) errors.passwordConfirm = "Please confirm password";
      else if (formState.password.trim() !== passwordConfirm.trim()) {
        errors.passwordConfirm = "Passwords do not match";
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
        toast.error("Please set a password or choose invite link");
        return;
      }

      const { data: employeeCandidates, error: existingEmployeeError } = await supabase
        .from("employees")
        .select("id, user_id")
        .eq("email", formState.email.trim())
        .order("created_at", { ascending: false })
        .limit(2);

      if (existingEmployeeError) throw existingEmployeeError;

      if (employeeCandidates && employeeCandidates.length > 1) {
        throw new Error("พบพนักงานที่ใช้อีเมลซ้ำในระบบ กรุณาตรวจสอบข้อมูลก่อน");
      }

      const existingEmployee = employeeCandidates?.[0] ?? null;

      if (existingEmployee?.user_id) {
        toast.error("This email is already in use");
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
      if (!userId) throw new Error("Could not create auth user");

      if (existingEmployee) {
        const { data: updatedRows, error: updateError } = await supabase
          .from("employees")
          .update({
            name: formState.name.trim(),
            tel: formState.tel.trim() || null,
            department_id: formState.department_id || null,
            status: formState.status,
            role: formState.role,
            user_id: userId,
          })
          .eq("id", existingEmployee.id)
          .select("id");

        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length !== 1) {
          throw new Error("ไม่สามารถผูกบัญชีผู้ใช้กับพนักงานได้");
        }
      } else {
        const { error: insertError } = await supabase
          .from("employees")
          .insert({
            name: formState.name.trim(),
            email: formState.email.trim(),
            tel: formState.tel.trim() || null,
            department_id: formState.department_id || null,
            status: formState.status,
            role: formState.role,
            user_id: userId,
          });

        if (insertError) throw insertError;
      }

      if (formState.sendInvite) {
        await adminClient.auth.resetPasswordForEmail(formState.email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      }

      toast.success("User created successfully");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (error: any) {
      console.error(error);
      const message = String(error?.message ?? "");
      if (message.toLowerCase().includes("already") || message.toLowerCase().includes("duplicate")) {
        toast.error("This email is already in use");
      } else {
        toast.error(message || "Failed to create user");
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
      const { data: updatedRows, error } = await supabase
        .from("employees")
        .update({
          name: formState.name.trim(),
          tel: formState.tel.trim() || null,
          department_id: formState.department_id || null,
          status: formState.status,
          role: formState.role,
        })
        .eq("id", selectedUser.id)
        .select("id");

      if (error) throw error;
      if (!updatedRows || updatedRows.length !== 1) {
        throw new Error("ไม่พบผู้ใช้ที่ต้องการอัปเดตหรือไม่มีสิทธิ์");
      }

      toast.success("User updated successfully");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    const nextStatus = (user.status ?? "active") === "active" ? "inactive" : "active";
    try {
      const { data: updatedRows, error } = await supabase
        .from("employees")
        .update({ status: nextStatus })
        .eq("id", user.id)
        .select("id, status");

      if (error) throw error;
      if (!updatedRows || updatedRows.length !== 1) {
        throw new Error("ไม่สามารถอัปเดตสถานะผู้ใช้ได้");
      }
      toast.success(nextStatus === "active" ? "User activated" : "User deactivated");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const handleResetPassword = async (email?: string | null) => {
    if (!email) {
      toast.error("User email not found");
      return;
    }
    try {
      await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast.success("Password reset link sent");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset link");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget || isDeleting) return;
    const employeeId = deleteTarget.id;
    let previousUsers: UserAccount[] | undefined;

    try {
      setIsDeleting(true);

      // Optimistic UI update: switch to inactive immediately, rollback if request fails.
      previousUsers = queryClient.getQueryData<UserAccount[]>(["employees"]);
      queryClient.setQueryData<UserAccount[]>(["employees"], (current = []) =>
        current.filter((user) => user.id !== employeeId),
      );

      const runDelete = async () =>
        supabase.from("employees").delete().eq("id", employeeId).select("id");

      let { data: deletedRows, error: deleteError } = await runDelete();

      if (deleteError) {
        const message = (deleteError.message ?? "").toLowerCase();
        const blockedByForeignKey = deleteError.code === "23503" || message.includes("foreign key");

        if (!blockedByForeignKey) {
          console.error("Delete user Supabase error:", deleteError);
          throw deleteError;
        }

        const { error: unlinkTransactionError } = await supabase
          .from("transactions")
          .update({ employee_id: null })
          .eq("employee_id", employeeId);

        if (unlinkTransactionError) {
          console.error("Unlink user transactions failed:", unlinkTransactionError);
          throw new Error("ลบไม่ได้ เนื่องจากพนักงานถูกอ้างอิงในรายการยืมและไม่สามารถเคลียร์การอ้างอิงได้");
        }

        const retryResult = await runDelete();
        deletedRows = retryResult.data;
        deleteError = retryResult.error;
        if (deleteError) {
          console.error("Delete user retry failed:", deleteError);
          throw deleteError;
        }
      }

      if (!deletedRows || deletedRows.length !== 1) {
        console.error("Delete user failed: unexpected deleted rows", { employeeId, deletedRows });
        throw new Error("Failed to delete user: row not found or no permission");
      }

      toast.success("User deleted successfully");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (error) {
      console.error("Delete user handler failed:", error);
      if (previousUsers) {
        queryClient.setQueryData(["employees"], previousUsers);
      }
      const message = error instanceof Error ? error.message : "Failed to deactivate user";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!formState.password) return;
    try {
      await navigator.clipboard.writeText(formState.password);
      toast.success("Password copied");
    } catch (error: any) {
      toast.error(error?.message || "Failed to copy password");
    }
  };

  const handleGeneratePassword = () => {
    const generated = generateTempPassword();
    setFormState((prev) => ({ ...prev, password: generated }));
    setPasswordConfirm(generated);
  };

  const renderUserActions = (user: UserAccount) => {
    const statusValue = (user.status ?? "active") as UserStatus;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:h-9 md:w-9"
            aria-label="เมนูการจัดการผู้ใช้"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => openEdit(user, "view")}>ดูรายละเอียด</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEdit(user, "edit")}>แก้ไข</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleResetPassword(user.email)}>รีเซ็ตรหัสผ่าน</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
            {statusValue === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="จัดการบัญชีพนักงานและสิทธิ์การเข้าถึงสำหรับระบบสต็อก"
          eyebrow={
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600">
              <UserCog className="h-3.5 w-3.5" />
              Admin Access
            </div>
          }
          actions={
            <Button className="hidden h-11 gap-2 rounded-full md:inline-flex" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          }
        />

        <ResponsiveFilters
          sticky
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือรหัสพนักงาน"
          searchAriaLabel="ค้นหาผู้ใช้"
          actions={
            <>
              <Button
                variant="outline"
                className="h-11 gap-2 md:h-10"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw className="h-4 w-4" />
                {isFetching ? "Refreshing..." : "Refresh"}
              </Button>
              <Button className="h-11 gap-2 md:hidden" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </>
          }
          filters={
            <>
              <div className="w-[180px] space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Role</Label>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[180px] space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          }
          mobileFilters={
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Role</Label>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          }
          onClear={clearFilters}
        />

        <Card className="border border-border/60 bg-card/80 shadow-sm">
          <CardContent className="p-0">
            <ResponsiveTable
              table={
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isError ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          <div className="space-y-3">
                            <p>{usersErrorMessage}</p>
                            <Button variant="outline" size="sm" onClick={() => void refetch()}>
                              Retry
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          Loading users...
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        const roleValue = normalizeRole(user.role);
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
                            <TableCell className="text-right">{renderUserActions(user)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              }
              stacked={
                <div className="grid gap-3 p-4">
                  {isError ? (
                    <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
                      <p>{usersErrorMessage}</p>
                      <Button variant="outline" size="sm" onClick={() => void refetch()}>
                        Retry
                      </Button>
                    </div>
                  ) : isLoading ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Loading users...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No users found</div>
                  ) : (
                    filteredUsers.map((user) => {
                      const roleValue = normalizeRole(user.role);
                      const statusValue = (user.status ?? "active") as UserStatus;
                      return (
                        <div key={user.id} className="rounded-xl border border-border/60 bg-background p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="font-semibold">{user.name ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{user.email ?? "-"}</div>
                              {user.tel && <div className="text-xs text-muted-foreground">{user.tel}</div>}
                            </div>
                            <div className="shrink-0">{renderUserActions(user)}</div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
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
                              {user.departments?.name ?? "Unassigned"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              }
            />
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
              {formMode === "create" && "Add User"}
              {formMode === "edit" && "Edit User"}
              {formMode === "view" && "User Details"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {formMode === "create" && "Enter employee info to create an account"}
              {formMode === "edit" && "Update user profile and access settings"}
              {formMode === "view" && "Read-only account information"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={formMode === "create" ? handleCreate : handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
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
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="tel">Phone</Label>
              <Input
                id="tel"
                value={formState.tel}
                onChange={(event) => setFormState((prev) => ({ ...prev, tel: event.target.value }))}
                disabled={formMode === "view"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formState.role}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, role: value as Role }))
                  }
                  disabled={formMode === "view"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formState.status}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, status: value as "active" | "inactive" }))
                  }
                  disabled={formMode === "view"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formState.department_id}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, department_id: value }))}
                disabled={formMode === "view"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
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
                <Label className="text-xs font-medium text-muted-foreground">Access Setup</Label>
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
                    <span>Send invitation link</span>
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
                    <span>Set initial password</span>
                    {!formState.sendInvite && <Check className="h-4 w-4" />}
                  </button>
                </div>

                {!formState.sendInvite && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="password">Initial Password</Label>
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
                      <Label htmlFor="passwordConfirm">Confirm Password</Label>
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
                        Generate Password
                      </Button>
                      <Button type="button" variant="outline" className="h-9 gap-2" onClick={handleCopyPassword}>
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Close
              </Button>
              {formMode !== "view" && (
                <Button type="submit" disabled={isSubmitting || !isFormValid}>
                  {isSubmitting ? "Saving..." : formMode === "create" ? "Create User" : "Save"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm User Deactivation</AlertDialogTitle>
            <AlertDialogDescription>
              This user will be marked inactive and will lose access. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={isDeleting}>
              {isDeleting ? "Processing..." : "Deactivate User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
