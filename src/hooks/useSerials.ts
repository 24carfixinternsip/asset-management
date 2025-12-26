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
      const { data, error } = await supabase.rpc('update_serial_status', {
        arg_serial_id: input.id,
        arg_status: input.status || '',
        arg_sticker_status: input.sticker_status || '',
        arg_sticker_date: input.sticker_date || null,
        arg_sticker_image_url: input.sticker_image_url || null,
        arg_image_url: input.image_url || null,
        arg_notes: input.notes || null,
        arg_location_id: input.location_id || null
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // อัปเดตหน้าสินค้าด้วยเพราะสต็อกเปลี่ยน
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('บันทึกข้อมูลและปรับปรุงสต็อกเรียบร้อย');
    },
    onError: (error: Error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useDeleteSerial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('delete_serial_safe', { arg_serial_id: id });
      
      if (error) throw error;
      // @ts-ignore
      if (data && data.success === false) {
         // @ts-ignore
         throw new Error(data.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('ลบรายการทรัพย์สินเรียบร้อย');
    },
    onError: (error: Error) => {
      toast.error(`ลบไม่สำเร็จ: ${error.message}`);
    },
  });
}