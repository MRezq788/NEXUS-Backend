import { admin } from '../../core/config/firebase';

const db = admin.firestore();

export const getProductDetails = async (productId: string, userId: string) => {
  const productRef = db
    .collection("users")
    .doc(userId)
    .collection("products")
    .doc(productId);
    
  const snapshot = await productRef.get();
  return snapshot.data() || {};
};