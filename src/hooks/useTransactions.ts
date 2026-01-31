import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RpcResponse {
  success: boolean;
  message: string;
}

export interface Transaction {
  id: string;
  employee_id: string | null;
  department_id: string | null;
  serial_id: string;
  borrow_date: string;
  return_date: string | null;
  status: 'Pending' | 'Active' | 'Completed' | 'Rejected';
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
  serial_id: string;
  employee_id?: string | null;
  department_id?: string | null;
  note?: string | null;
}

export interface ReturnTransactionInput {
  transactionId: string;
  serialId?: string; 
  condition: string; 
  note?: string;
}

export interface ApproveRequestInput {
  transactionId: string;
}

export interface RejectRequestInput {
  transactionId: string;
  reason: string;
}

export function useTransactions(
  status?: 'Active' | 'Completed' | 'Pending' | 'Rejected', 
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
  
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const borrowerType = input.employee_id ? 'employee' : 'department';
      const borrowerId = input.employee_id || input.department_id;

      if (!borrowerId) {
        throw new Error('ต้องระบุผู้เบิก (employee_id หรือ department_id)');
      }

      const { data, error } = await supabase.rpc('borrow_item', {
        arg_serial_id: input.serial_id,
        arg_borrower_id: borrowerId,
        arg_borrower_type: borrowerType,
        arg_note: input.note || ''
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        throw new Error(result.message);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: Error) => {
      console.error('Create transaction error:', error);
    }
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
      const result = data as unknown as RpcResponse;

      if (result && result.success === false) {
        throw new Error(result.message);
      }
      return result;
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

export function useMyHistory(page: number = 1, pageSize: number = 10) {
  return useQuery({
    queryKey: ['my-transactions', page, pageSize],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        return { data: [], total: 0, totalPages: 0 };
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // ใช้ !inner เพื่อกรองเฉพาะ user นี้
      const query = supabase
        .from('transactions')
        .select(`
          *,
          employees!inner(name, email), 
          product_serials (
            serial_code,
            products (name, image_url, brand, model)
          )
        `, { count: 'exact' })
        .eq('employees.email', session.user.email)
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error("Error fetching my history:", error);
        throw error;
      }
      
      return {
        data: data as unknown as any[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    placeholderData: (previousData) => previousData,
  });
}

// Hook สำหรับอนุมัติคำขอ
export function useApproveRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: ApproveRequestInput) => {
      const { data, error } = await supabase.rpc('approve_borrow_request', {
        arg_transaction_id: input.transactionId
      });
      
      if (error) throw error;
      const result = data as { success: boolean; message: string };
      
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('อนุมัติคำขอสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(`อนุมัติไม่สำเร็จ: ${error.message}`);
    },
  });
}

// Hook สำหรับปฏิเสธคำขอ
export function useRejectRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: RejectRequestInput) => {
      const { data, error } = await supabase.rpc('reject_borrow_request', {
        arg_transaction_id: input.transactionId,
        arg_reason: input.reason
      });
      
      if (error) throw error;
      const result = data as { success: boolean; message: string };
      
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('ปฏิเสธคำขอสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(`ปฏิเสธไม่สำเร็จ: ${error.message}`);
    },
  });
}

// Hook สำหรับคำขอคืนสินค้า (สำหรับพนักงาน)
export interface RequestReturnInput {
  transactionId: string;
  returnNote: string;
}

export function useRequestReturn() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: RequestReturnInput) => {
      const { data, error } = await supabase.rpc('request_return_item', {
        arg_transaction_id: input.transactionId,
        arg_return_note: input.returnNote
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        throw new Error(result.message);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('ส่งคำขอคืนสำเร็จ รอ Admin อนุมัติ');
    },
    onError: (error: Error) => {
      toast.error(`ส่งคำขอไม่สำเร็จ: ${error.message}`);
    },
  });
}
