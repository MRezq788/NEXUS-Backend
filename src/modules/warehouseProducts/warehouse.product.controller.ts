import { Request, Response, NextFunction } from 'express';
import { productService } from './warehouse.product.service';
import { successResponse, errorResponse, paginatedResponse } from '../../core/utils/response';
import { getPaginationParams } from '../../core/utils/pagination';

// Extend Express Request to include userEmail
declare global {
  namespace Express {
    interface Request {
      userEmail?: string;
    }
  }
}

export function extractUserEmail(req: Request, res: Response, next: NextFunction) {
  const email = req.headers['x-user-email'] as string;
  if (email) {
    req.userEmail = email;
  }
  next();
}

export class ProductController {
  // Helper to get email from request
  private getUserEmail(req: Request): string {
    const email = req.userEmail || req.headers['x-user-email'] as string;
    if (!email) {
      throw new Error('User email not provided');
    }
    return email;
  }

  // GET /api/products?page=1&limit=5&search=&status=
  getProducts = async (req: Request, res: Response) => {  
    try {
      const userEmail = this.getUserEmail(req);
      const { page, limit } = getPaginationParams(req.query);
      const search = req.query.search as string | undefined;
      const status = req.query.status as 'In Stock' | 'Out of Stock' | 'All' | undefined;

      const result = await productService.getProducts(userEmail, page, limit, search, status);
      
      const formattedResponse = {
        products: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };

      return paginatedResponse(res, formattedResponse, 'Products retrieved successfully');
    } catch (error) {
      console.error('Get products error:', error);
      const message = error instanceof Error ? error.message : 'Failed to retrieve products';
      return errorResponse(res, message, 500);
    }
  };

  // POST /api/products - Create new product
  createProduct = async (req: Request, res: Response) => {  
    try {
      const userEmail = this.getUserEmail(req);
      const { name, quantity, unit, price, description, category } = req.body;
      
      if (!name) {
        return errorResponse(res, 'Product name is required', 400);
      }

      const product = await productService.createProduct(userEmail, {
        name,
        quantity,
        unit,
        price,
        description,
        category,
      });

      return successResponse(res, product, 'Product created successfully', 201);
    } catch (error) {
      console.error('Create product error:', error);
      const message = error instanceof Error ? error.message : 'Failed to create product';
      return errorResponse(res, message, 500);
    }
  };

  // PUT /api/products/:id - Update product
  updateProduct = async (req: Request, res: Response) => {  
    try {
      const userEmail = this.getUserEmail(req);
      const id = req.params.id as string;
      const {
        name, quantity, unit, price, basePrice,
        description, category, images, attributes, variants, active,
      } = req.body;

      const product = await productService.updateProduct(userEmail, id, {
        name,
        quantity,
        unit,
        price,
        basePrice,
        description,
        category,
        images,
        attributes,
        variants,
        active,
      });

      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      return successResponse(res, product, 'Product updated successfully');
    } catch (error) {
      console.error('Update product error:', error);
      const message = error instanceof Error ? error.message : 'Failed to update product';
      return errorResponse(res, message, 500);
    }
  };

  // DELETE /api/products/:id - Delete product
  deleteProduct = async (req: Request, res: Response) => {  
    try {
      const userEmail = this.getUserEmail(req);
      const id = req.params.id as string;
      
      const deleted = await productService.deleteProduct(userEmail, id);
      
      if (!deleted) {
        return errorResponse(res, 'Product not found', 404);
      }

      return successResponse(res, null, 'Product deleted successfully');
    } catch (error) {
      console.error('Delete product error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete product';
      return errorResponse(res, message, 500);
    }
  };

  // DELETE /api/products/batch - Batch delete
  deleteBatch = async (req: Request, res: Response) => {  
    try {
      const userEmail = this.getUserEmail(req);
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 'Invalid or empty ids array', 400);
      }

      const deletedCount = await productService.deleteProductsBatch(userEmail, ids);
      
      return successResponse(res, { deletedCount }, `${deletedCount} products deleted successfully`);
    } catch (error) {
      console.error('Batch delete error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete products';
      return errorResponse(res, message, 500);
    }
  };

  // GET /api/products/stats - Get statistics
  getStats = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const stats = await productService.getStatistics(userEmail);
      return successResponse(res, stats, 'Statistics retrieved successfully');
    } catch (error) {
      console.error('Get stats error:', error);
      const message = error instanceof Error ? error.message : 'Failed to retrieve statistics';
      return errorResponse(res, message, 500);
    }
  };

// GET /api/products/:id - Get single product
getProductById = async (req: Request, res: Response) => {
  try {
    const userEmail = this.getUserEmail(req);
    const id = req.params.id as string;

    const product = await productService.getProductById(userEmail, id);
    
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    return successResponse(res, product, 'Product retrieved successfully');
  } catch (error) {
    console.error('Get product error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve product';
    return errorResponse(res, message, 500);
  }
};

// POST /api/products/batch-upload - Batch create products from CSV
batchCreateProducts = async (req: Request, res: Response) => {  
  try {
    const userEmail = this.getUserEmail(req);
    const { products } = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return errorResponse(res, 'No valid products provided', 400);
    }

    const result = await productService.createProductsBatch(userEmail, products);
    
    return successResponse(res, result, `Batch upload completed: ${result.created} created, ${result.failed} failed`);
  } catch (error) {
    console.error('Batch create error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process batch upload';
    return errorResponse(res, message, 500);
  }
};
}

export const productController = new ProductController();