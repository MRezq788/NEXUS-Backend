export type OrderStatus = "pending" | "processing" | "completed" | "cancelled";

export interface OrderProduct {
  productId: string;
  quantity: number;
  price?: number;
  variantId?: string;
  variantAttributes?: Record<string, string>;
  productName?: string;
  productImage?: string;
  unit?: string;
  lineTotal?: number;
}

export interface Order {
  id: string;
  buyer: string;
  total: number;
  status: OrderStatus;
  products: OrderProduct[];
  ownerProductAccess?: boolean;
  ownerProductAccessAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
