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

  async createProductsBatch(userEmail: string, productsData: Partial<Product>[]): Promise<{ created: number; failed: number; errors: string[] }> {
    const created: Product[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < productsData.length; i++) {
      const data = productsData[i];
      try {
        // Validate required fields
        if (!data.name || data.name.trim() === '') {
          errors.push(`Row ${i + 1}: Product name is required`);
          continue;
        }
        
        // Validate quantity is a number
        if (data.quantity === undefined || data.quantity === null || isNaN(Number(data.quantity))) {
          errors.push(`Row ${i + 1}: Invalid quantity for "${data.name}"`);
          continue;
        }
        
        // Validate price is a number
        if (data.price === undefined || data.price === null || isNaN(Number(data.price))) {
          errors.push(`Row ${i + 1}: Invalid price for "${data.name}"`);
          continue;
        }

        const product = await productRepository.create(userEmail, {
          name: data.name.trim(),
          quantity: Number(data.quantity),
          unit: data.unit || 'kg',
          price: Number(data.price),
          description: data.description || '',
          category: data.category || 'Uncategorized',
        });
        
        created.push(product);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      created: created.length,
      failed: productsData.length - created.length,
      errors,
    };
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