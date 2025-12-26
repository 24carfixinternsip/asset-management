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

export interface ReturnTransactionInput {
  transactionId: string;
  serialId?: string; 
  condition: string; 
  note?: string;
}

export interface CreateTransactionInput {
  borrower_id: string;
  borrower_type: 'employee' | 'department';
  serial_id: string;
  note?: string;
}

export function useTransactions(
  status?: 'Active' | 'Completed', 
  page: number = 1, 
  pageSize: number = 8
) {
  return useQuery({
    queryKey: ['transactions', status, page],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

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
        `, { count: 'exact' }) // ขอจำนวนรวมทั้งหมดด้วย
        .order('created_at', { ascending: false })
        .range(from, to); // Load เฉพาะหน้านั้นๆ
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, count, error } = await query;
      
      if (error) throw error;
      
      return {
        data: data as unknown as Transaction[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    placeholderData: (previousData) => previousData, // ให้ UX ลื่นขึ้นตอนเปลี่ยนหน้า
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
  
  // รับ input เป็น Object ที่มี condition และ note
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      // ใช้ RPC 'borrow_item'
      const { data, error } = await supabase.rpc('borrow_item', { 
        arg_serial_id: input.serial_id,
        arg_borrower_id: input.borrower_id,
        arg_borrower_type: input.borrower_type,
        arg_note: input.note || ''
      });
      
      if (error) throw error;
      // @ts-ignore
      if (data && data.success === false) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('บันทึกการเบิกสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(`เบิกไม่สำเร็จ: ${error.message}`);
    },
  });
}

export function useReturnTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: ReturnTransactionInput) => {
      const { data, error } = await supabase.rpc('return_item', { 
        arg_transaction_id: input.transactionId,
        arg_return_condition: input.condition,
        arg_note: input.note || ''
      });
      
      if (error) throw error;
      // @ts-ignore
      if (data && data.success === false) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('บันทึกการคืนสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(`คืนไม่สำเร็จ: ${error.message}`);
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