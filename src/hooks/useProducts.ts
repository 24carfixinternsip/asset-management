import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getProductsList } from "@/services/products";

export interface Product {
  id: string;
  p_id: string;
  name: string;
  category_id?: string | null;
  model?: string | null;
  category: string;
  category_code?: string | null;
  categories?: {
    id?: string | null;
    name: string | null;
    code: string | null;
  } | null;
  brand: string | null;
  description?: string | null;
  notes?: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  created_at: string;
  updated_at?: string | null;
  stock_total?: number;
  stock_available?: number;
  selected_serial_id?: string;
  selected_serial_code?: string;
}

export interface ProductFilters {
  search?: string;
  categories?: string[];
  categoryId?: string;
}

export interface ProductWithStock extends Product {
  stock_available: number;
}

export interface CreateProductInput {
  p_id: string;
  name: string;
  category: string;
  category_id?: string | null;
  brand?: string;
  model?: string;
  description?: string;
  notes?: string;
  price: number;
  unit: string;
  image_url?: string;
  initial_quantity: number;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
  current_quantity: number;
}

interface CreateProductRPCParams {
  arg_p_id: string;
  arg_name: string;
  arg_category: string;
  arg_brand?: string | null;
  arg_model?: string | null;
  arg_description?: string | null;
  arg_notes?: string | null;
  arg_price: number;
  arg_unit: string;
  arg_image_url?: string | null;
  arg_initial_quantity: number;
}

export function useProducts(page: number = 1, pageSize: number = 10, filters?: ProductFilters) {
  const filtersKey = JSON.stringify({
    search: filters?.search?.trim() || "",
    categories: filters?.categories?.length ? [...filters.categories].sort() : [],
    categoryId: filters?.categoryId || "",
  });

  return useQuery({
    queryKey: ["products", page, pageSize, filtersKey],
    queryFn: async () =>
      getProductsList({
        page,
        pageSize,
        search: filters?.search,
        categoryId: filters?.categoryId,
        categories: filters?.categories,
      }),
    placeholderData: (prev) => prev,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const rpcParams: CreateProductRPCParams = {
        arg_p_id: input.p_id,
        arg_name: input.name,
        arg_category: input.category,
        arg_brand: input.brand || null,
        arg_model: input.model || null,
        arg_description: input.description || null,
        arg_notes: input.notes || null,
        arg_price: Number(input.price),
        arg_unit: input.unit,
        arg_image_url: input.image_url || null,
        arg_initial_quantity: Number(input.initial_quantity),
      };

      const { data, error } = await supabase.rpc("create_product_and_serials", rpcParams);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["serials"] });
      toast.success("Product and serials created successfully.");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProductInput) => {
      const rpcParams = {
        arg_product_id: input.id,
        arg_sku: input.p_id,
        arg_name: input.name || "",
        arg_category: input.category || "",
        arg_brand: input.brand || null,
        arg_model: input.model || null,
        arg_description: input.description || null,
        arg_notes: input.notes || null,
        arg_price: Number(input.price) || 0,
        arg_unit: input.unit || "",
        arg_image_url: input.image_url || null,
        arg_new_total_quantity: Number(input.initial_quantity) || 0,
      };

      const { data, error } = await supabase.rpc("update_product_and_stock", rpcParams);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["serials"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Product and stock updated successfully.");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update product: ${error.message}`);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("delete_product_safe", { arg_product_id: id });
      if (error) throw error;
      // @ts-ignore
      if (data && data.success === false) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["serials"] });
      toast.success("Product deleted successfully.");
    },
    onError: (error: Error) => {
      toast.error(`${error.message}`);
    },
  });
}
