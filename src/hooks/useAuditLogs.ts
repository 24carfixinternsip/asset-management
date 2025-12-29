import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by_email: string;
  created_at: string;
}

const parseLogData = (data: Json | null): Record<string, unknown> | null => {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data as Record<string, unknown>;
};

export function useAuditLogs(tableName: string, recordId: string | undefined) {
  return useQuery({
    queryKey: ['audit-logs', tableName, recordId],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (!recordId) return [];
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching audit logs:", error);
        throw error;
      }
      
      return (data as any[]).map(item => ({
        id: item.id,
        table_name: item.table_name,
        record_id: item.record_id,
        operation: item.operation,
        old_data: typeof item.old_data === 'string' ? JSON.parse(item.old_data) : item.old_data, // Handle potential JSON string
        new_data: typeof item.new_data === 'string' ? JSON.parse(item.new_data) : item.new_data,
        changed_by_email: item.changed_by_email || 'System', // Fallback if null
        created_at: item.created_at
      }));
    },
    enabled: !!recordId, 
  });
}