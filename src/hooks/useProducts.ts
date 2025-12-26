// src/hooks/useProducts.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Product {
  id: string;
  p_id: string;
  name: string;
  model?: string | null;
  category: string;
  brand: string | null;
  description?: string | null;
  notes?: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  created_at: string;
  updated_at?: string | null;
  stock_total?: number;      
  stock_available?: number;  
}

export interface CreateProductInput {
  p_id: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  description?: string;
  notes?: string;
  price: number;
  unit: string;
  image_url?: string;
  initial_quantity: number;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
  current_quantity: number;
}

// Added: Interface for RPC Params ensures Type Safety
interface UpdateProductAndStockParams {
  arg_product_id: string;      // แก้จาก p_id เป็น arg_product_id
  arg_sku: string;             // เพิ่ม arg_sku
  arg_name: string;            // แก้จาก p_name เป็น arg_name
  arg_category: string;
  arg_brand?: string | null;
  arg_model?: string | null;
  arg_description?: string | null;
  arg_notes?: string | null;
  arg_price: number;
  arg_unit: string;
  arg_image_url?: string | null;
  arg_new_total_quantity: number;
}

interface CreateProductRPCParams {
  arg_p_id: string;
  arg_name: string;
  arg_category: string;
  arg_brand?: string | null;
  arg_model?: string | null;
  arg_description?: string | null;
  arg_notes?: string | null;
  arg_price: number;
  arg_unit: string;
  arg_image_url?: string | null;
  arg_initial_quantity: number;
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('p_id', { ascending: false }); 
      
      if (error) throw error;
      
      const sortedData = (data as Product[]).sort((a, b) => {
        return b.p_id.localeCompare(a.p_id, undefined, { numeric: true, sensitivity: 'base' });
      });

      return sortedData;
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const rpcParams: CreateProductRPCParams = {
        arg_p_id: input.p_id,
        arg_name: input.name,
        arg_category: input.category,
        arg_brand: input.brand || null,
        arg_model: input.model || null,
        arg_description: input.description || null,
        arg_notes: input.notes || null,
        arg_price: Number(input.price),
        arg_unit: input.unit,
        arg_image_url: input.image_url || null,
        arg_initial_quantity: Number(input.initial_quantity)
      };

      console.log('Sending RPC Params:', rpcParams);

      const { data, error } = await supabase.rpc('create_product_and_serials', rpcParams);
      
      if (error) {
        console.error('RPC Error Detail:', error); // Log error ตัวเต็ม
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['products'] });
      queryClient.refetchQueries({ queryKey: ['serials'] });
      toast.success('สร้างสินค้าและรหัส Serial สำเร็จเรียบร้อย');
    },
    onError: (error: Error) => {
      console.error('Create Product Error:', error);
      toast.error(`สร้างสินค้าไม่สำเร็จ: ${error.message}`);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProductInput) => {

      const rpcParams = {
        arg_product_id: input.id,          // ส่ง id ไปที่ arg_product_id
        arg_sku: input.p_id,               // ส่ง p_id (SKU) ไปที่ arg_sku
        arg_name: input.name || '', 
        arg_category: input.category || '',
        arg_brand: input.brand || null,
        arg_model: input.model || null,
        arg_description: input.description || null,
        arg_notes: input.notes || null,
        arg_price: Number(input.price) || 0,
        arg_unit: input.unit || '',
        arg_image_url: input.image_url || null,
        arg_new_total_quantity: Number(input.initial_quantity) || 0
      };

      const { data, error } = await supabase.rpc('update_product_and_stock', rpcParams);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('อัปเดตข้อมูลและปรับปรุงสต็อกเรียบร้อย');
    },
    onError: (error: Error) => {
      console.error('Update Product Error:', error);
      toast.error(`แก้ไขข้อมูลไม่สำเร็จ: ${error.message}`);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('delete_product_safe', { arg_product_id: id });
      
      if (error) throw error;
      // @ts-ignore
      if (data && data.success === false) {
        // @ts-ignore
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      toast.success('ลบสินค้าสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(`${error.message}`); // แสดงข้อความ error จาก RPC (เช่น ติดสถานะยืม)
    },
  });
}