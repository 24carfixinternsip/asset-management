import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export type CategoryWritePayload = {
  name: string;
  code: string;
  note?: string | null;
};

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(payload: CategoryWritePayload): Promise<Category> {
  const normalizedName = payload.name.trim();
  const normalizedCode = payload.code.trim().toUpperCase();
  const createPayload: Database["public"]["Tables"]["categories"]["Insert"] = {
    name: normalizedName,
    code: normalizedCode,
    note: payload.note ?? null,
  };

  const { data, error } = await supabase.from("categories").insert(createPayload).select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Unable to create category");
  return data as Category;
}

export async function updateCategory(id: string, payload: CategoryWritePayload): Promise<Category> {
  const normalizedName = payload.name.trim();
  const normalizedCode = payload.code.trim().toUpperCase();
  const updatePayload: Database["public"]["Tables"]["categories"]["Update"] = {
    name: normalizedName,
    code: normalizedCode,
    note: payload.note ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("categories")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Unable to update category");
  return data as Category;
}

export async function deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc("delete_category_safe", {
    arg_category_id: id,
  });

  if (error) {
    const shouldFallback =
      error.message?.toLowerCase().includes("function") || error.message?.toLowerCase().includes("rpc");
    if (!shouldFallback) throw error;

    const fallback = await supabase.from("categories").delete().eq("id", id);
    if (fallback.error) throw fallback.error;
    return { success: true, message: "deleted" };
  }

  const result = data as { success: boolean; message: string };
  if (!result.success) throw new Error(result.message);
  return result;
}
