import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

export type UserRole = "admin" | "viewer" | null;

export function useUserRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation(); // เพื่อให้ re-check เมื่อเปลี่ยนหน้า (optional)

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setRole(null);
          setLoading(false);
          return;
        }

        // Query ตาราง user_roles ตาม SQL ที่คุณให้มา
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (error || !data) {
          console.warn("User role not found, defaulting to viewer");
          setRole("viewer"); // ถ้าไม่เจอใน DB ให้เป็น Viewer เพื่อความปลอดภัย
        } else {
          setRole(data.role as UserRole);
        }
      } catch (error) {
        console.error("Error fetching role:", error);
        setRole("viewer");
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [location.pathname]);

  return { role, loading, isAdmin: role === "admin" };
}