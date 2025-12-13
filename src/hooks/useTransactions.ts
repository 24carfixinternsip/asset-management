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
      brand: string | null; // เพิ่มตรงนี้
      model: string | null; // เพิ่มตรงนี้
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
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          employee_id: input.employee_id || null,     
          department_id: input.department_id || null, 
          serial_id: input.serial_id,
          note: input.note,
          status: 'Active',
        })
        .select()
        .single();
      
      if (transactionError) throw transactionError;
      
      const { error: serialError } = await supabase
        .from('product_serials')
        .update({ status: 'Borrowed' }) 
        .eq('id', input.serial_id);
      
      if (serialError) throw serialError;
      
      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('บันทึกการเบิกสำเร็จ');
    },
    onError: (error: Error) => {
      console.error(error); 
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useReturnTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ transactionId, serialId }: { transactionId: string; serialId: string }) => {
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          status: 'Completed',
          return_date: new Date().toISOString(),
        })
        .eq('id', transactionId);
      
      if (transactionError) throw transactionError;
      
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