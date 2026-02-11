import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, KeyRound, MoreHorizontal, Pencil, Plus, Power, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDepartments, useEmployees } from "@/hooks/useMasterData";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { AddUserModal } from "@/components/users/AddUserModal";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { UsersCards } from "@/components/users/UsersCards";
import { UsersTable } from "@/components/users/UsersTable";
import { UsersToolbar } from "@/components/users/UsersToolbar";
import type { FormMode, UserAccount, UserFormValues, UserStatus } from "@/components/users/types";
import {
  createUserFormValuesFromUser,
  generateTempPassword,
  normalizeRole,
  normalizeStatus,
  sortUsersByName,
  toFriendlyErrorMessage,
  toSearchableUserText,
} from "@/components/users/users-utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function mapSupabaseArrayError(error: { message?: string; code?: string | null }) {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return "You do not have permission to perform this action";
  }
  return error.message || "Operation failed";
}

function getDepartmentNameById(departmentId: string | null | undefined, usersDepartments: ReturnType<typeof useDepartments>["data"]) {
  if (!departmentId) return null;
  return usersDepartments?.find((department) => department.id === departmentId)?.name ?? null;
}

function buildOptimisticUser(values: {
  id: string;
  name: string;
  email: string;
  tel: string | null;
  department_id: string | null;
  role: string;
  status: string;
  user_id: string | null;
  departmentName: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}): UserAccount {
  const now = new Date().toISOString();

  return {
    id: values.id,
    emp_code: null,
    name: values.name,
    nickname: null,
    gender: null,
    email: values.email,
    tel: values.tel,
    image_url: null,
    location: null,
    location_id: null,
    department_id: values.department_id,
    user_id: values.user_id,
    status: values.status,
    created_at: values.created_at ?? now,
    updated_at: values.updated_at ?? now,
    role: values.role,
    account_role: values.role,
    employee_role: values.role,
    departments: values.departmentName ? { name: values.departmentName } : null,
    locations: null,
  };
}

const normalizeEmailKey = (email?: string | null) => (email ?? "").trim().toLowerCase();

const toComparableTime = (value?: string | null) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

function pickPreferredUser(current: UserAccount, incoming: UserAccount): UserAccount {
  const currentTime = Math.max(toComparableTime(current.updated_at), toComparableTime(current.created_at));
  const incomingTime = Math.max(toComparableTime(incoming.updated_at), toComparableTime(incoming.created_at));

  if (incomingTime >= currentTime) {
    return { ...current, ...incoming };
  }

  return { ...incoming, ...current };
}

// Dedupe the users list by id as primary key.
// If id is missing, fallback to normalized email key to avoid transient duplicates.
function dedupeById(users: UserAccount[]): UserAccount[] {
  const byKey = new Map<string, UserAccount>();
  const keyOrder: string[] = [];

  users.forEach((user, index) => {
    const stableId = (user.id ?? "").trim();
    const emailKey = normalizeEmailKey(user.email);
    const key = stableId ? `id:${stableId}` : emailKey ? `email:${emailKey}` : `fallback:${index}`;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, user);
      keyOrder.push(key);
      return;
    }

    byKey.set(key, pickPreferredUser(existing, user));
  });

  return keyOrder.map((key) => byKey.get(key)!);
}

