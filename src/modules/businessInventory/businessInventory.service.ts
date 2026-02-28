import * as repository from './businessInventory.repository';

interface FetchParams {
  email: string,
  limit?: number;
  startAfter?: string;
  search?: string;
  inStock?: boolean;
}

interface CountParams {
  email: string,
  inStock?: boolean;
}

export const fetchBusinessInventory = async (params: FetchParams) => {
  const {
    email,
    limit = 10,
    startAfter,
    search,
    inStock,
  } = params;

  if (limit <= 0) {
    throw new Error('limit must be greater than 0');
  }

  // limit + 1 elements are requested to check for remaining pages
  const repoLimit = limit + 1;

  const objects = await repository.getInventory({
    email,
    limit: repoLimit,
    startAfter,
    search,
    inStock,
  });

  let hasMore = false;
  let nextPageCursor: string | null = null;

  if (objects.length === repoLimit) {
    hasMore = true;

    const limitthObject = objects[limit - 1];
    nextPageCursor = limitthObject.createdAt;
  }

  const data = objects.slice(0, limit);

  return {
    data,
    nextPageCursor,
    hasMore,
  };
};

export const fetchProductsCount = async (params: CountParams) => {
  const { email, inStock } = params;

  const count = await repository.getProductsCount({ email, inStock });

  return count;
};