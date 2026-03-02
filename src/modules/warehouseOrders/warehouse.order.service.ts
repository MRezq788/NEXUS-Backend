import { orderRepository } from './warehouse.order.repository';
import { productRepository } from '../warehouseProducts/warehouse.product.repository';
import { Order, OrderStatus } from './warehouse.order.model';

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

    const order = await orderRepository.findById(userEmail, id);
    if (!order) {
      throw new Error('Order not found');
    }

    // If changing to completed, add products to buyer's list
    if (status === 'completed' && order.status !== 'completed') {
      await this.addProductsToBuyerList(userEmail, order);
    }

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

   private async addProductsToBuyerList(
    sellerEmail: string,
    order: Order
  ): Promise<void> {
    // The buyer's email is stored in order.buyer
    const buyerEmail = order.buyer;
    
    console.log(`Adding products to buyer ${buyerEmail}'s list for order ${order.id}`);

    if (!buyerEmail) {
      console.error('No buyer email found in order');
      return;
    }

    // Verify buyer exists as a user
    const buyerExists = await orderRepository.verifyUser(buyerEmail);
    if (!buyerExists) {
      console.error(`Buyer ${buyerEmail} not found`);
      throw new Error('Buyer user not found');
    }

    // For each product in the order, add it to buyer's product list
    for (const item of order.products) {
      try {
        // Get the original product details from seller
        const originalProduct = await productRepository.findById(sellerEmail, item.productId);
        
        if (!originalProduct) {
          console.error(`Product ${item.productId} not found in seller's inventory`);
          continue;
        }

        // Check if buyer already has this product (by name)
        // We'll search through buyer's products to avoid duplicates
        const buyerProducts = await productRepository.findAll(buyerEmail, 1, 1000);
        const existingProduct = buyerProducts.products.find(
          p => p.name.toLowerCase() === originalProduct.name.toLowerCase()
        );

        if (existingProduct) {
          // Update existing product quantity
          const newQuantity = existingProduct.quantity + item.quantity;
          await productRepository.update(buyerEmail, existingProduct.id, {
            quantity: newQuantity,
          });
        } else {
          // Create new product for buyer
          await productRepository.create(buyerEmail, {
            name: originalProduct.name,
            quantity: item.quantity,
            unit: originalProduct.unit,
            price: originalProduct.price,
            description: originalProduct.description,
            category: originalProduct.category,
          });
        }
        console.log(`Added product ${originalProduct.name} (quantity: ${item.quantity}) to buyer ${buyerEmail}'s list`);
      } catch (error) {
        console.error(`Failed to add product ${item.productId} to buyer's list:`, error);
        // Continue with other products even if one fails
      }
    }
  }
}

export const orderService = new OrderService();