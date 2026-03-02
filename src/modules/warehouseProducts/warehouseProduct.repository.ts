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
}


export const getProduct = async ({
  email,
  limit,
  startAfter,
  search,
}: RepoParams) => {
  try {
    const constraints: QueryConstraint[] = [];

    constraints.push(where('status', "==", "In Stock"));

    if (search) {
      const end = search + '\uf8ff';
      constraints.push(where('name', '>=', search));
      constraints.push(where('name', '<=', end));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    if (startAfter) {
      constraints.push(startAfterFn(startAfter));
    }
    
    constraints.push(limitFn(limit));

    const q = query(collection(db, COLLECTION_NAME, email, SUBCOLLECTION_NAME), ...constraints);

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