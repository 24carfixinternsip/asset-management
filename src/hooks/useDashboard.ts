import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface InventoryItemSummary {
  id: string;
  name: string;
  category: string;
  p_id: string;
  image: string | null;
  brand: string | null;
  model: string | null;
  total: number;
  available: number;
  borrowed: number;
  repair: number;
}

export interface DashboardStats {
  totalValue: number;
  totalItems: number;
  borrowedCount: number;
  repairCount: number;
  availableCount: number;
  categoryStats: { name: string; value: number; fill: string }[];
  statusStats: { name: string; count: number }[];
  // [UPDATED] เพิ่ม p_id, brand, model, category ให้ lowStockItems เพื่อใช้ Search/Filter
  lowStockItems: { 
    id: string; 
    name: string; 
    p_id: string;
    brand: string | null;
    model: string | null;
    category: string;
    current: number; 
    total: number; 
    image: string | null 
  }[];
  inventorySummary: InventoryItemSummary[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type SerialRow = Database["public"]["Tables"]["product_serials"]["Row"];

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      // 1. Fetch Products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (productsError) throw productsError;
      
      // 2. Fetch Serials
      const { data: serials, error: serialsError } = await supabase
        .from('product_serials')
        .select('product_id, status');
      
      if (serialsError) throw serialsError;
      
      // --- Calculations ---

      let totalValue = 0;
      const lowStockItems: DashboardStats['lowStockItems'] = [];
      const inventoryMap: Record<string, InventoryItemSummary> = {};

      // Initialize Map
      (products ?? []).forEach((p: ProductRow) => {
        inventoryMap[p.id] = {
          id: p.id,
          name: p.name,
          category: p.category,
          p_id: p.p_id,
          image: p.image_url,
          brand: p.brand || null,
          model: p.model || null,
          total: 0,
          available: 0,
          borrowed: 0,
          repair: 0
        };
      });

      let borrowedCount = 0;
      let repairCount = 0;
      let availableCount = 0;

      // Count Serials
      (serials ?? []).forEach((s: SerialRow) => {
        const item = inventoryMap[s.product_id];
        if (item) {
          item.total++;
          const status = s.status || '';
          if (['Ready', 'พร้อมใช้'].includes(status)) {
            item.available++;
            availableCount++;
          } else if (['Borrowed', 'ถูกยืม', 'Active'].includes(status)) {
            item.borrowed++;
            borrowedCount++;
          } else if (['Repair', 'ส่งซ่อม', 'ซ่อม', 'เสีย', 'พัง', 'ไม่พร้อมใช้', 'Missing', 'หาย'].includes(status)) {
            item.repair++;
            repairCount++;
          }
        }
      });

      // Summarize
      const inventorySummary = Object.values(inventoryMap);

      inventorySummary.forEach(item => {
        const product = products.find(p => p.id === item.id);
        totalValue += (Number(product?.price) || 0) * item.total;

        // Low Stock Logic
        if (item.available < 3 && item.total > 0) {
          lowStockItems.push({
            id: item.id,
            name: item.name,
            p_id: item.p_id,
            brand: item.brand,
            model: item.model,
            category: item.category,
            current: item.available,
            total: item.total,
            image: item.image
          });
        }
      });

      const categoryMap = products.reduce((acc, p) => {
        const shortCat = p.category.match(/\(([^)]+)\)/)?.[1] || p.category.substring(0, 10);
        acc[shortCat] = (acc[shortCat] || 0) + inventoryMap[p.id].total;
        return acc;
      }, {} as Record<string, number>);

      const categoryStats = Object.entries(categoryMap)
        .map(([name, value], index) => ({
          name,
          value,
          fill: COLORS[index % COLORS.length]
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      const statusStats = [
        { name: 'พร้อมใช้', count: availableCount },
        { name: 'ถูกยืม', count: borrowedCount },
        { name: 'ส่งซ่อม', count: repairCount },
      ];
      
      return {
        totalValue,
        totalItems: serials.length,
        borrowedCount,
        repairCount,
        availableCount,
        categoryStats,
        statusStats,
        lowStockItems,
        inventorySummary 
      } as DashboardStats;
    },
  });
}
