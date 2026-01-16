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
    id: string;
    name: string;
    p_id: string;
    category: string;
    brand: string | null;
    model: string | null;
    image_url: string | null;
    price: number | null;
    unit: string | null; 
    created_at: string | null; 
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
  productId?: string;
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

      if (filters.productId) {
        query = query.eq('product_id', filters.productId);
      }

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

export function useAvailableSerials(
  page: number = 1, 
  pageSize: number = 12, 
  search: string = ""
) {
  return useQuery({
    queryKey: ['serials', 'available', page, pageSize, search],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const searchTerm = search.trim();

      let query = supabase
        .from('product_serials')
        .select(`
          *,
          products ( id, name, p_id, category, brand, model, image_url, price, unit, created_at )
        `, { count: 'exact' }) // 
        .or('status.eq.Ready,status.eq.Available,status.eq.Active,status.eq.พร้อมใช้,status.eq.ปกติ');

      if (searchTerm) {
         query = query.ilike('serial_code', `%${searchTerm}%`);
      }

      const { data, count, error } = await query
        .order('serial_code', { ascending: true })
        .range(from, to);
      
      if (error) throw error;

      return {
        data: data as unknown as ProductSerial[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    placeholderData: (previousData) => previousData, 
  });
}

export function useSerialsWithPagination(filters: {
  productId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;

  return useQuery({
    queryKey: ['serials', 'paginated', filters],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('product_serials')
        .select(`
          *,
          products!inner ( id, name, p_id, category, brand, model, image_url, price, unit, created_at ),
          locations ( id, name, building )
        `, { count: 'exact' });

      // Apply Filters
      if (filters.productId) {
        query = query.eq('product_id', filters.productId);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search?.trim()) {
        query = query.ilike('serial_code', `%${filters.search.trim()}%`);
      }

      // Apply Pagination
      const { data, count, error } = await query
        .order('serial_code', { ascending: true })
        .range(from, to);

      if (error) throw error;

      return {
        data: data as unknown as ProductSerial[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    placeholderData: (prev) => prev, // Keep previous data while fetching
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