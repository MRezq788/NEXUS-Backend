import { admin } from "../../core/config/firebase";
import { AggregateField } from "firebase-admin/firestore";
import { formatVariantAttributesSummary } from "../../core/utils/variantAttributes";
const db = admin.firestore();
const usersCollection = db.collection("users");

export interface CreateUserData {
  name: string;
  email: string;
  role: string;
}

export interface UserProfileData {
  name?: string;
  email: string;
  role?: string;
  profileImageUrl?: string;
}
export interface CreateCashierData {
  name: string;
  email: string;
  password: string;
  businessOwnerId: string;
}

export interface AllocationInventoryInput {
  cashierId: string;
  productId: string;
  variantId: string;
  quantity: number;
}

export interface ReturnInventoryInput {
  cashierId: string;
  productId: string;
  variantId: string;
  quantity: number;
}

export interface ReturnInventoryResult {
  cashierId: string;
  productId: string;
  variantId: string;
  returnedQuantity: number;
  ownerVariantQuantity: number;
  ownerProductQuantity: number;
  cashierVariantQuantity: number;
  cashierProductQuantity: number;
  historyEntry: AllocationHistoryEntryResolved;
}

export interface CashierPosSaleItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CashierPosSaleOrderInput {
  total: number;
}

export interface AllocationHistoryEntry {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  ownerId: string;
  cashierId: string;
  createdAt: string;
  movementType?: "allocate" | "return";
}

// Resolved shape returned to the frontend — built on read, not stored
export interface AllocationHistoryEntryResolved {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  variantAttributes: string;
  quantity: number;
  ownerId: string;
  ownerName: string;
  cashierId: string;
  cashierName: string;
  createdAt: string;
  movementType?: "allocate" | "return";
}

