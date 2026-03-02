import {
  collection,
  doc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../../core/config/firebase';

const USERS_COLLECTION = 'users';
const ORDERS_SUBCOLLECTION = 'orders';

interface IncomingOrder {
  buyerEmail: string;
  sellerEmail: string;
  products: {
    productId: string;
    quantity: number;
  }[];
  total: number;
}

export const createOrdersRepo = async (orders: IncomingOrder[]) => {
  const batch = writeBatch(db);

  orders.forEach((order) => {
    const { buyerEmail, sellerEmail, products, total } = order;

    // 🔹 Generate ONE shared order ID
    const buyerOrdersCollectionRef = collection(
      db,
      USERS_COLLECTION,
      buyerEmail,
      ORDERS_SUBCOLLECTION
    );

    const orderDocRef = doc(buyerOrdersCollectionRef); // auto ID
    const orderId = orderDocRef.id;

    // 🔹 References for both buyer and seller using SAME ID
    const buyerOrderRef = doc(
      db,
      USERS_COLLECTION,
      buyerEmail,
      ORDERS_SUBCOLLECTION,
      orderId
    );

    const sellerOrderRef = doc(
      db,
      USERS_COLLECTION,
      sellerEmail,
      ORDERS_SUBCOLLECTION,
      orderId
    );

    const now = Timestamp.now();

    // 🔹 Seller Order Object (Warehouse)
    const sellerOrder = {
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      total,
      buyer: buyerEmail,
      products,
      type: 'sold',
    };

    // 🔹 Buyer Order Object (Owner)
    const buyerOrder = {
      createdAt: now,
      updatedAt: now,
      executorType: 'warehouse',
      executorId: sellerEmail,
      type: 'bought',
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
  order: IncomingOrder
): Promise<string> => {

  const { buyerEmail, sellerEmail, products, total } = order;

  const batch = writeBatch(db);

  // 🔹 Generate shared order ID
  const buyerOrdersCollectionRef = collection(
    db,
    USERS_COLLECTION,
    buyerEmail,
    ORDERS_SUBCOLLECTION
  );

  const generatedDocRef = doc(buyerOrdersCollectionRef);
  const orderId = generatedDocRef.id;

  const buyerOrderRef = doc(
    db,
    USERS_COLLECTION,
    buyerEmail,
    ORDERS_SUBCOLLECTION,
    orderId
  );

  const sellerOrderRef = doc(
    db,
    USERS_COLLECTION,
    sellerEmail,
    ORDERS_SUBCOLLECTION,
    orderId
  );

  const now = Timestamp.now();

  // 🔹 Seller Order (Warehouse)
  const sellerOrder = {
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    total,
    buyer: buyerEmail,
    products,
    type: 'sold',
  };

  // 🔹 Buyer Order (Owner)
  const buyerOrder = {
    createdAt: now,
    updatedAt: now,
    executorType: 'warehouse',
    executorId: sellerEmail,
    type: 'bought',
    products,
    total,
  };

  batch.set(buyerOrderRef, buyerOrder);
  batch.set(sellerOrderRef, sellerOrder);

  await batch.commit();

  return orderId;
};