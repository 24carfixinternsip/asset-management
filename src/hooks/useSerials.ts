import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

// Type Definitions (Derived from DB)
type SerialRow = Database['public']['Tables']['product_serials']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];
type LocationRow = Database['public']['Tables']['locations']['Row'];

// Extend Type ให้ตรงกับ Relation ที่ Join มา
export interface ProductSerial {
  id: string;
  serial_code: string;
  status: string | null;
  sticker_status: string | null;
  sticker_date: string | null;
  sticker_image_url: string | null;
  image_url: string | null;    
  notes: string | null;         
  location_id: string | null;
  product_id: string;
  created_at: string | null;
  // Relation
  products: {
    name: string;
    p_id: string;
    category: string;
    brand: string | null;
    model: string | null;
    image_url: string | null;
  } | null;
  locations: {
    id: string;
    name: string;
    building: string | null;
  } | null;
}

export interface SerialFilters {
  search?: string;
  status?: string;
  location?: string;
  sticker?: string;
  category?: string;
  dateRange?: { from: Date; to?: Date | undefined };
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

// Main Hook: useSerials (Server-Side Filtering)
export function useSerials(filters: SerialFilters) {
  return useQuery({
    
    queryKey: ['serials', filters],
    queryFn: async () => {
      
      // Logic ค้นหา Search Text
      let matchedProductIds: string[] = [];
      let searchSerialOnly = false;
      const searchText = filters.search?.trim();

      if (searchText) {
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .or(`name.ilike.%${searchText}%,p_id.ilike.%${searchText}%,brand.ilike.%${searchText}%,model.ilike.%${searchText}%`);
        
        if (products && products.length > 0) {
          matchedProductIds = products.map(p => p.id);
        } else {
          searchSerialOnly = true; 
        }
      }

      // สร้าง Query หลัก
      let query = supabase
        .from('product_serials')
        .select(`
          *,
          products!inner ( name, p_id, category, brand, model, image_url ),
          locations ( id, name, building )
        `)
        .order('serial_code', { ascending: true });
      
      // Apply Filters (Server-Side)
      
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.location && filters.location !== 'all') {
        query = query.eq('location_id', filters.location);
      }

      if (filters.sticker && filters.sticker !== 'all') {
        query = query.eq('sticker_status', filters.sticker);
      }

      if (filters.category && filters.category !== 'all') {
        query = query.eq('products.category', filters.category);
      }

      if (filters.dateRange?.from) {
        const startDate = filters.dateRange.from.toISOString();
        const endDate = filters.dateRange.to 
          ? filters.dateRange.to.toISOString() 
          : new Date(filters.dateRange.from.setHours(23, 59, 59)).toISOString();

        query = query.gte('sticker_date', startDate).lte('sticker_date', endDate);
      }

      if (searchText) {
        if (searchSerialOnly) {
           query = query.ilike('serial_code', `%${searchText}%`);
        } else {
           const idsString = matchedProductIds.join(',');
           query = query.or(`serial_code.ilike.%${searchText}%,product_id.in.(${idsString})`);
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
          products ( name, p_id, category, brand, model, image_url )
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
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
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
      
      const result = data as { success: boolean; message: string };
      if (result && result.success === false) {
         throw new Error(result.message);
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