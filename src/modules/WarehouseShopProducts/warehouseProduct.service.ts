import * as repository from './warehouseProduct.repository';

interface FetchParams {
  email: string,
  limit?: number;
  page?: number;
  startAfter?: string;
  search?: string;
}

export const fetchProduct = async (params: FetchParams) => {
  const {
    email,
    limit = 10,
    page = 1,
    startAfter,
    search,
  } = params;

  if (limit <= 0) {
    throw new Error('limit must be greater than 0');
  }

  if (page <= 0) {
    throw new Error('page must be greater than 0');
  }

  // limit + 1 elements are requested to check for remaining pages
  const repoLimit = limit + 1;
  const offset = startAfter ? undefined : (page - 1) * limit;

  const objects = await repository.getProduct({
    email,
    limit: repoLimit,
    offset,
    startAfter,
    search,
  });

  let hasMore = false;
  let nextPageCursor: string | null = null;

  if (objects.length === repoLimit) {
    hasMore = true;

    const limitthObject = objects[limit - 1];
    nextPageCursor = limitthObject.id;
  }

  const data = objects.slice(0, limit);

  return {
    data,
    nextPageCursor,
    hasMore,
  };
};