export default function Users() {
  const queryClient = useQueryClient();
  const { data: departments } = useDepartments();
  const {
    data: employees = [],
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
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
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "employee">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const createRequestCounterRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const usersErrorMessage = useMemo(() => {
    if (!isError) return null;
    if (error instanceof Error) {
      return toFriendlyErrorMessage(error, "Failed to load users");
    }
    return "Failed to load users";
  }, [error, isError]);

  const dedupedEmployees = useMemo(() => dedupeById(employees), [employees]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const duplicateCount = employees.length - dedupedEmployees.length;
    if (duplicateCount > 0) {
      console.debug("[Users] dedupeById removed duplicates", {
        originalLength: employees.length,
        dedupedLength: dedupedEmployees.length,
        duplicateCount,
      });
    }
  }, [dedupedEmployees.length, employees.length]);

  const filteredUsers = useMemo(() => {
    const keyword = debouncedSearchTerm.trim().toLowerCase();

    return dedupedEmployees.filter((user) => {
      const matchesSearch = !keyword || toSearchableUserText(user).includes(keyword);
      const matchesRole = roleFilter === "all" || normalizeRole(user.role) === roleFilter;
      const matchesStatus = statusFilter === "all" || normalizeStatus(user.status) === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [debouncedSearchTerm, dedupedEmployees, roleFilter, statusFilter]);

  const initialModalValues = useMemo<Partial<UserFormValues> | undefined>(() => {
    if (!selectedUser) return undefined;
    return createUserFormValuesFromUser(selectedUser);
  }, [selectedUser]);

  const clearFilters = () => {
    setRoleFilter("all");
    setStatusFilter("all");
    setSearchTerm("");
  };

  const openCreate = () => {
    setSubmitError(null);
    setSelectedUser(null);
    setFormMode("create");
    setModalOpen(true);
  };

  const openEdit = (user: UserAccount, mode: Exclude<FormMode, "create">) => {
    setSubmitError(null);
    setSelectedUser(user);
    setFormMode(mode);
    setModalOpen(true);
  };

  const closeModal = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setSubmitError(null);
      setIsSubmitting(false);
      if (formMode === "create") {
        setSelectedUser(null);
      }
    }
  };

  const upsertUserCache = (nextUser: UserAccount) => {
    queryClient.setQueryData<UserAccount[]>(["employees"], (current = []) => {
      const merged = sortUsersByName(dedupeById([nextUser, ...current]));
      if (import.meta.env.DEV) {
        console.debug("[Users] cache upsert", {
          nextUserId: nextUser.id,
          nextUserEmail: normalizeEmailKey(nextUser.email),
          beforeLength: current.length,
          afterLength: merged.length,
        });
      }
      return merged;
    });
  };

  const handleCreate = async (values: UserFormValues) => {
    const email = values.email.trim().toLowerCase();
    const name = values.name.trim();
    const tel = values.tel.trim() || null;
    const departmentId = values.department_id || null;

    const password = values.setupMode === "invite"
      ? generateTempPassword()
      : values.password.trim();

    if (!password) {
      throw new Error("Please set a password or choose invitation link");
    }

    if (import.meta.env.DEV) {
      const nextCount = (createRequestCounterRef.current.get(email) ?? 0) + 1;
      createRequestCounterRef.current.set(email, nextCount);
      console.debug("[Users] create request", { email, countForEmail: nextCount });
    }

    const { data: employeeCandidates, error: existingEmployeeError } = await supabase
      .from("employees")
      .select("id, user_id, created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(2);

    if (existingEmployeeError) throw new Error(mapSupabaseArrayError(existingEmployeeError));

    if ((employeeCandidates?.length ?? 0) > 1) {
      throw new Error("Duplicate employee records found for this email");
    }

    const existingEmployee = employeeCandidates?.[0] ?? null;

    if (existingEmployee?.user_id) {
      throw new Error("This email is already in use");
    }

    const { data: signUpData, error: signUpError } = await adminClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          tel,
          department_id: departmentId,
        },
      },
    });

    if (signUpError) throw new Error(toFriendlyErrorMessage(signUpError, "Failed to create user account"));

    const userId = signUpData.user?.id;
    if (!userId) throw new Error("Failed to create user account");

    let employeeId = "";
    let employeeCreatedAt: string | null = null;
    let employeeUpdatedAt: string | null = null;

    if (existingEmployee) {
      const { data: updatedRows, error: updateError } = await supabase
        .from("employees")
        .update({
          name,
          tel,
          department_id: departmentId,
          status: values.status,
          role: values.role,
          user_id: userId,
        })
        .eq("id", existingEmployee.id)
        .select("id, created_at, updated_at")
        .limit(1);

      if (updateError) throw new Error(mapSupabaseArrayError(updateError));
      if (!updatedRows || updatedRows.length !== 1) {
        throw new Error("Could not link auth account to existing employee record");
      }

      employeeId = updatedRows[0].id;
      employeeCreatedAt = updatedRows[0].created_at ?? null;
      employeeUpdatedAt = updatedRows[0].updated_at ?? null;
    } else {
      const { data: insertedRows, error: insertError } = await supabase
        .from("employees")
        .insert({
          name,
          email,
          tel,
          department_id: departmentId,
          status: values.status,
          role: values.role,
          user_id: userId,
        })
        .select("id, created_at, updated_at")
        .limit(1);

      if (insertError) throw new Error(mapSupabaseArrayError(insertError));
      if (!insertedRows || insertedRows.length !== 1) {
        throw new Error("Could not create employee record");
      }

      employeeId = insertedRows[0].id;
      employeeCreatedAt = insertedRows[0].created_at ?? null;
      employeeUpdatedAt = insertedRows[0].updated_at ?? null;
    }

    if (values.setupMode === "invite") {
      const { error: inviteError } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (inviteError) throw new Error(toFriendlyErrorMessage(inviteError, "Failed to send invitation link"));
    }

    const optimisticUser = buildOptimisticUser({
      id: employeeId,
      name,
      email,
      tel,
      department_id: departmentId,
      role: values.role,
      status: values.status,
      user_id: userId,
      departmentName: getDepartmentNameById(departmentId, departments),
      created_at: employeeCreatedAt,
      updated_at: employeeUpdatedAt,
    });

    upsertUserCache(optimisticUser);
    await queryClient.invalidateQueries({ queryKey: ["employees"] });
  };

  const handleUpdate = async (values: UserFormValues) => {
    if (!selectedUser) throw new Error("User to update was not found");

    const name = values.name.trim();
    const tel = values.tel.trim() || null;
    const departmentId = values.department_id || null;

    const { data: updatedRows, error: updateError } = await supabase
      .from("employees")
      .update({
        name,
        tel,
        department_id: departmentId,
        status: values.status,
        role: values.role,
      })
      .eq("id", selectedUser.id)
      .select("id, updated_at")
      .limit(1);

    if (updateError) throw new Error(mapSupabaseArrayError(updateError));
    if (!updatedRows || updatedRows.length !== 1) {
      throw new Error("User not found or you do not have permission");
    }

    const optimisticUser = buildOptimisticUser({
      id: selectedUser.id,
      name,
      email: selectedUser.email ?? values.email.trim(),
      tel,
      department_id: departmentId,
      role: values.role,
      status: values.status,
      user_id: selectedUser.user_id,
      departmentName: getDepartmentNameById(departmentId, departments),
      created_at: selectedUser.created_at,
      updated_at: updatedRows[0].updated_at ?? new Date().toISOString(),
    });

    upsertUserCache(optimisticUser);
    await queryClient.invalidateQueries({ queryKey: ["employees"] });
  };

  const handleModalSubmit = async (values: UserFormValues) => {
    if (isSubmitting) return;

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      if (formMode === "create") {
        await handleCreate(values);
        toast.success("User created successfully");
      } else {
        await handleUpdate(values);
        toast.success("User updated successfully");
      }

      setModalOpen(false);
      setSelectedUser(null);
    } catch (submitErr) {
      const fallback = formMode === "create" ? "Failed to create user" : "Failed to update user";
      const message = toFriendlyErrorMessage(submitErr, fallback);
      setSubmitError(message);
      toast.error(message);
      throw submitErr;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (email?: string | null) => {
    if (!email) {
      toast.error("User email was not found");
      return;
    }

    try {
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;
      toast.success("Password reset link sent");
    } catch (resetErr) {
      toast.error(toFriendlyErrorMessage(resetErr, "Failed to send reset link"));
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    const nextStatus = normalizeStatus(user.status) === "active" ? "inactive" : "active";
    const previousUsers = queryClient.getQueryData<UserAccount[]>(["employees"]);

    queryClient.setQueryData<UserAccount[]>(["employees"], (current = []) =>
      dedupeById(current).map((item) => (item.id === user.id ? { ...item, status: nextStatus } : item)),
    );

    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from("employees")
        .update({ status: nextStatus })
        .eq("id", user.id)
        .select("id, status")
        .limit(1);

      if (updateError) throw new Error(mapSupabaseArrayError(updateError));
      if (!updatedRows || updatedRows.length !== 1) {
        throw new Error("Could not update user status");
      }

      toast.success(nextStatus === "active" ? "User activated" : "User deactivated");
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (toggleErr) {
      if (previousUsers) {
        queryClient.setQueryData(["employees"], previousUsers);
      }
      toast.error(toFriendlyErrorMessage(toggleErr, "Failed to update user status"));
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget || isDeleting) return;

    const employeeId = deleteTarget.id;
    const previousUsers = queryClient.getQueryData<UserAccount[]>(["employees"]);

    setIsDeleting(true);

    queryClient.setQueryData<UserAccount[]>(["employees"], (current = []) =>
      dedupeById(current).filter((user) => user.id !== employeeId),
    );

    try {
      const runDelete = async () => supabase.from("employees").delete().eq("id", employeeId).select("id");

      let { data: deletedRows, error: deleteError } = await runDelete();

      if (deleteError) {
        const message = (deleteError.message ?? "").toLowerCase();
        const blockedByForeignKey = deleteError.code === "23503" || message.includes("foreign key");

        if (deleteError.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
          throw new Error("You do not have permission to delete this user");
        }

        if (!blockedByForeignKey) {
          throw new Error(mapSupabaseArrayError(deleteError));
        }

        const { error: unlinkError } = await supabase
          .from("transactions")
          .update({ employee_id: null })
          .eq("employee_id", employeeId);

        if (unlinkError) {
          throw new Error(
            "Unable to delete user because related transactions could not be detached",
          );
        }

        const retryResult = await runDelete();
        deletedRows = retryResult.data;
        deleteError = retryResult.error;

        if (deleteError) {
          throw new Error(mapSupabaseArrayError(deleteError));
        }
      }

      if (!deletedRows || deletedRows.length !== 1) {
        throw new Error("Delete failed: user not found or not permitted");
      }

      toast.success("User deleted successfully");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (deleteErr) {
      if (previousUsers) {
        queryClient.setQueryData(["employees"], previousUsers);
      }
      toast.error(toFriendlyErrorMessage(deleteErr, "Failed to delete user"));
    } finally {
      setIsDeleting(false);
    }
  };

  const renderActions = (user: UserAccount) => {
    const statusLabel = normalizeStatus(user.status) === "active" ? "Deactivate" : "Activate";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl transition-all duration-200 hover:bg-muted/70"
            aria-label="Open user actions menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-52 rounded-xl border-border/70 p-1 data-[state=open]:duration-200 data-[state=closed]:duration-200"
        >
          <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(user, "view")}>
            <Eye className="mr-2 h-4 w-4" />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(user, "edit")}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => void handleResetPassword(user.email)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Send reset link
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => void handleToggleStatus(user)}>
            <Power className="mr-2 h-4 w-4" />
            {statusLabel}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-rose-600 focus:bg-rose-50 focus:text-rose-700"
            onClick={() => {
              setDeleteTarget(user);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <MainLayout>
      <div className="users-page-enter space-y-5 sm:space-y-6">
        <PageHeader
          title="Users"
          description="Manage employee accounts and access permissions for the admin system"
          eyebrow={
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
              <UserCog className="h-3.5 w-3.5" />
              Admin Access
            </div>
          }
          actions={
            <Button
              type="button"
              onClick={openCreate}
              className="h-11 w-full rounded-full px-5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          }
        />

        <UsersToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          onRoleFilterChange={setRoleFilter}
          onStatusFilterChange={setStatusFilter}
          onClearFilters={clearFilters}
          onRefresh={() => void refetch()}
          isRefreshing={isFetching}
          totalCount={dedupedEmployees.length}
          filteredCount={filteredUsers.length}
        />

        <div className="hidden lg:block">
          <UsersTable
            users={filteredUsers}
            isLoading={isLoading}
            errorMessage={usersErrorMessage}
            onRetry={() => void refetch()}
            renderActions={renderActions}
          />
        </div>

        <div className="lg:hidden">
          <UsersCards
            users={filteredUsers}
            isLoading={isLoading}
            errorMessage={usersErrorMessage}
            onRetry={() => void refetch()}
            renderActions={renderActions}
          />
        </div>
      </div>

      <AddUserModal
        open={modalOpen}
        mode={formMode}
        isSubmitting={isSubmitting}
        submitError={submitError}
        departments={departments}
        initialValues={initialModalValues}
        onOpenChange={closeModal}
        onSubmit={handleModalSubmit}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="ลบผู้ใช้งาน?"
        description="การลบผู้ใช้งานไม่สามารถย้อนกลับได้ และสิทธิ์เข้าถึงระบบจะถูกยกเลิกทันที"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open && !isDeleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDeleteUser}
      />
    </MainLayout>
  );
}
