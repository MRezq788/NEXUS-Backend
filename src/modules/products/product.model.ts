export type ProductStatus = 'In Stock' | 'Out of Stock';

export interface Product {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number; // Added
  description: string;
  status: ProductStatus;
  category: string; // Now required
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