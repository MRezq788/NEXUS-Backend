import {
  createProductRepo,
  getProductsRepo,
  getProductWithVariants,
  updateProductRepo,
  CreateProductInput,
  UpdateProductInput,
  ProductWithVariants,
} from './product.repository';
import { getPaginationParams, createPaginatedResult, PaginatedResult } from '../../core/utils/pagination';
import { getInventoryStatsRepo, InventoryStats } from './product.repository';
import { getAllWarehouseProductsRepo, WarehouseProduct } from './product.repository';
import { getRecommendationsRepo, RecommendedProduct } from './product.recommendation';


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

export const getProductService = async (
  userId: string,
  productId: string,
) => {
  if (!userId) throw new Error('userId is required');
  if (!productId) throw new Error('productId is required');
  return await getProductWithVariants(userId, productId);
};

export const updateProductService = async (
  userId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<{ variantIdMapping: Record<string, string> }> => {
  if (!userId) throw new Error('userId is required');
  if (!productId) throw new Error('productId is required');

  const { name, basePrice, variants } = input;

  if (!name || typeof basePrice !== 'number') {
    throw new Error('name and basePrice are required');
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('At least one variant is required');
  }

  return await updateProductRepo(userId, productId, input);
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

export const getRecommendationsService = async (
  userId: string,
  topK?: number
): Promise<RecommendedProduct[]> => {
  return await getRecommendationsRepo(userId, topK);
};

