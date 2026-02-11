import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Department = Tables<"departments">;
export type Location = Tables<"locations">;
export type Category = Tables<"categories">;

type AuthError = Error & { status?: number; code?: string };

const ensureAuthenticatedSession = async () => {
  // Developer note: master-data CRUD relies on authenticated user JWT.
  // If RLS blocks writes for role `authenticated`, update table policies in Supabase.
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const authError = new Error("Permission denied: missing authenticated session") as AuthError;
    authError.status = 401;
    authError.code = "AUTH_SESSION_MISSING";
    throw authError;
  }
};

const isMultipleRowsError = (error: { code?: string; message?: string }) => {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST116" ||
    message.includes("single json object") ||
    (message.includes("multiple") && message.includes("rows"))
  );
};

// Centralized master-data API layer for consistent CRUD behavior.
export const masterDataApi = {
  listDepartments: async () => {
    const { data, error } = await supabase.from("departments").select("*").order("name");
    if (error) throw error;
    return data as Department[];
  },
  createDepartment: async (payload: TablesInsert<"departments">) => {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.from("departments").insert(payload).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("ไม่สามารถเพิ่มแผนกได้ กรุณาลองใหม่");
    return data as Department;
  },
  updateDepartment: async (payload: TablesUpdate<"departments"> & { id: string }) => {
    await ensureAuthenticatedSession();
    const { id, ...updates } = payload;
    if (!id) throw new Error("ไม่พบรหัสแผนกที่ต้องการอัปเดต");
    const { data, error } = await supabase.from("departments").update(updates).eq("id", id).select("*").maybeSingle();
    if (error) {
      if (isMultipleRowsError(error)) {
        throw new Error("พบข้อมูลแผนกซ้ำซ้อน กรุณาตรวจสอบข้อมูลในระบบ");
      }
      throw error;
    }
    if (!data) throw new Error("ไม่พบข้อมูลแผนกที่ต้องการอัปเดต");
    return data as Department;
  },
  deleteDepartment: async (id: string) => {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.from("departments").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("ไม่พบแผนกสำหรับลบ");
    }
    return { success: true, message: "deleted" };
  },

  listLocations: async () => {
    const { data, error } = await supabase.from("locations").select("*").order("name");
    if (error) throw error;
    return data as Location[];
  },
  createLocation: async (payload: TablesInsert<"locations">) => {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.from("locations").insert(payload).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("ไม่สามารถเพิ่มสถานที่ได้ กรุณาลองใหม่");
    return data as Location;
  },
  updateLocation: async (payload: TablesUpdate<"locations"> & { id: string }) => {
    await ensureAuthenticatedSession();
    const { id, ...updates } = payload;
    if (!id) throw new Error("ไม่พบรหัสสถานที่ที่ต้องการอัปเดต");
    const { data, error } = await supabase.from("locations").update(updates).eq("id", id).select("*").maybeSingle();
    if (error) {
      if (isMultipleRowsError(error)) {
        throw new Error("พบข้อมูลสถานที่ซ้ำซ้อน กรุณาตรวจสอบข้อมูลในระบบ");
      }
      throw error;
    }
    if (!data) throw new Error("ไม่พบข้อมูลสถานที่ที่ต้องการอัปเดต");
    return data as Location;
  },
  deleteLocation: async (id: string) => {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.rpc("delete_location_safe", {
      arg_location_id: id,
    });
    if (error) {
      // Fallback for environments where the RPC hasn't been deployed yet.
      const shouldFallback = error.message?.toLowerCase().includes("function") || error.message?.toLowerCase().includes("rpc");
      if (!shouldFallback) throw error;
      const fallback = await supabase.from("locations").delete().eq("id", id);
      if (fallback.error) throw fallback.error;
      return { success: true, message: "deleted" };
    }
    const result = data as { success: boolean; message: string };
    if (!result.success) throw new Error(result.message);
    return result;
  },

  listCategories: async () => {
    // Avoid ordering by optional columns (e.g., sort_order) that may be missing in some schemas.
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data as Category[];
  },
  createCategory: async (payload: TablesInsert<"categories">) => {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.from("categories").insert(payload).select();
    if (error) throw error;
    const created = data?.[0];
    if (!created) throw new Error("ไม่สามารถสร้างหมวดหมู่ได้");
    return created as Category;
  },
  updateCategory: async (payload: TablesUpdate<"categories"> & { id: string }) => {
    await ensureAuthenticatedSession();
    const { id, ...updates } = payload;
    const { data, error } = await supabase.from("categories").update(updates).eq("id", id).select();
    if (error) throw error;
    const updated = data?.[0];
    if (!updated) throw new Error("ไม่พบข้อมูลหมวดหมู่สำหรับอัปเดต");
    return updated as Category;
  },
  deleteCategory: async (id: string) => {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.rpc("delete_category_safe", {
      arg_category_id: id,
    });
    if (error) {
      // Fallback for environments where the RPC hasn't been deployed yet.
      const shouldFallback = error.message?.toLowerCase().includes("function") || error.message?.toLowerCase().includes("rpc");
      if (!shouldFallback) throw error;
      const fallback = await supabase.from("categories").delete().eq("id", id);
      if (fallback.error) throw fallback.error;
      return { success: true, message: "deleted" };
    }
    const result = data as { success: boolean; message: string };
    if (!result.success) throw new Error(result.message);
    return result;
  },

  deleteCategoriesBatch: async (ids: string[]) => {
    await ensureAuthenticatedSession();
    const { error } = await supabase.from("categories").delete().in("id", ids);
    if (error) throw error;
    return ids;
  },
  reorderCategories: async (updates: { id: string; sort_order: number }[]) => {
    await ensureAuthenticatedSession();
    const { error } = await supabase.from("categories").upsert(updates, { onConflict: "id" });
    if (error) throw error;
    return updates;
  },
};
