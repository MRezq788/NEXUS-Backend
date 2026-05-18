import * as admin from "firebase-admin";
import { adminDb } from "../../core/config/adminFirebase";
import { Order, OrderStatus, formatDate } from "./warehouse.order.model";

// Get user's orders subcollection reference
function getUserOrdersCollection(userEmail: string) {
  return adminDb.collection("users").doc(userEmail).collection("orders");
}

export class OrderRepository {
  // Verify user exists
  async verifyUser(userEmail: string): Promise<boolean> {
    const userDoc = await adminDb.collection("users").doc(userEmail).get();
    return userDoc.exists;
  }

  // Get all orders with optional status filter
  async findAll(userEmail: string, status?: OrderStatus): Promise<Order[]> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) {
      throw new Error("User not found");
    }

    const ordersRef = getUserOrdersCollection(userEmail);

    let q: admin.firestore.Query = ordersRef.orderBy("createdAt", "desc");

    // Add status filter if specified
    if (status) {
      q = q.where("status", "==", status);
    }

    const snapshot = await q.get();

    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      orders.push(this.formatOrder(doc));
    });

    return orders;
  }

  // Get single order by ID
  async findById(userEmail: string, id: string): Promise<Order | null> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error("User not found");

    const orderDoc = getUserOrdersCollection(userEmail).doc(id);
    const snapshot = await orderDoc.get();

    if (!snapshot.exists) return null;

    return this.formatOrder(snapshot);
  }

  // Create new order
  async create(userEmail: string, orderData: Partial<Order>): Promise<Order> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error("User not found");

    const now = new Date();

    const data = {
      buyer: orderData.buyer || "",
      total: orderData.total || 0,
      status: orderData.status || "pending",
      products: orderData.products || [],
      ownerProductAccess: orderData.ownerProductAccess ?? false,
      ownerProductAccessAt: orderData.ownerProductAccessAt ?? null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const ordersRef = getUserOrdersCollection(userEmail);
    const docRef = await ordersRef.add(data);

    return {
      id: docRef.id,
      ...data,
      createdAt: formatDate(now),
      updatedAt: formatDate(now),
    } as Order;
  }

  // Update order
  async update(
    userEmail: string,
    id: string,
    orderData: Partial<Order>,
  ): Promise<Order | null> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error("User not found");

    const orderDoc = getUserOrdersCollection(userEmail).doc(id);
    const existing = await orderDoc.get();

    if (!existing.exists) return null;

    const now = new Date();
    const updates: any = {
      updatedAt: now.toISOString(),
    };

    if (orderData.buyer !== undefined) updates.buyer = orderData.buyer;
    if (orderData.total !== undefined) updates.total = orderData.total;
    if (orderData.status !== undefined) updates.status = orderData.status;
    if (orderData.products !== undefined) updates.products = orderData.products;
    if (orderData.ownerProductAccess !== undefined) {
      updates.ownerProductAccess = orderData.ownerProductAccess;
    }
    if (orderData.ownerProductAccessAt !== undefined) {
      updates.ownerProductAccessAt = orderData.ownerProductAccessAt;
    }

    await orderDoc.update(updates);

    const updated = await orderDoc.get();
    return this.formatOrder(updated);
  }

  // Update order status only
  async updateStatus(
    userEmail: string,
    id: string,
    status: OrderStatus,
  ): Promise<Order | null> {
    return this.update(userEmail, id, { status });
  }

  // Delete single order
  async delete(userEmail: string, id: string): Promise<boolean> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error("User not found");

    try {
      const orderDoc = getUserOrdersCollection(userEmail).doc(id);
      await orderDoc.delete();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Delete multiple orders using batch
  async deleteBatch(userEmail: string, ids: string[]): Promise<number> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error("User not found");

    const batch = adminDb.batch();
    let count = 0;

    for (const id of ids) {
      const orderDoc = getUserOrdersCollection(userEmail).doc(id);
      batch.delete(orderDoc);
      count++;
    }

    await batch.commit();
    return count;
  }

  // Get order statistics
  async getStats(userEmail: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
    totalRevenue: number;
  }> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error("User not found");

    const ordersRef = getUserOrdersCollection(userEmail);
    const snapshot = await ordersRef.get();

    let total = 0;
    let pending = 0;
    let processing = 0;
    let completed = 0;
    let cancelled = 0;
    let totalRevenue = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      total++;

      switch (data.status) {
        case "pending":
          pending++;
          break;
        case "processing":
          processing++;
          break;
        case "completed":
          completed++;
          totalRevenue += data.total || 0;
          break;
        case "cancelled":
          cancelled++;
          break;
      }
    });

    return { total, pending, processing, completed, cancelled, totalRevenue };
  }

  // Format Firestore document to Order
  private formatOrder(doc: admin.firestore.DocumentSnapshot): Order {
    const data = doc.data()!;

    // Handle Firestore Timestamp or string
    const createdAt = this.convertToDate(data.createdAt);
    const updatedAt = this.convertToDate(data.updatedAt);

    return {
      id: doc.id,
      buyer: data.buyer,
      total: data.total,
      status: data.status,
      products: data.products || [],
      ownerProductAccess:
        data.ownerProductAccess ?? data.status === "completed",
      ownerProductAccessAt: data.ownerProductAccessAt ?? null,
      createdAt: formatDate(createdAt),
      updatedAt: formatDate(updatedAt),
    };
  }

  // Helper to convert Firestore Timestamp or any date format to Date
  private convertToDate(timestamp: any): Date {
    if (!timestamp) return new Date();

    // Admin SDK Timestamp has toDate() method
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      return timestamp.toDate();
    }

    // Already a Date
    if (timestamp instanceof Date) {
      return timestamp;
    }

    // ISO string or number
    return new Date(timestamp);
  }
}

export const orderRepository = new OrderRepository();