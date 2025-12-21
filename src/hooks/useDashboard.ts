import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// --- ส่วนเดิม: สำหรับ KPI Cards และกราฟ (ถ้ามี) ---

// Interface สำหรับรับค่าจาก RPC get_dashboard_summary
export interface DashboardData {
  totalValue: number;
  totalItems: number;
  availableCount: number;
  borrowedCount: number;
  repairCount: number;
  categoryStats: { name: string; value: number }[];
  statusStats: { name: string; count: number }[];
  lowStockItems: {
    id: string;
    name: string;
    p_id: string;
    brand: string | null;
    model: string | null;
    category: string;
    current: number;
    total: number;
    image: string | null;
  }[];
}

// COLORS สำหรับกราฟ
export const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      // เรียก RPC get_dashboard_summary (สำหรับ KPI ด้านบน)
      const { data, error } = await supabase
        .rpc('get_dashboard_summary' as any); 
      
      if (error) {
        // กรณี RPC ยังไม่พร้อม หรือ Error ให้ return ค่า default กันหน้าขาว
        console.error("Error fetching dashboard summary:", error);
        return {
          totalValue: 0,
          totalItems: 0,
          availableCount: 0,
          borrowedCount: 0,
          repairCount: 0,
          categoryStats: [],
          statusStats: [],
          lowStockItems: []
        } as DashboardData;
      }
      
      const stats = data as unknown as DashboardData;
      
      // Map สีใส่ categoryStats
      const categoryStatsWithFill = (stats.categoryStats || []).map((cat, index) => ({
        ...cat,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      }));

      return {
        ...stats,
        categoryStats: categoryStatsWithFill
      };
    },
  });
}

// --- ส่วนใหม่: สำหรับตาราง Inventory (ใช้ RPC get_dashboard_inventory) ---

export interface InventorySummaryItem {
  id: string;
  p_id: string;
  name: string;
  image: string | null;
  category: string;
  brand: string | null;
  model: string | null;
  total: number;
  available: number;
  borrowed: number;
  repair: number;
}

export function useDashboardInventory() {
  return useQuery({
    queryKey: ['dashboard-inventory'],
    queryFn: async () => {
      // เรียก RPC get_dashboard_inventory ที่เพิ่งสร้าง
      const { data, error } = await supabase
        .rpc('get_dashboard_inventory' as any);
      
      if (error) {
        console.error("Error fetching inventory:", error);
        throw error;
      }
      
      // Map ข้อมูลให้ตรงกับ UI (เปลี่ยน image_url เป็น image)
      return (data || []).map((item: any) => ({
        id: item.id,
        p_id: item.p_id,
        name: item.name,
        image: item.image_url, // Map จาก SQL column name
        category: item.category,
        brand: item.brand,
        model: item.model,
        total: Number(item.total),      // แปลงเป็น Number เพื่อความชัวร์
        available: Number(item.available),
        borrowed: Number(item.borrowed),
        repair: Number(item.repair)
      })) as InventorySummaryItem[];
    },
  });
}