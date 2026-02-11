import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export type CategoryWritePayload = {
  name: string;
  code: string;
  note?: string | null;
  parent_id?: string | null;
  type?: string | null;
  sort_order?: number | null;
};

type AuthError = Error & { status?: number; code?: string };

const ensureAuthenticatedSession = async () => {
  // Developer note: client writes must run with an authenticated Supabase session.
  // If this fails for logged-in users, verify RLS policies for `categories` and related RPCs.
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const authError = new Error("Permission denied: missing authenticated session") as AuthError;
    authError.status = 401;
    authError.code = "AUTH_SESSION_MISSING";
    throw authError;
  }
};

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(payload: CategoryWritePayload): Promise<Category> {
  await ensureAuthenticatedSession();
  const normalizedName = payload.name.trim();
  const normalizedCode = payload.code.trim().toUpperCase();
  const createPayload: Database["public"]["Tables"]["categories"]["Insert"] = {
    name: normalizedName,
    code: normalizedCode,
    note: payload.note ?? null,
    parent_id: payload.parent_id ?? null,
    type: payload.type ?? (payload.parent_id ? "sub" : "main"),
    sort_order: payload.sort_order ?? null,
  };

  const { data, error } = await supabase.from("categories").insert(createPayload).select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Unable to create category");
  return data as Category;
}

export async function updateCategory(id: string, payload: CategoryWritePayload): Promise<Category> {
  await ensureAuthenticatedSession();
  const normalizedName = payload.name.trim();
  const normalizedCode = payload.code.trim().toUpperCase();
  const updatePayload: Database["public"]["Tables"]["categories"]["Update"] = {
    name: normalizedName,
    code: normalizedCode,
    note: payload.note ?? null,
    parent_id: payload.parent_id ?? null,
    type: payload.type ?? (payload.parent_id ? "sub" : "main"),
    sort_order: payload.sort_order ?? null,
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
  await ensureAuthenticatedSession();
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
