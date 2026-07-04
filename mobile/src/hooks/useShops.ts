import { useQuery } from "@tanstack/react-query";
import { listShops } from "@/api/shops";

export function useShopsQuery() {
  return useQuery({ queryKey: ["shops"], queryFn: listShops });
}
