import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, TablesInsert, TablesUpdate } from "src/integrations/supabase/types";

export type Department = Tables<"departments">;
export type Location = Tables<"locations">;
export type Category = Tables<"categories">;

export type Employee = Tables<"employees"> & {
  departments: Pick<Tables<"departments">, "name"> | null;
  locations: Pick<Tables<"locations">, "name"> | null;
};

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Department[];
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"departments">) => {
      const { data, error } = await supabase
        .from("departments")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Department;
    },
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
    mutationFn: async (payload: TablesUpdate<"departments"> & { id: string }) => {
      const { id, ...updates } = payload;
      const { data, error } = await supabase
        .from("departments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Department;
    },
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
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("delete_department_safe", {
        arg_department_id: id,
      });
      if (error) throw error;
      const result = data as { success: boolean; message: string };
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("ลบแผนกสำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Location[];
    },
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"locations">) => {
      const { data, error } = await supabase
        .from("locations")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Location;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("เพิ่มสถานที่สำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesUpdate<"locations"> & { id: string }) => {
      const { id, ...updates } = payload;
      const { data, error } = await supabase
        .from("locations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Location;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("อัปเดตสถานที่สำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("delete_location_safe", {
        arg_location_id: id,
      });
      if (error) throw error;
      const result = data as { success: boolean; message: string };
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("ลบสถานที่สำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"categories">) => {
      const { data, error } = await supabase
        .from("categories")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    },
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
    mutationFn: async (payload: TablesUpdate<"categories"> & { id: string }) => {
      const { id, ...updates } = payload;
      const { data, error } = await supabase
        .from("categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("อัปเดตหมวดหมู่สำเร็จ");
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("delete_category_safe", {
        arg_category_id: id,
      });
      if (error) throw error;
      const result = data as { success: boolean; message: string };
      if (!result.success) throw new Error(result.message);
      return result;
    },
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
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("categories").delete().in("id", ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useReorderCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      const { error } = await supabase.from("categories").upsert(updates, { onConflict: "id" });
      if (error) throw error;
      return updates;
    },
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
