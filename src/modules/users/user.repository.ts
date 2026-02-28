export {};
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

const getUserData = async (userId: String) => {
  const userRef = db.collection("users").doc(userId);
  const snapshot = await userRef.get();
  return snapshot.data() || {};
};

const getUserSoldAmount = async (userId: String) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "sold");

  const snapshot = await ordersRef.aggregate({
    totalAmount: db.constructor.AggregateField.sum("total"),
  });

  return snapshot.data().totalAmount;
};
const getUserBoughtAmount = async (userId: String) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "bought");

  const snapshot = await ordersRef.aggregate({
    totalAmount: db.constructor.AggregateField.sum("total"),
  });

  return snapshot.data().totalAmount;
};
const getOwnerSites = async (userId: String) => {
  const sitesRef = db.collection("users").doc(userId);
  const snapshot = await sitesRef.get();
  return snapshot.data().siteIds || [];
};
const userRole = async (userId: String) => {
  const userRef = db.collection("users").doc(userId);
  const snapshot = await userRef.get();
  return snapshot.data().role || "user";
};

const getUserSoldTotalForSpecificDay = async (userId: String, date: Date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "sold")
    .where("createdAt", ">=", startOfDay)
    .where("createdAt", "<=", endOfDay);

  const snapshot = await ordersRef.aggregate({
    totalAmount: db.constructor.AggregateField.sum("total"),
  });

  return snapshot.data().totalAmount;
};

const getMostSoldItems = async (userId: String, range: number) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "sold");
  const snapshot = await ordersRef.get();
  const productCounts: { [key: string]: number } = {};
  snapshot.forEach((doc: any) => {
    const orderData = doc.data();
    const items = orderData.items || [];
    items.forEach((item: any) => {
      const productId = item.productId;
      productCounts[productId] =
        (productCounts[productId] || 0) + item.quantity;
    });
  });
  const sortedProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, range)
    .map(([productId]) => productId);
  return sortedProducts;
};
const getTopCashiersSelling = async (userId: String, range: number) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "sold");
  const snapshot = await ordersRef.get();
  const cashierCounts: { [key: string]: number } = {};
  snapshot.forEach((doc: any) => {
    const orderData = doc.data();
    if (orderData.executorType === "cashier") {
      const cashierId = orderData.executorId;
      cashierCounts[cashierId] = (cashierCounts[cashierId] || 0) + 1;
    }
  });
  const sortedCashiers = Object.entries(cashierCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, range)
    .map(([cashierId]) => cashierId);
  return sortedCashiers;
};
module.exports = {
  getUserSoldAmount,
  getUserBoughtAmount,
  getOwnerSites,
  userRole,
  getUserSoldTotalForSpecificDay,
  getMostSoldItems,
  getTopCashiersSelling,
};
