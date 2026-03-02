import { Request, Response } from 'express';
import * as service from './warehouseproduct.service';
import { success, error } from '../../core/utils/response';

export const getProduct = async (req: Request, res: Response) => {
  try {
    const email = req.headers["x-user-email"] as string | undefined; 
    if (!email) { 
        return error(res, "Missing X-User-Email header"); 
    }

    const limitParam = req.query.limit;
    const startAfterParam = req.query.startAfter;
    const searchParam = req.query.search;

    let limit: number | undefined;
    let startAfter: string | undefined;
    let search: string | undefined;

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
    
    const result = await service.fetchProduct({
      email,
      limit,
      startAfter,
      search,
    });

    return success(res, result);

  } catch (err) {
    console.error(err);
    return error(res, (err as Error).message || 'Failed to fetch inventory', 500);
  }
};