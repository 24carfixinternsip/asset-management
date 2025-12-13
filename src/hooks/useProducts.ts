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
  quantity?: number;
  image_url: string | null;
  created_at: string;
  updated_at?: string | null;
  stock_total: number;      // เพิ่ม field นี้
  stock_available: number;  // เพิ่ม field นี้
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
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // ดึง serials ทั้งหมดเพื่อมานับแยกสถานะ
      const productIds = products.map(p => p.id);
      const { data: serials, error: serialError } = await supabase
        .from('product_serials')
        .select('product_id, status')
        .in('product_id', productIds);
      
      if (serialError) throw serialError;
      
      // คำนวณสต็อก Total และ Available
      const stockMap = serials.reduce((acc, s) => {
        if (!acc[s.product_id]) {
          acc[s.product_id] = { total: 0, available: 0 };
        }
        
        acc[s.product_id].total++;
        
        // เช็คสถานะว่าง (รองรับทั้งไทยและอังกฤษ)
        if (s.status === 'Ready' || s.status === 'พร้อมใช้') {
          acc[s.product_id].available++;
        }
        
        return acc;
      }, {} as Record<string, { total: number; available: number }>);
      
      return products.map(p => ({
        ...p,
        stock_total: stockMap[p.id]?.total || 0,
        stock_available: stockMap[p.id]?.available || 0,
      })) as Product[];
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      // Create product
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          p_id: input.p_id, // *ต้องมั่นใจว่าส่งมาเป็น 4 หลักจาก Products.tsx
          name: input.name,
          category: input.category,
          brand: input.brand,
          model: input.model,
          description: input.description,
          notes: input.notes,
          price: input.price,
          unit: input.unit,
          image_url: input.image_url,
          quantity: input.initial_quantity,
        })
        .select()
        .single();
      
      if (productError) throw productError;
      
      // Create serials
      if (input.initial_quantity > 0) {
        // แก้ไข: สร้าง Serial running 4 หลัก (0001) เพื่อให้เป็น IT-0001-0001
        const serials = Array.from({ length: input.initial_quantity }, (_, i) => ({
          product_id: product.id,
          serial_code: `${input.p_id}-${String(i + 1).padStart(4, '0')}`, 
          status: 'พร้อมใช้' as const,
          sticker_status: 'รอติดสติ๊กเกอร์' as const,
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
      toast.success('Product created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProductInput) => {
      // 1. Update product info
      const { data: product, error: productError } = await supabase
        .from('products')
        .update({
          name: input.name,
          category: input.category,
          brand: input.brand,
          model: input.model,
          description: input.description,
          notes: input.notes,
          price: input.price,
          unit: input.unit,
          image_url: input.image_url,
          quantity: input.initial_quantity,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (productError) throw productError;

      // 2. Add more stock
      const newQuantity = input.initial_quantity || 0;
      const oldQuantity = input.current_quantity || 0;
      
      if (newQuantity > oldQuantity) {
        const diff = newQuantity - oldQuantity;
        
        // Find last serial to continue running number
        const { data: lastSerial } = await supabase
          .from('product_serials')
          .select('serial_code')
          .eq('product_id', input.id)
          .order('serial_code', { ascending: false })
          .limit(1)
          .maybeSingle();

        let startNumber = 0;
        if (lastSerial && lastSerial.serial_code) {
            const parts = lastSerial.serial_code.split('-');
            const lastNumStr = parts[parts.length - 1];
            startNumber = parseInt(lastNumStr, 10) || 0;
        }

        // แก้ไข: สร้าง Serial running 4 หลัก (0001) สำหรับการเพิ่มสต็อก
        const newSerials = Array.from({ length: diff }, (_, i) => ({
          product_id: input.id,
          serial_code: `${product.p_id}-${String(startNumber + i + 1).padStart(4, '0')}`,
          status: 'พร้อมใช้' as const,
          sticker_status: 'รอติดสติ๊กเกอร์' as const,
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
      toast.success('Product updated & Stock added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

// ... (useDeleteProduct คงเดิม)
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      toast.success('Product deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete product: ${error.message}`);
    },
  });
}
