export type ProductStatus = 'In Stock' | 'Out of Stock';

export interface ProductVariant {
  id: string;
  attributes: Record<string, string>;
  price: number;
  quantity: number;
}

export interface ProductAttribute {
  name: string;
  values: string[];
}

export interface Product {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  basePrice?: number;
  description: string;
  status: ProductStatus;
  category: string;
  images?: string[];
  attributes?: ProductAttribute[];
  variants?: ProductVariant[];
  active?: boolean;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

export function computeStatus(quantity: number): ProductStatus {
  return quantity === 0 ? 'Out of Stock' : 'In Stock';
}

export function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}