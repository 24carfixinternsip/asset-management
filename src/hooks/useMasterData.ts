import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, TablesInsert } from "src/integrations/supabase/types"; // ตรวจสอบ path ให้ถูก

// --- Generic Types Mapping (Single Source of Truth) ---
export type Department = Tables<'departments'>;
export type Location = Tables<'locations'>;
export type Category = Tables<'categories'>;

// Employee ต้อง Join data เลยต้อง extend type
export type Employee = Tables<'employees'> & {
  departments: Pick<Tables<'departments'>, 'name'> | null;
  locations: Pick<Tables<'locations'>, 'name'> | null;
};

// --- Departments ---
export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data; // Type จะเป็น Department[] อัตโนมัติ
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      // ใช้ TablesInsert เพื่อ Type Safety
      const payload: TablesInsert<'departments'> = { name };
      const { data, error } = await supabase
        .from('departments')
        .insert(payload)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('เพิ่มแผนกสำเร็จ');
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
      // เรียก RPC แทนการ delete ตรงๆ
      const { data, error } = await supabase.rpc('delete_department_safe', { 
        arg_department_id: id 
      });
      
      if (error) throw error;
      
      // Handle Logic Error จาก Server
      const result = data as { success: boolean; message: string };
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('ลบแผนกสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message); // message จะมาจาก RPC ที่เราเขียน
    },
  });
}

// --- Locations ---
export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, building }: { name: string; building?: string }) => {
      const payload: TablesInsert<'locations'> = { 
        name, 
        building: building || null 
      };
      const { data, error } = await supabase
        .from('locations')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('เพิ่มสถานที่สำเร็จ');
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
      const { data, error } = await supabase.rpc('delete_location_safe', { 
        arg_location_id: id 
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; message: string };
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('ลบสถานที่สำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// --- Categories ---
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const payload: TablesInsert<'categories'> = { name };
      const { data, error } = await supabase
        .from('categories')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('เพิ่มหมวดหมู่สำเร็จ');
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
      const { data, error } = await supabase.rpc('delete_category_safe', { 
        arg_category_id: id 
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; message: string };
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('ลบหมวดหมู่สำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// --- Employees ---
// ส่วนนี้แค่ปรับ Type ให้ถูกต้อง Logic เดิมโอเคแล้วเพราะใช้ delete_employee_safe อยู่แล้ว

export interface CreateEmployeeInput extends TablesInsert<'employees'> {}
export interface UpdateEmployeeInput extends TablesInsert<'employees'> {
  id: string; // บังคับว่าต้องมี ID เวลา update
}

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          departments (name),
          locations (name)  
        `) 
        .order('emp_code');
      
      if (error) throw error;
      // ต้อง cast เพราะ Supabase join types บางทีซับซ้อนเกินกว่า auto-inference
      return data as unknown as Employee[];
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEmployeeInput) => {
      const { data, error } = await supabase
        .from('employees')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('เพิ่มพนักงานสำเร็จ');
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
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('แก้ไขข้อมูลพนักงานสำเร็จ');
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
      // ใช้ RPC เดิมที่มีอยู่แล้ว
      const { data, error } = await supabase.rpc('delete_employee_safe', { arg_employee_id: id });
      
      if (error) throw error;
      
      const result = data as { success: boolean; message: string };
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('ลบพนักงานสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}