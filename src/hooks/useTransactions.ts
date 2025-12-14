import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Update Interface: เพิ่ม brand และ model ใน products
export interface Transaction {
  id: string;
  employee_id: string | null;
  department_id: string | null;
  serial_id: string;
  borrow_date: string;
  return_date: string | null;
  status: 'Active' | 'Completed';
  note: string | null;
  created_at: string;
  employees?: {
    name: string;
    emp_code: string;
    department_id: string | null;
  } | null;
  departments?: {
    name: string;
  } | null;
  product_serials?: {
    serial_code: string;
    products?: {
      name: string;
      p_id: string;
      image_url: string | null;
      brand: string | null;
      model: string | null;
    };
  };
}

export interface CreateTransactionInput {
  employee_id?: string;
  department_id?: string;
  serial_id: string;
  note?: string;
}

export function useTransactions(status?: 'Active' | 'Completed') {
  return useQuery({
    queryKey: ['transactions', status],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          employees (name, emp_code, department_id), 
          departments (name),
          product_serials (
            serial_code,
            products (name, p_id, image_url, brand, model)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as Transaction[];
    },
  });
}

export function useRecentTransactions(limit: number = 5) {
  return useQuery({
    queryKey: ['transactions', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          employees (name, emp_code, department_id),
          departments (name),
          product_serials (
            serial_code,
            products (name, p_id, image_url, brand, model)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as unknown as Transaction[];
    },
  });
}

export function useEmployeeTransactions(employeeId: string | null) {
  return useQuery({
    queryKey: ['transactions', 'employee', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          product_serials (
            serial_code,
            products (name, p_id, image_url, brand, model)
          )
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as Transaction[];
    },
    enabled: !!employeeId, 
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      // ✅ แก้ไข: ใช้ RPC Function 'user_borrow_item' แทนการ Insert ตรงๆ
      // เพื่อให้ User ทั่วไป (Viewer) สามารถกดเบิกได้โดยไม่ต้องมีสิทธิ์ Admin
      const { data, error } = await supabase
        .rpc('user_borrow_item', { 
          p_employee_id: input.employee_id,
          p_serial_id: input.serial_id,
          p_note: input.note || ''
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('บันทึกการเบิกสำเร็จ');
    },
    onError: (error: Error) => {
      console.error(error); 
      // แสดง Error Message ที่ส่งมาจาก Database (เช่น สินค้าไม่พร้อมใช้งาน)
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useReturnTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ transactionId, serialId }: { transactionId: string; serialId: string }) => {
      // ส่วนนี้ใช้ Logic เดิม (Admin เป็นคนกดรับคืน)
      // อัปเดต Transaction เป็น Completed
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          status: 'Completed',
          return_date: new Date().toISOString(),
        })
        .eq('id', transactionId);
      
      if (transactionError) throw transactionError;
      
      // อัปเดต Serial กลับเป็น Ready (พร้อมใช้)
      const { error: serialError } = await supabase
        .from('product_serials')
        .update({ status: 'Ready' }) 
        .eq('id', serialId);
      
      if (serialError) throw serialError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('บันทึกการคืนสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useMyHistory() {
  return useQuery({
    queryKey: ['my-transactions'],
    queryFn: async () => {
      // 1. ดึง User ที่ Login อยู่ปัจจุบัน
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        return []; // ถ้าไม่ได้ Login หรือไม่มี Email ให้คืนค่าว่าง
      }

      // 2. Query โดย Filter ผ่านตาราง employees ด้วย Email
      // เทคนิค: ใช้ !inner เพื่อบังคับว่าต้องมี employee ที่ตรงกันเท่านั้น
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          employees!inner(name, email), 
          product_serials (
            serial_code,
            products (name, image_url, brand, model)
          )
        `)
        .eq('employees.email', session.user.email) // กรองเฉพาะของอีเมลเรา
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching my history:", error);
        throw error;
      }
      
      return data as unknown as Transaction[];
    },
  });
}