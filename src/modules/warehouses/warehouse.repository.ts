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

interface RepoParams {
  limit: number;
  startAfter?: string;
  search?: string;
  category?: string;
}


export const getWarehouse = async ({
  limit,
  startAfter,
  search,
  category,
}: RepoParams) => {
  try {
    const constraints: QueryConstraint[] = [];

    constraints.push(where('role', "==", 'warehouse'));

    if (category) {
      constraints.push(where('category', "==", category));
    }

    if (search) {
      const end = search + '\uf8ff';
      constraints.push(where('name', '>=', search));
      constraints.push(where('name', '<=', end));
    }

    constraints.push(orderBy('email'));

    if (startAfter) {
      constraints.push(startAfterFn(startAfter));
    }

    constraints.push(limitFn(limit));

    const q = query(collection(db, COLLECTION_NAME), ...constraints);

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