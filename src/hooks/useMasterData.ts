import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tables, TablesInsert, TablesUpdate } from "src/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { masterDataApi } from "@/lib/masterDataApi";
import type { Category, Department, Location } from "@/lib/masterDataApi";

export type { Department, Location, Category };

const isRlsError = (message: string) =>
  message.toLowerCase().includes("row-level security") || message.toLowerCase().includes("permission denied");

const isForeignKeyError = (message: string) => message.toLowerCase().includes("foreign key");
const isForeignKeyConstraintCode = (code?: string | null) => code === "23503";
const isUniqueConstraintCode = (code?: string | null) => code === "23505";

const getLocationErrorMessage = (error: Error, action: "create" | "update" | "delete") => {
  const message = error.message || "";
  if (isRlsError(message)) {
    return action === "delete"
      ? "คุณไม่มีสิทธิ์ลบสถานที่ กรุณาติดต่อผู้ดูแลระบบ"
      : "คุณไม่มีสิทธิ์เพิ่ม/แก้ไขสถานที่ กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (action === "delete" && isForeignKeyError(message)) {
    return "ลบไม่ได้ เนื่องจากมีรายการใช้งานสถานที่นี้อยู่";
  }
  return "เกิดข้อผิดพลาดในการบันทึกสถานที่ กรุณาลองใหม่";
};

export type Employee = Tables<"employees"> & {
  departments: Pick<Tables<"departments">, "name"> | null;
  locations: Pick<Tables<"locations">, "name"> | null;
  role?: string | null;
  account_role?: string | null;
  employee_role?: string | null;
};

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: masterDataApi.listDepartments,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesInsert<"departments">) => masterDataApi.createDepartment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("เพิ่มแผนกสำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesUpdate<"departments"> & { id: string }) =>
      masterDataApi.updateDepartment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("อัปเดตแผนกสำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deleteDepartment(id),
    onMutate: async (id: string) => {
      // Optimistic update: remove the deleted department immediately from the cache.
      await queryClient.cancelQueries({ queryKey: ["departments"] });
      const previous = queryClient.getQueryData<Department[]>(["departments"]);
      queryClient.setQueryData<Department[]>(["departments"], (current = []) =>
        current.filter((dept) => dept.id !== id),
      );
      return { previous };
    },
    onError: (error: Error, _id, context) => {
      console.error("Delete department failed:", error);
      if (context?.previous) {
        queryClient.setQueryData(["departments"], context.previous);
      }
    },
    onSuccess: () => {
      toast.success("ลบแผนกสำเร็จ");
    },
    onSettled: () => {
      // Always refetch to keep UI in sync with DB even if optimistic state was used.
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: masterDataApi.listLocations,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesInsert<"locations">) => masterDataApi.createLocation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("เพิ่มสถานที่สำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(getLocationErrorMessage(error, "create"));
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesUpdate<"locations"> & { id: string }) => masterDataApi.updateLocation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("อัปเดตสถานที่สำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(getLocationErrorMessage(error, "update"));
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deleteLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("ลบสถานที่สำเร็จ");
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: masterDataApi.listCategories,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesInsert<"categories">) => masterDataApi.createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("เพิ่มหมวดหมู่สำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesUpdate<"categories"> & { id: string }) => masterDataApi.updateCategory(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["categories"] });
      const previous = queryClient.getQueryData<Category[]>(["categories"]);
      const { id, ...updates } = payload;
      queryClient.setQueryData<Category[]>(["categories"], (current = []) =>
        current.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat)),
      );
      return { previous };
    },
    onError: (error: Error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["categories"], context.previous);
      }
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
    onSuccess: () => {
      toast.success("อัปเดตหมวดหมู่สำเร็จ");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("ลบหมวดหมู่สำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteCategoriesBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => masterDataApi.deleteCategoriesBatch(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useReorderCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) => masterDataApi.reorderCategories(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("บันทึกลำดับหมวดหมู่แล้ว");
    },
    onError: (error: Error) => {
      toast.error(`บันทึกลำดับไม่สำเร็จ: ${error.message}`);
    },
  });
}

export interface CreateEmployeeInput extends TablesInsert<"employees"> {}
export interface UpdateEmployeeInput extends TablesUpdate<"employees"> {
  id: string;
}

