import { adminDb } from '../../core/config/adminFirebase';

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
    // Start with the base collection reference
    let q: FirebaseFirestore.Query = adminDb.collection(COLLECTION_NAME).where('role', '==', 'warehouse');

    if (category) {
      q = q.where('category', '==', category);
    }

    if (search) {
      const end = search + '\uf8ff';
      // Search logic using inequalities
      q = q.where('name', '>=', search).where('name', '<=', end);
      // CRITICAL: When using >= or <= on 'name', your first orderBy MUST be 'name'
      q = q.orderBy('name');
      q = q.orderBy('email'); // Secondary sort
    } else {
      // If not searching, just order by email
      q = q.orderBy('email');
    }

    if (startAfter) {
      q = q.startAfter(startAfter);
    }

    q = q.limit(limit);

    // Execute the query
    const snapshot = await q.get();

    // Map the results and tell TypeScript to expect an email and other dynamic fields
    const results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as { id: string; email: string; [key: string]: any }[];
    
    return results;

  } catch (err) {
    console.error('Admin SDK Firestore query failed:', err);
    throw new Error('Failed to query Firestore');
  }
};