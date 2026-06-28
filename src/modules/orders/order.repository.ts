import * as admin from "firebase-admin";
import { adminDb } from "../../core/config/adminFirebase";

const USERS_COLLECTION = "users";
const ORDERS_SUBCOLLECTION = "orders";

interface IncomingOrder {
  buyerEmail: string;
  sellerEmail: string;
  products: {
    productId: string;
    quantity: number;
    price?: number;
    variantId?: string;
    variantAttributes?: Record<string, string>;
    productName?: string;
    productImage?: string;
    unit?: string;
    lineTotal?: number;
  }[];
  total: number;

}

export const createOrdersRepo = async (orders: IncomingOrder[]) => {
  // Use Admin SDK batc
  const batch = adminDb.batch();

  orders.forEach((order) => {
    const { buyerEmail, sellerEmail, products, total } = order;

    // 🔹 Generate ONE shared order ID
    const buyerOrdersCollectionRef = adminDb
      .collection(USERS_COLLECTION)
      .doc(buyerEmail)
      .collection(ORDERS_SUBCOLLECTION);

    const orderDocRef = buyerOrdersCollectionRef.doc(); // auto ID
    const orderId = orderDocRef.id;

    // 🔹 References for both buyer and seller using SAME ID
    const buyerOrderRef = adminDb
      .collection(USERS_COLLECTION)
      .doc(buyerEmail)
      .collection(ORDERS_SUBCOLLECTION)
      .doc(orderId);

    const sellerOrderRef = adminDb
      .collection(USERS_COLLECTION)
      .doc(sellerEmail)
      .collection(ORDERS_SUBCOLLECTION)
      .doc(orderId);

    // Use server timestamp for absolute precision
    const now = admin.firestore.FieldValue.serverTimestamp();

    // 🔹 Seller Order Object (Warehouse)
    const sellerOrder = {
      status: "pending",
      ownerProductAccess: false,
      ownerProductAccessAt: null,
      createdAt: now,
      updatedAt: now,
      total,
      buyer: buyerEmail,
      products,
      type: "sold",
    };

    // 🔹 Buyer Order Object (Owner)
    const buyerOrder = {
      status: "pending",
      ownerProductAccess: false,
      ownerProductAccessAt: null,
      createdAt: now,
      updatedAt: now,
      executorType: "warehouse",
      executorId: sellerEmail,
      type: "bought",
      products,
      total,
    };

    // 🔥 Atomic writes
    batch.set(buyerOrderRef, buyerOrder);
    batch.set(sellerOrderRef, sellerOrder);
  });

  // 🔥 All-or-nothing commit
  await batch.commit();
};

export const createSingleOrderRepo = async (
  order: IncomingOrder,
): Promise<string> => {
  const { buyerEmail, sellerEmail, products, total } = order;

  // Use Admin SDK batch
  const batch = adminDb.batch();

  // 🔹 Generate shared order ID
  const buyerOrdersCollectionRef = adminDb
    .collection(USERS_COLLECTION)
    .doc(buyerEmail)
    .collection(ORDERS_SUBCOLLECTION);

  const generatedDocRef = buyerOrdersCollectionRef.doc();
  const orderId = generatedDocRef.id;

  const buyerOrderRef = adminDb
    .collection(USERS_COLLECTION)
    .doc(buyerEmail)
    .collection(ORDERS_SUBCOLLECTION)
    .doc(orderId);

  const sellerOrderRef = adminDb
    .collection(USERS_COLLECTION)
    .doc(sellerEmail)
    .collection(ORDERS_SUBCOLLECTION)
    .doc(orderId);

  const now = admin.firestore.FieldValue.serverTimestamp();

  // 🔹 Seller Order (Warehouse)
  const sellerOrder = {
    status: "pending",
    ownerProductAccess: false,
    ownerProductAccessAt: null,
    createdAt: now,
    updatedAt: now,
    total,
    buyer: buyerEmail,
    products,
    type: "sold",
  };

  // 🔹 Buyer Order (Owner)
  const buyerOrder = {
    status: "pending",
    ownerProductAccess: false,
    ownerProductAccessAt: null,
    createdAt: now,
    updatedAt: now,
    executorType: "warehouse",
    executorId: sellerEmail,
    type: "bought",
    products,
    total,
  };

  batch.set(buyerOrderRef, buyerOrder);
  batch.set(sellerOrderRef, sellerOrder);

  await batch.commit();

  return orderId;
};