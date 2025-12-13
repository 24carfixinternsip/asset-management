import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by_email: string;
  created_at: string;
}

export function useAuditLogs(tableName: string, recordId: string | undefined) {
  return useQuery({
    queryKey: ['audit-logs', tableName, recordId],
    queryFn: async () => {
      if (!recordId) return [];
      
      // ใช้ "as any" เพื่อแก้ปัญหา TypeScript ไม่รู้จักชื่อ View ใหม่
      const { data, error } = await supabase
        .from('audit_logs_view' as unknown as keyof Database['public']['Tables']) 
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // แปลงข้อมูลที่ได้ให้ตรงกับ Interface ที่เรากำหนด
      return data as unknown as AuditLog[];
    },
    enabled: !!recordId, // ทำงานเฉพาะเมื่อมี recordId ส่งมา
  });
}
