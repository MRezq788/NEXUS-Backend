import { createProductRepo, getProductsRepo, CreateProductInput, ProductWithVariants } from './product.repository';
import { getPaginationParams, createPaginatedResult, PaginatedResult } from '../../core/utils/pagination';
import { getInventoryStatsRepo, InventoryStats } from './product.repository';


export const createProductService = async (
  userId: string,
  input: CreateProductInput
): Promise<string> => {
  const { name, basePrice, variants } = input;

  if (!name || typeof basePrice !== 'number') {
    throw new Error('name and basePrice are required');
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('At least one variant is required');
  }

  return await createProductRepo(userId, input);
};

export const getProductsService = async (
  userId: string,
  query: any
): Promise<PaginatedResult<ProductWithVariants>> => {
  if (!userId) throw new Error('userId is required');

  const { page, limit } = getPaginationParams(query);

  // Extract search/filter/sort params from query
  const sortOrder =
    query.sortOrder === 'asc' || query.sortOrder === 'desc'
      ? query.sortOrder
      : 'desc';

  const filters = {
    search: query.search as string | undefined,
    inStock: query.inStock as string | undefined, // "true" | "false" | undefined
    sortBy: (query.sortBy as string) || 'createdAt',
    sortOrder,
  };

  const { products, total } = await getProductsRepo(userId, page, limit, filters);
  return createPaginatedResult(products, total, page, limit);
};

export const getInventoryStatsService = async (
  userId: string
): Promise<InventoryStats> => {
  if (!userId) throw new Error('userId is required');
  return await getInventoryStatsRepo(userId);
};


