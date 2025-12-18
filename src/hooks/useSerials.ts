import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProductSerial {
  id: string;
  product_id: string;
  serial_code: string;
  status: string;
  sticker_status: string;
  sticker_date: string | null;
  sticker_image_url: string | null;
  image_url: string | null;
  notes: string | null;
  location_id: string | null;
  created_at: string;
  // ✅ ต้องมี field นี้เพื่อให้ Filter หมวดหมู่ทำงานได้
  products?: {
    name: string;
    p_id: string;
    category: string; 
    brand: string | null;
    model: string | null;
    image_url: string | null;
  };
  locations?: {
    id: string;
    name: string;
    building: string | null;
  } | null;
}

export interface UpdateSerialInput {
  id: string;
  status?: string;
  sticker_status?: string;
  sticker_date?: string | null;
  sticker_image_url?: string | null;
  image_url?: string | null;
  notes?: string | null;
  location_id?: string | null;
}

export function useSerials(search?: string) {
  return useQuery({
    queryKey: ['serials', search],
    queryFn: async () => {
      // 1. ถ้ามีการค้นหา ให้หา Product ID ที่เกี่ยวข้องก่อน (แก้ปัญหา Search ข้ามตาราง Error)
      let matchedProductIds: string[] = [];
      let searchSerialOnly = false;

      if (search && search.trim().length > 0) {
        const { data: products, error: prodError } = await supabase
          .from('products')
          .select('id')
          .or(`name.ilike.%${search}%,p_id.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`);
        
        if (prodError) throw prodError;
        
        if (products && products.length > 0) {
          matchedProductIds = products.map(p => p.id);
        } else {
          // ถ้าหาชื่อสินค้าไม่เจอเลย ให้ค้นหาเฉพาะ Serial Code อย่างเดียว
          searchSerialOnly = true; 
        }
      }

      // 2. สร้าง Query หลักดึง Serial
      let query = supabase
        .from('product_serials')
        .select(`
          *,
          products (
            name, 
            p_id, 
            category, 
            brand, 
            model, 
            image_url
          ),
          locations (
            id, 
            name, 
            building
          )
        `)
        .order('serial_code', { ascending: true });
      
      // 3. ใส่เงื่อนไขการค้นหาที่ปลอดภัย (Safe Query)
      if (search && search.trim().length > 0) {
        if (searchSerialOnly) {
           // กรณีหาชื่อสินค้าไม่เจอเลย -> หาแค่ Serial Code
           query = query.ilike('serial_code', `%${search}%`);
        } else {
           // กรณีเจอชื่อสินค้า -> หา (Serial Code ตรง) OR (Product ID อยู่ในลิสต์ที่หาเจอ)
           // เทคนิคนี้แก้ปัญหา Supabase failed to parse filter ได้
           const idsString = matchedProductIds.join(',');
           query = query.or(`serial_code.ilike.%${search}%,product_id.in.(${idsString})`);
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching serials:", error);
        throw error;
      }
      
      return data as unknown as ProductSerial[];
    },
  });
}

export function useAvailableSerials() {
  return useQuery({
    queryKey: ['serials', 'available'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_serials')
        .select(`
          *,
          products (
            name, 
            p_id, 
            category, 
            brand, 
            model, 
            image_url
          )
        `)
        .or('status.eq.Ready,status.eq.พร้อมใช้') 
        .order('serial_code', { ascending: true });
      
      if (error) throw error;
      
      return data as unknown as ProductSerial[];
    },
  });
}

export function useUpdateSerial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: UpdateSerialInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('product_serials')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      toast.success('บันทึกข้อมูลเรียบร้อย');
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}