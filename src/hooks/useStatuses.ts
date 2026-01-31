import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SerialStatus, StickerStatus } from '@/integrations/supabase/types';

// ========================================
// Hook: ดึง Serial Statuses
// ========================================
export function useSerialStatuses() {
  return useQuery({
    queryKey: ['serial-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('serial_statuses')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as SerialStatus[];
    },
    staleTime: 1000 * 60 * 60, // Cache 1 ชม. (ไม่ค่อยเปลี่ยน)
  });
}

// ========================================
// Hook: ดึง Sticker Statuses
// ========================================
export function useStickerStatuses() {
  return useQuery({
    queryKey: ['sticker-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sticker_statuses')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as StickerStatus[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

// ========================================
// Helper: แปลง status_code -> display_name_th
// ========================================
export function getSerialStatusDisplay(
  statusCode: string,
  statuses?: SerialStatus[]
): string {
  if (!statuses) return statusCode;
  const status = statuses.find((s) => s.status_code === statusCode);
  return status?.display_name_th || statusCode;
}

export function getStickerStatusDisplay(
  statusCode: string,
  statuses?: StickerStatus[]
): string {
  if (!statuses) return statusCode;
  const status = statuses.find((s) => s.status_code === statusCode);
  return status?.display_name_th || statusCode;
}
