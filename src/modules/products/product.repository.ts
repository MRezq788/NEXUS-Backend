export {};
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

const getProductDetails = async (productId: String) => {
  const productRef = db.collection("products").doc(productId);
  const snapshot = await productRef.get();
  return snapshot.data() || {};
};

module.exports = {
  getProductDetails,
};
