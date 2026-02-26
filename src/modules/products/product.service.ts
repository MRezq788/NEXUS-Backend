import { productRepository } from './product.repository';
import { Product } from './product.model';
import { createPaginatedResult, PaginatedResult } from '../../core/utils/pagination';

export class ProductService {
  async getProducts(
    userEmail: string,
    page: number,
    limit: number,
    search?: string,
    status?: 'In Stock' | 'Out of Stock' | 'All'
  ): Promise<PaginatedResult<Product>> {
    const { products, total } = await productRepository.findAll(userEmail, page, limit, search, status);
    
    return createPaginatedResult(products, total, page, limit);
  }

  async getProductById(userEmail: string, id: string): Promise<Product | null> {
    return productRepository.findById(userEmail, id);
  }

  async createProduct(userEmail: string, productData: Partial<Product>): Promise<Product> {
    return productRepository.create(userEmail, productData);
  }

  async updateProduct(userEmail: string, id: string, productData: Partial<Product>): Promise<Product | null> {
    return productRepository.update(userEmail, id, productData);
  }

  async deleteProduct(userEmail: string, id: string): Promise<boolean> {
    return productRepository.delete(userEmail, id);
  }

  async deleteProductsBatch(userEmail: string, ids: string[]): Promise<number> {
    return productRepository.deleteBatch(userEmail, ids);
  }

  async getStatistics(userEmail: string) {
    return productRepository.getStats(userEmail);
  }
}

export const productService = new ProductService();