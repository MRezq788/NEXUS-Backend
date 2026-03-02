import * as repository from './warehouse.repository';

interface FetchParams {
  limit?: number;
  startAfter?: string;
  search?: string;
  category?: string;
}

export const fetchWarehouse = async (params: FetchParams) => {
  const {
    limit = 10,
    startAfter,
    search,
    category,
  } = params;

  if (limit <= 0) {
    throw new Error('limit must be greater than 0');
  }

  // limit + 1 elements are requested to check for remaining pages
  const repoLimit = limit + 1;

  const objects = await repository.getWarehouse({
    limit: repoLimit,
    startAfter,
    search,
    category,
  });  

  let hasMore = false;
  let nextPageCursor: string | null = null;

  if (objects.length === repoLimit) {
    hasMore = true;

    const limitthObject = objects[limit - 1];
    nextPageCursor = limitthObject.email;
  }

  const data = objects.slice(0, limit);

  return {
    data,
    nextPageCursor,
    hasMore,
  };
};