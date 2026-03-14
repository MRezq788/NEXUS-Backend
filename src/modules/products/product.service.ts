import { createProductRepo, getProductsRepo, CreateProductInput, ProductWithVariants } from './product.repository';
import { getPaginationParams, createPaginatedResult, PaginatedResult } from '../../core/utils/pagination';

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
  const { products, total } = await getProductsRepo(userId, page, limit);
  return createPaginatedResult(products, total, page, limit);
};