export const createUserDocument = async (userData: CreateUserData) => {
  // RULE: Force the Document ID to be the user's email
  const docRef = usersCollection.doc(userData.email);

  const newUser = {
    name: userData.name,
    email: userData.email,
    role: userData.role,
    // RULE: Strict data initialization
    profileImageUrl: "",
    preferences: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLogin: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Using .set() creates the document or overwrites it.
  await docRef.set(newUser);

  return { id: userData.email, ...newUser };
};

export const createCashierAccount = async (cashierData: CreateCashierData) => {
  // 1. Create user in Firebase Auth
  const userRecord = await admin.auth().createUser({
    email: cashierData.email,
    password: cashierData.password,
    displayName: cashierData.name,
  });

  // 2. Create user document in Firestore
  const docRef = usersCollection.doc(cashierData.email);
  const newCashier = {
    name: cashierData.name,
    email: cashierData.email,
    role: "cashier",
    businessOwnerId: cashierData.businessOwnerId,
    profileImageUrl: "",
    preferences: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLogin: null,
  };

  await docRef.set(newCashier);

  return {
    uid: userRecord.uid,
    email: cashierData.email,
    name: cashierData.name,
  };
};

export const getUserData = async (userId: string) => {
  const userRef = db.collection("users").doc(userId);
  const snapshot = await userRef.get();
  return snapshot.data() || {};
};

export const getUserProfileByEmail = async (
  email: string,
): Promise<UserProfileData | null> => {
  const userRef = db.collection("users").doc(email);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() || {};
  return {
    email,
    name: data.name,
    role: data.role,
    profileImageUrl: data.profileImageUrl,
  };
};
export const getCashiersByBusinessOwner = async (businessOwnerId: string) => {
  try {
    const usersRef = db.collection("users");
    const snapshot = await usersRef
      .where("businessOwnerId", "==", businessOwnerId)
      .where("role", "==", "cashier")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      email: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching cashiers:", error);
    return [];
  }
};

export const getUserSoldAmount = async (userId: string) => {
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

export const getUserBoughtAmount = async (userId: string) => {
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

export const getOwnerSites = async (userId: string) => {
  const sitesRef = db.collection("users").doc(userId);
  const snapshot = await sitesRef.get();
  return snapshot.data()?.siteIds || [];
};

export const userRole = async (userId: string) => {
  const userRef = db.collection("users").doc(userId);
  const snapshot = await userRef.get();
  return snapshot.data()?.role || "user";
};

export const getUserSoldTotalForSpecificDay = async (
  userId: string,
  date: Date,
) => {
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

  const snapshot = await ordersRef
    .aggregate({
      totalAmount: AggregateField.sum("total"),
    })
    .get();

  return snapshot.data().totalAmount;
};

export const getMostSoldItems = async (userId: string, range: number) => {
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
  return Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, range)
    .map(([productId]) => productId);
};

export const getTopCashiersSelling = async (userId: string, range: number) => {
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
  return Object.entries(cashierTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, range)
    .map(([cashierId, totalSold]) => ({ cashierId, totalSold }));
};

export const getUserRevenue = async (userId: string, period: string) => {
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

  return labels.map((label) => ({
    label,
    value: revenueData[label] || 0,
  }));
};

export const getTotalOrders = async (userId: string) => {
  const ordersRef = db
    .collection("users")
    .doc(userId)
    .collection("orders")
    .where("type", "==", "sold");
  const snapshot = await ordersRef.get();
  return snapshot.size;
};

export const getRecentOrders = async (userId: string, limit: number) => {
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

export const getRevenueGrowth = async (userId: string, period: string) => {
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

export const getTotalOrdersForPeriod = async (
  userId: string,
  period: string,
) => {
  const ordersRef = db.collection("users").doc(userId).collection("orders");
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

export const getTotalRevenueForPeriod = async (
  userId: string,
  period: string,
) => {
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

export const allocateInventoryToCashierRepo = async (
  ownerEmail: string,
  payload: AllocationInventoryInput,
) => {
  const { cashierId, productId, variantId, quantity } = payload;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const createdAt = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const ownerRef = usersCollection.doc(ownerEmail);
    const cashierRef = usersCollection.doc(cashierId);
    const ownerProductRef = ownerRef.collection("products").doc(productId);
    const ownerVariantRef = ownerProductRef.collection("variants").doc(variantId);
    const cashierProductRef = cashierRef.collection("products").doc(productId);
    const cashierVariantRef = cashierProductRef.collection("variants").doc(variantId);
    const ownerHistoryRef = ownerRef.collection("allocationHistory").doc();
    const cashierHistoryRef = cashierRef.collection("allocationHistory").doc(ownerHistoryRef.id);

    const [ownerSnap, cashierSnap, ownerProductSnap, ownerVariantSnap, cashierProductSnap, cashierVariantSnap, ownerVariantsSnap, cashierVariantsSnap] = await Promise.all([
      transaction.get(ownerRef),
      transaction.get(cashierRef),
      transaction.get(ownerProductRef),
      transaction.get(ownerVariantRef),
      transaction.get(cashierProductRef),
      transaction.get(cashierVariantRef),
      transaction.get(ownerProductRef.collection("variants")),
      transaction.get(cashierProductRef.collection("variants")),
    ]);

    if (!ownerSnap.exists) {
      throw new Error("Business Logic Error: Business owner not found.");
    }

    if (!cashierSnap.exists) {
      throw new Error("Business Logic Error: Cashier not found.");
    }

    const ownerData = ownerSnap.data() || {};
    const cashierData = cashierSnap.data() || {};
    if (cashierData.role !== "cashier") {
      throw new Error("Business Logic Error: Selected user is not a cashier.");
    }

    if (cashierData.businessOwnerId !== ownerEmail) {
      throw new Error("Business Logic Error: You can only allocate inventory to your own cashiers.");
    }

    if (!ownerProductSnap.exists) {
      throw new Error("Business Logic Error: Product not found in business owner inventory.");
    }

    if (!ownerVariantSnap.exists) {
      throw new Error("Business Logic Error: Variant not found in business owner inventory.");
    }

    const ownerProductData = ownerProductSnap.data() || {};
    const ownerVariantData = ownerVariantSnap.data() || {};
    const ownerVariantQty = Number(ownerVariantData.quantity) || 0;

    if (ownerVariantQty < quantity) {
      throw new Error("Business Logic Error: Allocated quantity exceeds available online quantity.");
    }

    const nextOwnerVariantQty = ownerVariantQty - quantity;
    const ownerRemainingProductQuantity = ownerVariantsSnap.docs.reduce((sum, doc) => {
      const docQty = Number(doc.data().quantity) || 0;
      return sum + (doc.id === variantId ? nextOwnerVariantQty : docQty);
    }, 0);

    const cashierExistingVariantQty = cashierVariantSnap.exists
      ? Number(cashierVariantSnap.data()?.quantity) || 0
      : 0;
    const nextCashierVariantQty = cashierExistingVariantQty + quantity;
    const cashierProductQuantity = cashierVariantsSnap.docs.reduce((sum, doc) => {
      const docQty = Number(doc.data().quantity) || 0;
      return sum + (doc.id === variantId ? nextCashierVariantQty : docQty);
    }, cashierVariantSnap.exists ? 0 : quantity);

    transaction.set(
      cashierProductRef,
      {
        sourceOwnerId: ownerEmail,
        sourceProductId: productId,
        sourceProductRef: ownerProductRef,
        allocatedBy: ownerEmail,
        updatedAt: now,
        ...(cashierProductSnap.exists ? {} : { createdAt: now }),
      },
      { merge: true },
    );

    transaction.set(
      cashierVariantRef,
      {
        sourceOwnerId: ownerEmail,
        sourceProductId: productId,
        sourceVariantId: variantId,
        sourceVariantRef: ownerVariantRef,
        quantity: nextCashierVariantQty,
        updatedAt: now,
        ...(cashierVariantSnap.exists ? {} : { createdAt: now }),
      },
      { merge: true },
    );

    transaction.update(ownerVariantRef, {
      quantity: nextOwnerVariantQty,
    });

    transaction.set(
      ownerProductRef,
      {
        updatedAt: now,
      },
      { merge: true },
    );
    const variantAttributes = formatVariantAttributesSummary(
      ownerVariantData as Record<string, unknown>,
    );
    const allocationHistoryEntry: AllocationHistoryEntry = {
      id: ownerHistoryRef.id,
      productId,
      variantId,
      quantity,
      ownerId: ownerEmail,
      cashierId,
      createdAt,
    };

    // Resolved shape returned immediately to the frontend (not stored)
    const allocationHistoryEntryResolved: AllocationHistoryEntryResolved = {
      ...allocationHistoryEntry,
      productName: ownerProductData.name ?? "Unnamed Product",
      variantLabel: variantAttributes || variantId,
      variantAttributes: variantAttributes || "Default variant",
      ownerName: ownerData.name ?? ownerEmail,
      cashierName: cashierData.name ?? cashierId,
    };

    transaction.set(ownerHistoryRef, allocationHistoryEntry);
    transaction.set(cashierHistoryRef, allocationHistoryEntry);

    return {
      cashierId,
      productId,
      variantId,
      allocatedQuantity: quantity,
      ownerRemainingVariantQuantity: nextOwnerVariantQty,
      ownerRemainingProductQuantity,
      cashierVariantQuantity: nextCashierVariantQty,
      cashierProductQuantity,
      historyEntry: allocationHistoryEntryResolved,
    };
  });
};

export const createCashierPosSaleRepo = async (
  cashierEmail: string,
  items: CashierPosSaleItemInput[],
  order: CashierPosSaleOrderInput,
) => {
  const now = admin.firestore.FieldValue.serverTimestamp();

  return db.runTransaction(async (transaction) => {
    const cashierRef = usersCollection.doc(cashierEmail);
    const cashierSnap = await transaction.get(cashierRef);

    if (!cashierSnap.exists) {
      throw new Error("Business Logic Error: Cashier not found.");
    }

    const cashierData = cashierSnap.data() || {};
    if (cashierData.role !== "cashier") {
      throw new Error("Business Logic Error: Only cashiers can place POS sales.");
    }

    const ownerEmail =
      typeof cashierData.businessOwnerId === "string"
        ? cashierData.businessOwnerId.trim()
        : "";

    if (!ownerEmail) {
      throw new Error("Business Logic Error: Cashier is not linked to a business owner.");
    }

    const ownerRef = usersCollection.doc(ownerEmail);
    const ownerSnap = await transaction.get(ownerRef);

    if (!ownerSnap.exists) {
      throw new Error("Business Logic Error: Business owner not found.");
    }

    const updates: Array<{
      productRef: FirebaseFirestore.DocumentReference;
      variantRef: FirebaseFirestore.DocumentReference;
      variantId: string;
      productId: string;
      nextQuantity: number;
    }> = [];

    for (const item of items) {
      const productRef = cashierRef.collection("products").doc(item.productId);
      const variantRef = productRef.collection("variants").doc(item.variantId);
      const variantSnap = await transaction.get(variantRef);

      if (!variantSnap.exists) {
        throw new Error(`Business Logic Error: Variant ${item.variantId} not found.`);
      }

      const variantData = variantSnap.data() || {};
      const currentQty = Number(variantData.quantity) || 0;

      if (currentQty < item.quantity) {
        throw new Error(
          `Business Logic Error: Insufficient stock for variant ${item.variantId}.`,
        );
      }

      updates.push({
        productRef,
        variantRef,
        variantId: item.variantId,
        productId: item.productId,
        nextQuantity: currentQty - item.quantity,
      });
    }

    updates.forEach((update) => {
      transaction.update(update.variantRef, {
        quantity: update.nextQuantity,
        updatedAt: now,
      });

      transaction.set(
        update.productRef,
        {
          updatedAt: now,
        },
        { merge: true },
      );
    });

    const orderRef = cashierRef.collection("orders").doc();
    transaction.set(orderRef, {
      total: order.total,
      executorType: "cashier",
      executorId: cashierEmail,
      products: items,
      createdAt: now,
      updatedAt: now,
    });

    const ownerOrderRef = ownerRef.collection("orders").doc(orderRef.id);
    transaction.set(ownerOrderRef, {
      status: "complete",
      ownerProductAccess: true,
      ownerProductAccessAt: null,
      createdAt: now,
      updatedAt: now,
      executorType: "cashier",
      executorId: cashierEmail,
      type: "sold",
      products: items,
      total: order.total,
    });

    return {
      orderId: orderRef.id,
      items: updates.map((update) => ({
        productId: update.productId,
        variantId: update.variantId,
        remainingQuantity: update.nextQuantity,
      })),
    };
  });
};

export const returnInventoryFromCashierRepo = async (
  ownerEmail: string,
  payload: ReturnInventoryInput,
): Promise<ReturnInventoryResult> => {
  const { cashierId, productId, variantId, quantity } = payload;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const createdAt = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const ownerRef = usersCollection.doc(ownerEmail);
    const cashierRef = usersCollection.doc(cashierId);
    const ownerProductRef = ownerRef.collection("products").doc(productId);
    const ownerVariantRef = ownerProductRef.collection("variants").doc(variantId);
    const cashierProductRef = cashierRef.collection("products").doc(productId);
    const cashierVariantRef = cashierProductRef.collection("variants").doc(variantId);
    const ownerHistoryRef = ownerRef.collection("allocationHistory").doc();
    const cashierHistoryRef = cashierRef.collection("allocationHistory").doc(ownerHistoryRef.id);

    const [
      ownerSnap,
      cashierSnap,
      ownerProductSnap,
      ownerVariantSnap,
      cashierProductSnap,
      cashierVariantSnap,
      ownerVariantsSnap,
      cashierVariantsSnap,
    ] = await Promise.all([
      transaction.get(ownerRef),
      transaction.get(cashierRef),
      transaction.get(ownerProductRef),
      transaction.get(ownerVariantRef),
      transaction.get(cashierProductRef),
      transaction.get(cashierVariantRef),
      transaction.get(ownerProductRef.collection("variants")),
      transaction.get(cashierProductRef.collection("variants")),
    ]);

    if (!ownerSnap.exists) {
      throw new Error("Business Logic Error: Business owner not found.");
    }

    if (!cashierSnap.exists) {
      throw new Error("Business Logic Error: Cashier not found.");
    }

    const ownerData = ownerSnap.data() || {};
    const cashierData = cashierSnap.data() || {};

    if (cashierData.role !== "cashier") {
      throw new Error("Business Logic Error: Selected user is not a cashier.");
    }

    if (cashierData.businessOwnerId !== ownerEmail) {
      throw new Error("Business Logic Error: You can only edit inventory for your own cashiers.");
    }

    if (!cashierProductSnap.exists || !cashierVariantSnap.exists) {
      throw new Error("Business Logic Error: Variant not found in cashier inventory.");
    }

    if (!ownerProductSnap.exists || !ownerVariantSnap.exists) {
      throw new Error("Business Logic Error: Variant not found in owner inventory.");
    }

    const cashierVariantData = cashierVariantSnap.data() || {};
    const ownerVariantData = ownerVariantSnap.data() || {};
    const ownerProductData = ownerProductSnap.data() || {};

    const cashierVariantQty = Number(cashierVariantData.quantity) || 0;
    if (cashierVariantQty < quantity) {
      throw new Error("Business Logic Error: Returned quantity exceeds cashier available quantity.");
    }

    const ownerVariantQty = Number(ownerVariantData.quantity) || 0;
    const nextCashierVariantQty = cashierVariantQty - quantity;
    const nextOwnerVariantQty = ownerVariantQty + quantity;

    const cashierProductQuantity = cashierVariantsSnap.docs.reduce((sum, doc) => {
      const docQty = Number(doc.data().quantity) || 0;
      return sum + (doc.id === variantId ? nextCashierVariantQty : docQty);
    }, 0);

    const ownerProductQuantity = ownerVariantsSnap.docs.reduce((sum, doc) => {
      const docQty = Number(doc.data().quantity) || 0;
      return sum + (doc.id === variantId ? nextOwnerVariantQty : docQty);
    }, 0);

    transaction.update(cashierVariantRef, {
      quantity: nextCashierVariantQty,
      updatedAt: now,
    });

    transaction.update(ownerVariantRef, {
      quantity: nextOwnerVariantQty,
      updatedAt: now,
    });

    transaction.set(cashierProductRef, { updatedAt: now }, { merge: true });
    transaction.set(ownerProductRef, { updatedAt: now }, { merge: true });

    // Cashier variant only stores quantity — always read attributes from owner variant
    const variantAttributes = formatVariantAttributesSummary(
      ownerVariantData as Record<string, unknown>,
    );

    const historyEntry: AllocationHistoryEntry = {
      id: ownerHistoryRef.id,
      productId,
      variantId,
      quantity,
      ownerId: ownerEmail,
      cashierId,
      createdAt,
      movementType: "return",
    };

    const historyEntryResolved: AllocationHistoryEntryResolved = {
      ...historyEntry,
      productName: ownerProductData.name ?? "Unnamed Product",
      variantLabel: variantAttributes || variantId,
      variantAttributes: variantAttributes || "Default variant",
      ownerName: ownerData.name ?? ownerEmail,
      cashierName: cashierData.name ?? cashierId,
    };

    transaction.set(ownerHistoryRef, historyEntry);
    transaction.set(cashierHistoryRef, historyEntry);

    return {
      cashierId,
      productId,
      variantId,
      returnedQuantity: quantity,
      ownerVariantQuantity: nextOwnerVariantQty,
      ownerProductQuantity,
      cashierVariantQuantity: nextCashierVariantQty,
      cashierProductQuantity,
      historyEntry: historyEntryResolved,
    };
  });
};

export const getAllocationHistoryByUser = async (
  userId: string,
  limit: number = 20,
): Promise<AllocationHistoryEntryResolved[]> => {
  const snapshot = await usersCollection
    .doc(userId)
    .collection("allocationHistory")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const raw = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<AllocationHistoryEntry, "id">),
  }));

  // Resolve live product name, variant attributes, owner name, cashier name
  return Promise.all(
    raw.map(async (entry) => {
      try {
        const ownerRef = usersCollection.doc(entry.ownerId);
        const cashierRef = usersCollection.doc(entry.cashierId);
        const productRef = ownerRef.collection("products").doc(entry.productId);
        const variantRef = productRef.collection("variants").doc(entry.variantId);

        const [ownerSnap, cashierSnap, productSnap, variantSnap] = await Promise.all([
          ownerRef.get(),
          cashierRef.get(),
          productRef.get(),
          variantRef.get(),
        ]);

        const ownerData = ownerSnap.data() || {};
        const cashierData = cashierSnap.data() || {};
        const productData = productSnap.data() || {};
        const variantData = variantSnap.data() || {};

        const variantAttributes = formatVariantAttributesSummary(
          variantData as Record<string, unknown>,
        );

        const resolved: AllocationHistoryEntryResolved = {
          id: entry.id,
          productId: entry.productId,
          productName: productData.name ?? "Unnamed Product",
          variantId: entry.variantId,
          variantLabel: variantAttributes || entry.variantId,
          variantAttributes: variantAttributes || "Default variant",
          quantity: entry.quantity,
          ownerId: entry.ownerId,
          ownerName: ownerData.name ?? entry.ownerId,
          cashierId: entry.cashierId,
          cashierName: cashierData.name ?? entry.cashierId,
          createdAt: entry.createdAt,
          movementType: entry.movementType,
        };
        return resolved;
      } catch {
        // Fallback: return with IDs if resolution fails
        return {
          id: entry.id,
          productId: entry.productId,
          productName: "Unnamed Product",
          variantId: entry.variantId,
          variantLabel: entry.variantId,
          variantAttributes: "Default variant",
          quantity: entry.quantity,
          ownerId: entry.ownerId,
          ownerName: entry.ownerId,
          cashierId: entry.cashierId,
          cashierName: entry.cashierId,
          createdAt: entry.createdAt,
          movementType: entry.movementType,
        } satisfies AllocationHistoryEntryResolved;
      }
    }),
  );
};
