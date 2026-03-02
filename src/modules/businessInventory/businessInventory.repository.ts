import {
  collection,
  query,
  where,
  orderBy,
  limit as limitFn,
  startAfter as startAfterFn,
  getDocs,
  getCountFromServer,
  QueryConstraint,
} from 'firebase/firestore';

import { db } from '../../core/config/firebase';

const COLLECTION_NAME = 'users';
const SUBCOLLECTION_NAME = 'products';

interface RepoParams {
  email: string,
  limit: number;
  startAfter?: string;
  search?: string;
  inStock?: boolean;
}

interface RepoCountParams {
  email: string,
  inStock?: boolean;
}


export const getInventory = async ({
  email,
  limit,
  startAfter,
  search,
  inStock,
}: RepoParams) => {
  try {
    const constraints: QueryConstraint[] = [];

    // 🔹 Equality filter on status
    if (typeof inStock === 'boolean') {
      const requiredStatus = inStock ? "In Stock" : "Out of Stock";
      constraints.push(where('status', "==", requiredStatus));
    }

    // 🔹 Required ordering: first inequality field must be ordered
    constraints.push(orderBy('createdAt', 'desc'));

    // 🔹 Cursor pagination
    if (startAfter) {
      constraints.push(startAfterFn(startAfter));
    }

    // 🔹 Range filter on name (prefix search)
    if (search) {
      const end = search + '\uf8ff';
      constraints.push(where('name', '>=', search));
      constraints.push(where('name', '<=', end));
    }

    // 🔹 Limit
    constraints.push(limitFn(limit));

    const q = query(collection(db, COLLECTION_NAME, email, SUBCOLLECTION_NAME),...constraints);


    const snapshot = await getDocs(q);

    const results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    return results;

  } catch (err) {
    console.error('Firestore query failed:', err);
    throw new Error('Failed to query Firestore');
  }
};

export const getProductsCount = async ({
  email,
  inStock,
}: RepoCountParams): Promise<number> => {
  try {
    const constraints: QueryConstraint[] = [];

    if (typeof inStock === 'boolean') {
      const operator = inStock ? "!=" : "==";
      constraints.push(where('quantity', operator, 0));
    }

    const q = query(collection(db, COLLECTION_NAME, email, SUBCOLLECTION_NAME), ...constraints);

    const snapshot = await getCountFromServer(q);

    return snapshot.data().count;

  } catch (err) {
    console.error('Firestore count query failed:', err);
    throw new Error('Failed to count products');
  }
};