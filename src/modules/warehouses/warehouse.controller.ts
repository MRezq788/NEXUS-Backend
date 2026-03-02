import { Request, Response } from 'express';
import * as service from './warehouse.service';
import { success, error } from '../../core/utils/response';

export const getWarehouse = async (req: Request, res: Response) => {
  try {
    const limitParam = req.query.limit;
    const startAfterParam = req.query.startAfter;
    const searchParam = req.query.search;
    const categoryParam = req.query.category;

    let limit: number | undefined;
    let startAfter: string | undefined;
    let search: string | undefined;
    let category: string | undefined;

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

    if (categoryParam !== undefined) {
      category = String(categoryParam);
    }
    
    const result = await service.fetchWarehouse({
      limit,
      startAfter,
      search,
      category,
    });    

    return success(res, result);

  } catch (err) {
    console.error(err);
    return error(res, (err as Error).message || 'Failed to fetch inventory', 500);
  }
};