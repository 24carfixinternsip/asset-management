import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// COLORS สำหรับกราฟ
export const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_summary');
      
      if (error) {
        console.error("Error fetching dashboard summary:", error);
        throw error;
      }
      
      const categoryStatsWithFill = (data.categoryStats || []).map((cat, index) => ({
        ...cat,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      }));

      return {
        ...data,
        categoryStats: categoryStatsWithFill
      };
    },
  });
}

export function useDashboardInventory() {
  return useQuery({
    queryKey: ['dashboard-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_inventory');
      
      if (error) {
        console.error("Error fetching inventory:", error);
        throw error;
      }
      
      // Type 
      return data.map((item) => ({
        ...item,
        image: item.image_url,
        total: Number(item.total),
        available: Number(item.available),
        borrowed: Number(item.borrowed),
        issue: Number(item.issue),
        inactive: Number(item.inactive)
      }));
    },
  });
}