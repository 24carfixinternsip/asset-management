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
  // เพิ่ม field ที่จะมาจาก Trigger/View
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
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      // 1. แยก quantity ออกจาก product data (CLEAN CODE: ไม่ส่ง field ที่ไม่มีใน DB)
      const { initial_quantity, ...productData } = input;

      // Insert เฉพาะข้อมูลสินค้า
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
            // ❌ เอา quantity ออก เพราะไม่มีคอลัมน์นี้ใน Table products
        })
        .select()
        .single();
      
      if (productError) throw productError;
      
      // 2. Create serials (สร้าง Serial ตามจำนวนที่ระบุ)
      if (initial_quantity > 0) {
        const serials = Array.from({ length: initial_quantity }, (_, i) => ({
          product_id: product.id,
          serial_code: `${input.p_id}-${String(i + 1).padStart(4, '0')}`, 
          // ✅ FIX: แก้ Value ให้ตรงกับ Check Constraint ใน DB (Ready, Pending)
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
      // 1. แยก quantity ออกเหมือนกัน
      const { initial_quantity, current_quantity, id, ...updateData } = input;

      // Update เฉพาะข้อมูลสินค้า
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
            // ❌ เอา quantity ออก
        })
        .eq('id', id)
        .select()
        .single();

      if (productError) throw productError;

      // 2. เพิ่ม Stock (ถ้ามีการเพิ่มจำนวน)
      const newQuantity = initial_quantity || 0;
      const oldQuantity = current_quantity || 0;
      
      if (newQuantity > oldQuantity) {
        const diff = newQuantity - oldQuantity;
        
        // หาเลข Serial ล่าสุด
        const { data: lastSerial } = await supabase
          .from('product_serials')
          .select('serial_code')
          .eq('product_id', id)
          .order('serial_code', { ascending: false })
          .limit(1)
          .maybeSingle();

        let startNumber = 0;
        if (lastSerial && lastSerial.serial_code) {
            const parts = lastSerial.serial_code.split('-');
            const lastNumStr = parts[parts.length - 1];
            startNumber = parseInt(lastNumStr, 10) || 0;
        }

        const newSerials = Array.from({ length: diff }, (_, i) => ({
          product_id: id,
          serial_code: `${product.p_id}-${String(startNumber + i + 1).padStart(4, '0')}`,
          // ✅ FIX: ใช้ค่าภาษาอังกฤษ
          status: 'Ready',
          sticker_status: 'Pending',
        }));

        if (newSerials.length > 0) {
            const { error: insertError } = await supabase
            .from('product_serials')
            .insert(newSerials);
            
            if (insertError) throw insertError;
        }
      }

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      toast.success('บันทึกข้อมูลเรียบร้อย');
    },
    onError: (error: Error) => {
      toast.error(`แก้ไขข้อมูลไม่สำเร็จ: ${error.message}`);
    },
  });
}

// useDeleteProduct คงเดิมได้
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