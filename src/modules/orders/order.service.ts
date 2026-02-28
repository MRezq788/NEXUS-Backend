import { orderRepository } from './order.repository';
import { productRepository } from '../products/product.repository';
import { Order, OrderStatus } from './order.model';

export class OrderService {
  async getOrders(userEmail: string, status?: OrderStatus): Promise<Order[]> {
    return orderRepository.findAll(userEmail, status);
  }

  async getOrderById(userEmail: string, id: string): Promise<Order | null> {
    return orderRepository.findById(userEmail, id);
  }

  async createOrder(userEmail: string, orderData: Partial<Order>): Promise<Order> {
    // Validate required fields
    if (!orderData.buyer) {
      throw new Error('Buyer is required');
    }
    if (!orderData.products || orderData.products.length === 0) {
      throw new Error('At least one product is required');
    }
    if (orderData.total === undefined || orderData.total < 0) {
      throw new Error('Valid total amount is required');
    }

    return orderRepository.create(userEmail, orderData);
  }

  async updateOrder(userEmail: string, id: string, orderData: Partial<Order>): Promise<Order | null> {
    return orderRepository.update(userEmail, id, orderData);
  }

  async updateOrderStatus(userEmail: string, id: string, status: OrderStatus): Promise<Order | null> {
    return orderRepository.updateStatus(userEmail, id, status);
  }

  async deleteOrder(userEmail: string, id: string): Promise<boolean> {
    return orderRepository.delete(userEmail, id);
  }

  async deleteOrdersBatch(userEmail: string, ids: string[]): Promise<number> {
    return orderRepository.deleteBatch(userEmail, ids);
  }

  async getStatistics(userEmail: string) {
    return orderRepository.getStats(userEmail);
  }

    async acceptOrder(userEmail: string, id: string): Promise<{ success: boolean; message?: string }> {
    // Get the order
    const order = await orderRepository.findById(userEmail, id);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'pending') {
      throw new Error('Only pending orders can be accepted');
    }

    // Validate stock availability
    const stockCheck = await this.validateStock(userEmail, order.products);
    if (!stockCheck.valid) {
      return {
        success: false,
        message: `Insufficient stock for: ${stockCheck.insufficientProducts.join(', ')}`,
      };
    }

    // Deduct stock from products
    await this.deductStock(userEmail, order.products);

    // Update order status to Processing
    await orderRepository.updateStatus(userEmail, id, 'processing');

    return { success: true };
  }

  async rejectOrder(userEmail: string, id: string): Promise<Order | null> {
    const order = await orderRepository.findById(userEmail, id);
    if (!order) return null;

    if (order.status !== 'pending') {
      throw new Error('Only pending orders can be rejected');
    }

    return orderRepository.updateStatus(userEmail, id, 'cancelled');
  }

  // Helper method to validate stock availability
  private async validateStock(
    userEmail: string,
    orderProducts: { productId: string; quantity: number }[]
  ): Promise<{ valid: boolean; insufficientProducts: string[] }> {
    const insufficientProducts: string[] = [];

    for (const item of orderProducts) {
      const product = await productRepository.findById(userEmail, item.productId);
      if (!product) {
        insufficientProducts.push(`Product ${item.productId} not found`);
        continue;
      }
      if (product.quantity < item.quantity) {
        insufficientProducts.push(`${product.name} (need ${item.quantity}, have ${product.quantity})`);
      }
    }

    return {
      valid: insufficientProducts.length === 0,
      insufficientProducts,
    };
  }

  // Helper method to deduct stock
  private async deductStock(
    userEmail: string,
    orderProducts: { productId: string; quantity: number }[]
  ): Promise<void> {
    for (const item of orderProducts) {
      const product = await productRepository.findById(userEmail, item.productId);
      if (!product) continue;

      const newQuantity = product.quantity - item.quantity;
      await productRepository.update(userEmail, item.productId, {
        quantity: newQuantity,
      });
    }
  }

async cancelOrder(userEmail: string, id: string): Promise<{ success: boolean; message?: string }> {
  // Get the order
  const order = await orderRepository.findById(userEmail, id);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.status !== 'processing') {
    throw new Error('Only processing orders can be cancelled');
  }

  // Restock products (reverse the stock deduction)
  await this.restockProducts(userEmail, order.products);

  // Update order status to Cancelled
  await orderRepository.updateStatus(userEmail, id, 'cancelled');

  return { success: true };
}

// Helper method to restock products when cancelling
private async restockProducts(
  userEmail: string,
  orderProducts: { productId: string; quantity: number }[]
): Promise<void> {
    for (const item of orderProducts) {
      const product = await productRepository.findById(userEmail, item.productId);
      if (!product) continue;

      const newQuantity = product.quantity + item.quantity;
      await productRepository.update(userEmail, item.productId, {
        quantity: newQuantity,
      });
    }
  }
}

export const orderService = new OrderService();