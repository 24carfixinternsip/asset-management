import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

export type UserRole = "admin" | "viewer" | null;

export function useUserRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setRole(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error("User role query failed:", error);
          setRole("viewer");
        } else if (!data) {
          setRole("viewer");
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
