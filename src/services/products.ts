import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CategoryJoin = Pick<Database["public"]["Tables"]["categories"]["Row"], "id" | "name" | "code">;

type ProductBaseRow = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "id"
  | "p_id"
  | "name"
  | "brand"
  | "model"
  | "description"
  | "notes"
  | "price"
  | "unit"
  | "image_url"
  | "updated_at"
  | "created_at"
  | "category_id"
> & {
  categories: CategoryJoin | CategoryJoin[] | null;
};

export type ProductListItem = {
  id: string;
  p_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  notes: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  updated_at: string | null;
  created_at: string | null;
  category_id: string | null;
  category: string;
  categories: CategoryJoin | null;
  stock_total: number;
  stock_available: number;
  quantity: number;
};

export type GetProductsListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  categories?: string[];
};

export type GetProductsListResult = {
  data: ProductListItem[];
  total: number;
  totalPages: number;
};

const normalizeCategoryRelation = (value: CategoryJoin | CategoryJoin[] | null): CategoryJoin | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

export async function getProductsList(params: GetProductsListParams = {}): Promise<GetProductsListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select(
      "id,p_id,name,brand,model,description,notes,price,unit,image_url,updated_at,created_at,category_id,categories(id,name,code)",
      { count: "exact" },
    );

  if (params.search) {
    const term = params.search.trim();
    const keywords = term.split(/\s+/).filter((keyword) => keyword.length > 0);
    if (keywords.length > 0) {
      const orParts = keywords.flatMap((keyword) => [
        `name.ilike.%${keyword}%`,
        `p_id.ilike.%${keyword}%`,
        `brand.ilike.%${keyword}%`,
        `model.ilike.%${keyword}%`,
      ]);
      query = query.or(orParts.join(","));
    }
  }

  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  } else if (params.categories && params.categories.length > 0) {
    // Legacy compatibility for pages still sending text-based category filters.
    query = query.in("category", params.categories);
  }

  const { data, count, error } = await query.order("p_id", { ascending: true }).range(from, to);
  if (error) throw error;

  const rows = ((data ?? []) as ProductBaseRow[]).map((row) => ({
    ...row,
    categories: normalizeCategoryRelation(row.categories),
  }));

  const productIds = rows.map((row) => row.id);
  const stockById = new Map<string, { stock_total: number; stock_available: number }>();

  if (productIds.length > 0) {
    const { data: stockRows, error: stockError } = await supabase
      .from("view_products_with_stock")
      .select("id,stock_total,stock_available")
      .in("id", productIds);

    if (stockError) throw stockError;

    (stockRows ?? []).forEach((row) => {
      stockById.set(row.id, {
        stock_total: row.stock_total ?? 0,
        stock_available: row.stock_available ?? 0,
      });
    });
  }

  const normalized: ProductListItem[] = rows.map((row) => {
    const stock = stockById.get(row.id) ?? { stock_total: 0, stock_available: 0 };
    return {
      id: row.id,
      p_id: row.p_id,
      name: row.name,
      brand: row.brand,
      model: row.model,
      description: row.description,
      notes: row.notes,
      price: row.price ?? 0,
      unit: row.unit ?? "",
      image_url: row.image_url,
      updated_at: row.updated_at,
      created_at: row.created_at,
      category_id: row.category_id,
      category: row.categories?.name ?? "-",
      categories: row.categories,
      stock_total: stock.stock_total,
      stock_available: stock.stock_available,
      quantity: stock.stock_total,
    };
  });

  return {
    data: normalized,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

export type UpdateProductPayload = {
  p_id?: string;
  name?: string;
  category_id?: string | null;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  notes?: string | null;
  price?: number;
  unit?: string;
  image_url?: string | null;
};

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<ProductBaseRow> {
  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", id)
    .select("*, categories(id,name,code)")
    .single();

  if (error) throw error;
  return data as ProductBaseRow;
}

const isMissingFunctionError = (message?: string | null) => {
  const text = (message ?? "").toLowerCase();
  return (
    text.includes("function") ||
    text.includes("does not exist") ||
    text.includes("get_next_product_pid") ||
    text.includes("generate_next_product_pid") ||
    text.includes("next_product_pid_by_category")
  );
};

export async function regeneratePid(categoryId: string): Promise<string> {
  const normalizedCategoryId = categoryId.trim();
  if (!normalizedCategoryId) {
    throw new Error("Category is required");
  }

  const preferred = await supabase.rpc("generate_next_product_pid", {
    p_category_id: normalizedCategoryId,
  });
  if (!preferred.error && preferred.data) return preferred.data;

  // Backward compatibility for older DB functions.
  const byCategory = await supabase.rpc("next_product_pid_by_category", {
    p_category_id: normalizedCategoryId,
  });
  if (!byCategory.error && byCategory.data) return byCategory.data;

  if (!isMissingFunctionError(byCategory.error?.message)) {
    if (byCategory.error) throw byCategory.error;
  }

  const { data: categoryRow, error: categoryError } = await supabase
    .from("categories")
    .select("code")
    .eq("id", normalizedCategoryId)
    .single();
  if (categoryError) throw categoryError;

  const normalizedCode = (categoryRow?.code ?? "").trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("Category code is required before generating SKU");
  }

  const byCode = await supabase.rpc("get_next_product_pid", {
    category_code: normalizedCode,
  });
  if (!byCode.error && byCode.data) return byCode.data;

  if (preferred.error && !isMissingFunctionError(preferred.error.message)) {
    throw preferred.error;
  }
  if (byCode.error) throw byCode.error;
  throw new Error("Unable to generate SKU");
}