let shouldUseEmployeesFallback = false;

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      if (!shouldUseEmployeesFallback) {
        const { data, error } = await supabase.from("view_users_full").select("*").order("name");
        if (!error) {
          return (data ?? []).map((row) => ({
            id: row.id,
            emp_code: row.emp_code,
            name: row.name,
            nickname: row.nickname,
            gender: row.gender,
            email: row.email,
            tel: row.tel,
            image_url: row.image_url,
            location: row.location_name,
            location_id: row.location_id,
            department_id: row.department_id,
            user_id: row.user_id,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            role: row.role,
            account_role: row.account_role,
            employee_role: row.employee_role,
            departments: row.department_name ? { name: row.department_name } : null,
            locations: row.location_name ? { name: row.location_name } : null,
          })) as Employee[];
        }

        const message = (error.message ?? "").toLowerCase();
        const isMissingView =
          error.code === "PGRST205" ||
          (message.includes("view_users_full") && message.includes("does not exist"));

        if (!isMissingView) throw error;

        shouldUseEmployeesFallback = true;
        console.warn("view_users_full missing. Falling back to employees table query.", error);
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("employees")
        .select(
          `
          *,
          departments (name),
          locations (name)
        `,
        )
        .order("name");

      if (fallbackError) throw fallbackError;

      return (fallbackData ?? []).map((row) => ({
        ...row,
        departments: row.departments ?? null,
        locations: row.locations ?? null,
        role: row.role ?? "employee",
        account_role: null,
        employee_role: row.role ?? "employee",
      })) as Employee[];
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEmployeeInput) => {
      const { data, error } = await supabase.from("employees").insert(input).select("*").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("ไม่สามารถเพิ่มพนักงานได้ กรุณาลองใหม่");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("เพิ่มพนักงานสำเร็จ");
    },
    onError: (error: Error & { code?: string | null }) => {
      const message = (error.message ?? "").toLowerCase();
      const isDuplicateEmpCode =
        isUniqueConstraintCode(error.code) || message.includes("employees_emp_code_key");

      if (isDuplicateEmpCode) {
        toast.error("รหัสพนักงานซ้ำในระบบ กรุณาใช้รหัสอื่น");
        return;
      }

      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateEmployeeInput) => {
      const { id: employeeId, ...payload } = input;
      if (!employeeId) {
        throw new Error("ไม่พบรหัสพนักงานที่ต้องการอัปเดต");
      }

      const { data: beforeEmployee, error: beforeReadError } = await supabase
        .from("employees")
        .select("*")
        .eq("id", employeeId)
        .maybeSingle();

      if (beforeReadError) {
        console.error("Read employee before update failed:", beforeReadError);
        throw beforeReadError;
      }

      if (!beforeEmployee) {
        throw new Error("Employee not found or not allowed");
      }

      // Use array response for PATCH and validate row count ourselves.
      // This avoids PostgREST object-coercion (406/PGRST116) from single-object mode.
      const { data: updatedEmployees, error: updateError } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", employeeId)
        .select("*");

      if (updateError) {
        console.error("Update employee Supabase error:", updateError);
        throw updateError;
      }

      if (!updatedEmployees || updatedEmployees.length === 0) {
        // The row exists (checked above) but no row was returned from UPDATE => typically blocked by RLS/policy.
        throw new Error("คุณไม่มีสิทธิ์แก้ไขข้อมูลพนักงาน");
      }

      if (updatedEmployees.length > 1) {
        console.error("Unexpected multiple rows updated for employee id", {
          employeeId,
          count: updatedEmployees.length,
        });
        throw new Error("พบข้อมูลพนักงานซ้ำซ้อน กรุณาตรวจสอบข้อมูลในระบบ");
      }

      return updatedEmployees[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("อัปเดตพนักงานสำเร็จ");
    },
    onError: (error: Error) => {
      console.error("Update employee mutation failed:", error);
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: string) => {
      if (!employeeId) {
        throw new Error("ไม่พบรหัสพนักงานที่ต้องการลบ");
      }

      const runDelete = async () =>
        supabase.from("employees").delete().eq("id", employeeId).select("id");

      let { data: deletedRows, error: deleteError } = await runDelete();

      if (deleteError) {
        const message = deleteError.message ?? "";
        const blockedByForeignKey =
          isForeignKeyConstraintCode(deleteError.code) || isForeignKeyError(message.toLowerCase());

        if (!blockedByForeignKey) {
          console.error("Delete employee Supabase error:", deleteError);
          throw deleteError;
        }

        // Some rows are referenced by transactions; detach relation first, then retry hard delete.
        const { error: unlinkTransactionError } = await supabase
          .from("transactions")
          .update({ employee_id: null })
          .eq("employee_id", employeeId);

        if (unlinkTransactionError) {
          console.error("Unlink employee from transactions failed:", unlinkTransactionError);
          throw new Error("ลบไม่ได้ เนื่องจากพนักงานถูกอ้างอิงในรายการยืมและไม่สามารถเคลียร์การอ้างอิงได้");
        }

        const retryResult = await runDelete();
        deletedRows = retryResult.data;
        deleteError = retryResult.error;

        if (deleteError) {
          console.error("Delete employee retry failed:", deleteError);
          throw deleteError;
        }
      }

      if (!deletedRows || deletedRows.length === 0) {
        const noRowsDeletedError = new Error("ลบพนักงานไม่สำเร็จ: ไม่พบรายการหรือไม่มีสิทธิ์");
        console.error("Delete employee failed: no rows deleted", { employeeId, deletedRows });
        throw noRowsDeletedError;
      }

      if (deletedRows.length > 1) {
        const multiRowsDeletedError = new Error("พบข้อมูลพนักงานซ้ำซ้อน กรุณาตรวจสอบข้อมูลในระบบ");
        console.error("Delete employee failed: multiple rows deleted", { employeeId, deletedRows });
        throw multiRowsDeletedError;
      }

      return { deletedIds: deletedRows.map((row) => row.id) };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("ลบพนักงานสำเร็จ");
    },
    onError: (error: Error) => {
      console.error("Delete employee mutation failed:", error);
      toast.error(error.message);
    },
  });
}
