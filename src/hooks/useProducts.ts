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

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      // ✅ 1. เรียงตาม p_id แบบมากไปน้อย (Descending) 
      // เพื่อให้รหัสเลขเยอะที่สุด (ล่าสุด) ขึ้นก่อน และแก้ปัญหาเลข 11 ไปอยู่หน้าอื่น
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('p_id', { ascending: false }); 
      
      if (error) throw error;
      
      // ✅ 2. ใช้ Natural Sort ฝั่ง Client ซ้ำอีกครั้ง (Descending)
      // เพื่อให้มั่นใจว่า IT-100 จะมา *ก่อน* IT-99 (เรียงแบบตัวเลข ไม่ใช่ตัวอักษร)
      // b.localeCompare(a) คือการเรียงจากมากไปน้อย
      const sortedData = (data as Product[]).sort((a, b) => {
        return b.p_id.localeCompare(a.p_id, undefined, { numeric: true, sensitivity: 'base' });
      });

      return sortedData;
    },
  });
}

// ... ส่วนอื่นๆ (useCreateProduct, useUpdateProduct, useDeleteProduct) เหมือนเดิม ...
export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const { initial_quantity, ...productData } = input;

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
            p_id: productData.p_id,
            name: productData.name,
            category: productData.category,
            brand: productData.brand,
            model: productData.model,
            description: productData.description,
            notes: productData.notes,
            price: productData.price,
            unit: productData.unit,
            image_url: productData.image_url
        })
        .select()
        .single();
      
      if (productError) throw productError;
      
      if (initial_quantity > 0) {
        const serials = Array.from({ length: initial_quantity }, (_, i) => ({
          product_id: product.id,
          serial_code: `${input.p_id}-${String(i + 1).padStart(4, '0')}`, 
          status: 'Ready', 
          sticker_status: 'Pending',
        }));
        
        const { error: serialError } = await supabase
          .from('product_serials')
          .insert(serials);
        
        if (serialError) throw serialError;
      }
      
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      toast.success('สร้างสินค้าและ Serial สำเร็จ');
    },
    onError: (error: Error) => {
      console.error(error);
      toast.error(`สร้างสินค้าไม่สำเร็จ: ${error.message}`);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProductInput) => {
      const { initial_quantity, current_quantity, id, ...updateData } = input;

      const { data: product, error: productError } = await supabase
        .from('products')
        .update({
            name: updateData.name,
            category: updateData.category,
            brand: updateData.brand,
            model: updateData.model,
            description: updateData.description,
            notes: updateData.notes,
            price: updateData.price,
            unit: updateData.unit,
            image_url: updateData.image_url
        })
        .eq('id', id)
        .select()
        .single();

      if (productError) throw productError;

      const newQuantity = initial_quantity || 0;
      const oldQuantity = current_quantity || 0;
      
      if (newQuantity > oldQuantity) {
        const quantityToAdd = newQuantity - oldQuantity;
        
        const { error: rpcError } = await supabase
          .rpc('add_product_stock' as any, {
            p_product_id: id,
            p_p_id_prefix: product.p_id, 
            p_quantity_to_add: quantityToAdd
          });

        if (rpcError) throw rpcError;
      }

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('อัปเดตข้อมูลและสต็อกเรียบร้อย');
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
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      toast.success('ลบสินค้าสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(`ลบสินค้าไม่สำเร็จ: ${error.message}`);
    },
  });
}