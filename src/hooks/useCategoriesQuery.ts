import { useCategories } from "@/hooks/useMasterData";

// Single source of truth for categories queries across Settings and Products.
export const useCategoriesQuery = useCategories;
