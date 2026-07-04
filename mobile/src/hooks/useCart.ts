import { useQuery } from "@tanstack/react-query";
import { listCart } from "@/api/cart";

export function useCartQuery() {
  return useQuery({ queryKey: ["cart"], queryFn: listCart });
}
