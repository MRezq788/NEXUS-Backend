import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  DocumentSnapshot,
  DocumentData,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../core/config/firebase';
import { Order, OrderStatus, formatDate } from './warehouse.order.model';

// Get user's orders subcollection reference
function getUserOrdersCollection(userEmail: string) {
  const userDoc = doc(db, 'users', userEmail);
  return collection(userDoc, 'orders');
}

export class OrderRepository {
  // Verify user exists
  async verifyUser(userEmail: string): Promise<boolean> {
    const userDoc = doc(db, 'users', userEmail);
    const snapshot = await getDoc(userDoc);
    return snapshot.exists();
  }

  // Get all orders with optional status filter
  async findAll(
    userEmail: string,
    status?: OrderStatus
  ): Promise<Order[]> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) {
      throw new Error('User not found');
    }

    const ordersRef = getUserOrdersCollection(userEmail);
    
    let constraints: any[] = [orderBy('createdAt', 'desc')];
    
    // Add status filter if specified
    if (status) {
      constraints.push(where('status', '==', status));
    }

    const q = query(ordersRef, ...constraints);
    const snapshot = await getDocs(q);
    
    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      orders.push(this.formatOrder(doc));
    });

    return orders;
  }

  // Get single order by ID
  async findById(userEmail: string, id: string): Promise<Order | null> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const orderDoc = doc(getUserOrdersCollection(userEmail), id);
    const snapshot = await getDoc(orderDoc);
    
    if (!snapshot.exists()) return null;
    
    return this.formatOrder(snapshot);
  }

  // Create new order
  async create(userEmail: string, orderData: Partial<Order>): Promise<Order> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const now = new Date();

    const data = {
      buyer: orderData.buyer || '',
      total: orderData.total || 0,
      status: orderData.status || 'pending',
      products: orderData.products || [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const ordersRef = getUserOrdersCollection(userEmail);
    const docRef = await addDoc(ordersRef, data);
    
    return {
      id: docRef.id,
      ...data,
      createdAt: formatDate(now),
      updatedAt: formatDate(now),
    } as Order;
  }

  // Update order
  async update(userEmail: string, id: string, orderData: Partial<Order>): Promise<Order | null> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const orderDoc = doc(getUserOrdersCollection(userEmail), id);
    const existing = await getDoc(orderDoc);
    
    if (!existing.exists()) return null;

    const now = new Date();
    const updates: any = {
      updatedAt: now.toISOString(),
    };

    if (orderData.buyer !== undefined) updates.buyer = orderData.buyer;
    if (orderData.total !== undefined) updates.total = orderData.total;
    if (orderData.status !== undefined) updates.status = orderData.status;
    if (orderData.products !== undefined) updates.products = orderData.products;

    await updateDoc(orderDoc, updates);

    const updated = await getDoc(orderDoc);
    return this.formatOrder(updated);
  }

  // Update order status only
  async updateStatus(userEmail: string, id: string, status: OrderStatus): Promise<Order | null> {
    return this.update(userEmail, id, { status });
  }

  // Delete single order
  async delete(userEmail: string, id: string): Promise<boolean> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    try {
      const orderDoc = doc(getUserOrdersCollection(userEmail), id);
      await deleteDoc(orderDoc);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Delete multiple orders using batch
  async deleteBatch(userEmail: string, ids: string[]): Promise<number> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const batch = writeBatch(db);
    let count = 0;

    for (const id of ids) {
      const orderDoc = doc(getUserOrdersCollection(userEmail), id);
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
    if (!userExists) throw new Error('User not found');

    const ordersRef = getUserOrdersCollection(userEmail);
    const snapshot = await getDocs(ordersRef);
    
    let total = 0;
    let pending = 0;
    let processing = 0;
    let completed = 0;
    let cancelled = 0;
    let totalRevenue = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      total++;
      
      switch (data.status) {
        case 'pending':
          pending++;
          break;
        case 'processing':
          processing++;
          break;
        case 'completed':
          completed++;
          totalRevenue += data.total || 0;
          break;
        case 'cancelled':
          cancelled++;
          break;
      }
    });

    return { total, pending, processing, completed, cancelled, totalRevenue };
  }

// Format Firestore document to Order
private formatOrder(doc: DocumentSnapshot<DocumentData>): Order {
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
    createdAt: formatDate(createdAt),
    updatedAt: formatDate(updatedAt),
  };
}

// Helper to convert Firestore Timestamp or any date format to Date
private convertToDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  
  // Firestore Timestamp has toDate() method
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
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