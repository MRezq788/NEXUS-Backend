import { Request, Response } from 'express';
import * as service from './businessInventory.service';
import { successResponse, errorResponse } from '../../core/utils/response';

export const getBusinessInventory = async (req: Request, res: Response) => {
  try {
    const email = req.headers["x-user-email"] as string | undefined; 
    if (!email) { 
        return errorResponse(res, "Missing X-User-Email header"); 
    }

    const limitParam = req.query.limit;
    const startAfterParam = req.query.startAfter;
    const searchParam = req.query.search;
    const inStockParam = req.query.inStock;

    let limit: number | undefined;
    let startAfter: string | undefined;
    let search: string | undefined;
    let inStock: boolean | undefined;

    if (limitParam !== undefined) {
      const parsed = Number(limitParam);
      if (isNaN(parsed)) {
        return errorResponse(res, 'limit must be a number');
      }
      limit = parsed;
    }

    if (startAfterParam !== undefined) {
      startAfter = String(startAfterParam);
    }

    if (searchParam !== undefined) {
      search = String(searchParam);
    }

    if (inStockParam !== undefined) {
      if (inStockParam !== 'true' && inStockParam !== 'false') {
        return errorResponse(res, 'inStock must be true or false');
      }
      inStock = inStockParam === 'true';
    }

    const result = await service.fetchBusinessInventory({
      email,
      limit,
      startAfter,
      search,
      inStock,
    });

    return successResponse(res, result);

  } catch (err) {
    console.error(err);
    return errorResponse(res, (err as Error).message || 'Failed to fetch inventory', 500);
  }
};

export const getProductsCount = async (req: Request, res: Response) => {
  try {
    const email = req.headers["x-user-email"] as string | undefined; 
    if (!email) { 
        return errorResponse(res, "Missing X-User-Email header"); 
    }

    const inStockParam = req.query.inStock;

    let inStock: boolean | undefined;

    if (inStockParam !== undefined) {
      if (inStockParam !== 'true' && inStockParam !== 'false') {
        return errorResponse(res, 'inStock must be true or false');
      }
      inStock = inStockParam === 'true';
    }

    const count = await service.fetchProductsCount({ email, inStock });

    return successResponse(res, { count });

  } catch (err) {
    console.error(err);
    return errorResponse(res, (err as Error).message || 'Failed to fetch count', 500);
  }
};