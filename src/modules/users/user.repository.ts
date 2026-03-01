export {};
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

const getUserData = async (userId: String) => {
  const userRef = db.collection("users").doc(userId);
  const snapshot = await userRef.get();
  return snapshot.data() || {};
};

const getUserSoldAmount = async (userId: String) => {
  try {
    const ordersRef = db
      .collection("users")
      .doc(userId)
      .collection("orders")
      .where("type", "==", "sold");

    const snapshot = await ordersRef.get();
    let total = 0;
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      total += data.total || 0;
    });
    return total;
  } catch (error) {
    console.error("Error in getUserSoldAmount:", error);
    return 0;
  }
};
const getUserBoughtAmount = async (userId: String) => {
  try {
    const ordersRef = db
      .collection("users")
      .doc(userId)
      .collection("orders")
      .where("type", "==", "bought");

    const snapshot = await ordersRef.get();
    let total = 0;
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      total += data.total || 0;
    });
    return total;
  } catch (error) {
    console.error("Error in getUserBoughtAmount:", error);
    return 0;
  }
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
    const items = orderData.products || [];
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
  const cashierTotals: { [key: string]: number } = {};
  snapshot.forEach((doc: any) => {
    const orderData = doc.data();
    if (orderData.executorType === "cashier") {
      const cashierId = orderData.executorId;
      cashierTotals[cashierId] =
        (cashierTotals[cashierId] || 0) + (orderData.total || 0);
    }
  });
  const sortedCashiers = Object.entries(cashierTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, range)
    .map(([cashierId, totalSold]) => ({ cashierId, totalSold }));
  return sortedCashiers;
};

const getUserRevenue = async (userId: String, period: String) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "sold");

  const snapshot = await ordersRef.get();

  const now = new Date();
  let periodStart: Date;

  if (period === "week") {
    periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - periodStart.getDay());
    periodStart.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    periodStart = new Date(now.getFullYear(), 0, 1);
  }

  const revenueData: { [key: string]: number } = {};

  const getLabel = (date: Date): string => {
    if (period === "week") {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return days[date.getUTCDay()];
    } else if (period === "month") {
      return date.getUTCDate().toString();
    } else {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return months[date.getUTCMonth()];
    }
  };

  snapshot.forEach((doc: any) => {
    const orderData = doc.data();
    const createdAtTimestamp = orderData.createdAt;
    const createdAt = createdAtTimestamp?.toDate
      ? createdAtTimestamp.toDate()
      : new Date(createdAtTimestamp?._seconds * 1000 || 0);

    if (createdAt >= periodStart) {
      const label = getLabel(createdAt);
      revenueData[label] = (revenueData[label] || 0) + (orderData.total || 0);
    }
  });

  let labels: string[];
  if (period === "week") {
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  } else if (period === "month") {
    labels = Array.from({ length: 30 }, (_, i) => (i + 1).toString());
  } else {
    labels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
  }

  const result = labels.map((label) => ({
    label,
    value: revenueData[label] || 0,
  }));

  return result;
};

const getTotalOrders = async (userId: String) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "sold");
  const snapshot = await ordersRef.get();
  return snapshot.size;
};

const getRecentOrders = async (userId: String, limit: number) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .orderBy("createdAt", "desc")
    .limit(limit);
  const snapshot = await ordersRef.get();
  const orders: any[] = [];
  snapshot.forEach((doc: any) => {
    orders.push({
      id: doc.id,
      ...doc.data(),
    });
  });
  return orders;
};

const getRevenueGrowth = async (userId: String, period: String) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "sold");
  const snapshot = await ordersRef.get();

  const now = new Date();
  let currentPeriodStart: Date;
  let previousPeriodStart: Date;

  if (period === "week") {
    currentPeriodStart = new Date(now);
    currentPeriodStart.setDate(
      currentPeriodStart.getDate() - currentPeriodStart.getDay(),
    );
    previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
  } else if (period === "month") {
    currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  } else {
    currentPeriodStart = new Date(now.getFullYear(), 0, 1);
    previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
  }

  let currentTotal = 0;
  let previousTotal = 0;

  snapshot.forEach((doc: any) => {
    const orderData = doc.data();
    const createdAt = orderData.createdAt?.toDate
      ? orderData.createdAt.toDate()
      : new Date(orderData.createdAt);

    if (createdAt >= currentPeriodStart) {
      currentTotal += orderData.total || 0;
    } else if (
      createdAt >= previousPeriodStart &&
      createdAt < currentPeriodStart
    ) {
      previousTotal += orderData.total || 0;
    }
  });

  let growth = 0;
  if (previousTotal > 0) {
    growth = ((currentTotal - previousTotal) / previousTotal) * 100;
  } else if (currentTotal > 0) {
    growth = 100;
  }

  return {
    currentPeriodTotal: currentTotal,
    previousPeriodTotal: previousTotal,
    growth: Math.round(growth * 100) / 100,
  };
};

const getTotalOrdersForPeriod = async (userId: String, period: String) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders");
  const snapshot = await ordersRef.get();

  const now = new Date();
  let periodStart: Date;

  if (period === "week") {
    periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - periodStart.getDay());
  } else if (period === "month") {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    periodStart = new Date(now.getFullYear(), 0, 1);
  }

  let count = 0;
  snapshot.forEach((doc: any) => {
    const orderData = doc.data();
    const createdAt = orderData.createdAt?.toDate
      ? orderData.createdAt.toDate()
      : new Date(orderData.createdAt);

    if (createdAt >= periodStart) {
      count++;
    }
  });

  return count;
};

const getTotalRevenueForPeriod = async (userId: String, period: String) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "sold");
  const snapshot = await ordersRef.get();

  console.log("Total revenue - userId:", userId);
  console.log("Total revenue - period:", period);
  console.log("Total revenue - sold orders count:", snapshot.size);

  const now = new Date();
  let periodStart: Date;

  if (period === "week") {
    periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - periodStart.getDay());
  } else if (period === "month") {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    periodStart = new Date(now.getFullYear(), 0, 1);
  }

  console.log("Period start:", periodStart);

  let total = 0;
  snapshot.forEach((doc: any) => {
    const orderData = doc.data();
    const createdAtTimestamp = orderData.createdAt;
    const createdAt = createdAtTimestamp?.toDate
      ? createdAtTimestamp.toDate()
      : new Date(createdAtTimestamp?._seconds * 1000 || 0);

    console.log("Order date:", createdAt, "total:", orderData.total);

    if (createdAt >= periodStart) {
      total += orderData.total || 0;
    }
  });

  console.log("Total revenue:", total);
  return total;
};

module.exports = {
  getUserSoldAmount,
  getUserBoughtAmount,
  getOwnerSites,
  userRole,
  getUserSoldTotalForSpecificDay,
  getMostSoldItems,
  getTopCashiersSelling,
  getUserRevenue,
  getUserData,
  getTotalOrders,
  getRecentOrders,
  getRevenueGrowth,
  getTotalOrdersForPeriod,
  getTotalRevenueForPeriod,
};
