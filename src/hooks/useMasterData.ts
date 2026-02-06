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

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          `
          *,
          departments (name),
          locations (name)  
        `,
        )
        .order("emp_code");

      if (error) throw error;
      return data as unknown as Employee[];
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEmployeeInput) => {
      const { data, error } = await supabase.from("employees").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("เพิ่มพนักงานสำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateEmployeeInput) => {
      const { id, ...payload } = input;
      const { data, error } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("อัปเดตพนักงานสำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("delete_employee_safe", {
        arg_employee_id: id,
      });
      if (error) throw error;
      const result = data as { success: boolean; message: string };
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("ลบพนักงานสำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
