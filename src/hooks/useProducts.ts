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

// Interface สำหรับ Filter
export interface ProductFilters {
  search?: string;
  categories?: string[];
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

// Main Hook
export function useProducts(filters?: ProductFilters) {
  return useQuery({
    // ใส่ filters ลงใน key เพื่อให้มัน fetch ใหม่เมื่อค่าเปลี่ยน
    queryKey: ['products', filters],
    queryFn: async () => {
      let query = supabase.from('products').select('*');

      // Apply Server-Side Filters
      
      // กรองหมวดหมู่ (ถ้ามีการเลือก)
      if (filters?.categories && filters.categories.length > 0) {
        query = query.in('category', filters.categories);
      }

      // กรองคำค้นหา (Search)
      if (filters?.search && filters.search.trim().length > 0) {
        const term = filters.search.trim();
        // ค้นหาจาก ชื่อ, รหัส, ยี่ห้อ, รุ่น
        query = query.or(`name.ilike.%${term}%,p_id.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Client-Side Sorting
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

      const { data, error } = await supabase.rpc('create_product_and_serials', rpcParams);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      toast.success('สร้างสินค้าและรหัส Serial สำเร็จเรียบร้อย');
    },
    onError: (error: Error) => {
      toast.error(`สร้างสินค้าไม่สำเร็จ: ${error.message}`);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProductInput) => {
      const rpcParams = {
        arg_product_id: input.id,
        arg_sku: input.p_id,
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
      if (data && data.success === false) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      toast.success('ลบสินค้าสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(`${error.message}`);
    },
  });
}