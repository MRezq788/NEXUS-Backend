import * as repository from './warehouseProduct.repository';

interface FetchParams {
  email: string,
  limit?: number;
  startAfter?: string;
  search?: string;
}

export const fetchProduct = async (params: FetchParams) => {
  const {
    email,
    limit = 10,
    startAfter,
    search,
  } = params;

  if (limit <= 0) {
    throw new Error('limit must be greater than 0');
  }

  // limit + 1 elements are requested to check for remaining pages
  const repoLimit = limit + 1;

  const objects = await repository.getProduct({
    email,
    limit: repoLimit,
    startAfter,
    search,
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