import { Request, Response } from 'express';
import * as service from './businessInventory.service';
import { success, error } from '../../core/utils/response';

export const getBusinessInventory = async (req: Request, res: Response) => {
  try {
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
        return error(res, 'limit must be a number');
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
        return error(res, 'inStock must be true or false');
      }
      inStock = inStockParam === 'true';
    }

    const result = await service.fetchBusinessInventory({
      limit,
      startAfter,
      search,
      inStock,
    });

    return success(res, result);

  } catch (err) {
    console.error(err);
    return error(res, (err as Error).message || 'Failed to fetch inventory', 500);
  }
};

export const getProductsCount = async (req: Request, res: Response) => {
  try {
    const inStockParam = req.query.inStock;

    let inStock: boolean | undefined;

    if (inStockParam !== undefined) {
      if (inStockParam !== 'true' && inStockParam !== 'false') {
        return error(res, 'inStock must be true or false');
      }
      inStock = inStockParam === 'true';
    }

    const count = await service.fetchProductsCount({ inStock });

    return success(res, { count });

  } catch (err) {
    console.error(err);
    return error(res, (err as Error).message || 'Failed to fetch count', 500);
  }
};