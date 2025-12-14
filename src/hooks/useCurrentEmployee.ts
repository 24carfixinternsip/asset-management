import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Interface ที่เรากำหนดเอง (Manual Type Definition)
export interface EmployeeWithDept {
  id: string;
  emp_code: string;
  name: string;
  email: string | null;
  image_url: string | null;
  department_id: string | null;
  departments: {
    name: string;
  } | null;
}

export function useCurrentEmployee() {
  return useQuery({
    queryKey: ['current-employee'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) return null;

      // 🔴 แก้ปัญหา TS Error 2589 (Excessively deep) แบบถอนรากถอนโคน
      // เรา Cast (supabase as any) เพื่อตัดวงจรการคำนวณ Type ที่ซับซ้อนทิ้งทันที
      const { data, error } = await (supabase as any)
        .from('employees')
        .select(`
          *,
          departments (
            name
          )
        `)
        .eq('email', session.user.email)
        .maybeSingle();

      if (error) {
        console.error("Error fetching employee:", error);
        throw error;
      }
      
      // แปลงข้อมูลที่ได้ (ซึ่งตอนนี้เป็น any) ให้เข้ากับ Interface ที่เรากำหนดไว้
      return data as EmployeeWithDept;
    },
  });
}