import { orderRepository } from "./warehouse.order.repository";
import { productRepository } from "../warehouseProducts/warehouse.product.repository";
import { Order, OrderStatus } from "./warehouse.order.model";
import {
  computeStatus,
  Product,
  ProductVariant,
} from "../warehouseProducts/warehouse.product.model";

export class OrderService {
  private buildVariantId(attributes: Record<string, string>): string {
    const raw = Object.entries(attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}-${String(value)}`)
      .join("-")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "");

    return raw || "default";
  }

  private mergeAttributeValues(
    existing: Array<{ name: string; values: string[] }> = [],
    incoming: Record<string, string>,
  ): Array<{ name: string; values: string[] }> {
    const attributeMap = new Map<string, Set<string>>();

    for (const attr of existing) {
      attributeMap.set(attr.name, new Set(attr.values || []));
    }

    for (const [name, value] of Object.entries(incoming)) {
      if (!attributeMap.has(name)) {
        attributeMap.set(name, new Set());
      }
      attributeMap.get(name)?.add(String(value));
    }

    return Array.from(attributeMap.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  }

  private getAvailableQuantity(product: Product): number {
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants.reduce(
        (acc, variant) => acc + (Number(variant.quantity) || 0),
        0,
      );
    }
    return Number(product.quantity) || 0;
  }

  private deductFromVariants(
    variants: ProductVariant[],
    amount: number,
  ): ProductVariant[] {
    let remaining = amount;

    const updatedVariants = variants.map((variant) => {
      if (remaining <= 0) {
        return variant;
      }

      const currentQuantity = Number(variant.quantity) || 0;
      const taken = Math.min(currentQuantity, remaining);
      remaining -= taken;

      return {
        ...variant,
        quantity: currentQuantity - taken,
      };
    });

    if (remaining > 0) {
      throw new Error("Insufficient variant stock while deducting quantities");
    }

    return updatedVariants;
  }

  private updateSpecificVariant(
    variants: ProductVariant[],
    variantId: string,
    delta: number,
  ): ProductVariant[] {
    let found = false;

    const updatedVariants = variants.map((variant) => {
      if (variant.id !== variantId) {
        return variant;
      }

      found = true;
      const nextQuantity = (Number(variant.quantity) || 0) + delta;
      if (nextQuantity < 0) {
        throw new Error(`Insufficient stock for variant ${variantId}`);
      }

      return {
        ...variant,
        quantity: nextQuantity,
      };
    });

    if (!found) {
      throw new Error(`Variant ${variantId} not found`);
    }

    return updatedVariants;
  }

  private restockToVariants(
    variants: ProductVariant[],
    amount: number,
  ): ProductVariant[] {
    if (variants.length === 0) {
      return [
        {
          id: "default",
          attributes: {},
          price: 0,
          quantity: amount,
        },
      ];
    }

    const [first, ...rest] = variants;
    return [
      {
        ...first,
        quantity: (Number(first.quantity) || 0) + amount,
      },
      ...rest,
    ];
  }

  async getOrders(userEmail: string, status?: OrderStatus): Promise<Order[]> {
    return orderRepository.findAll(userEmail, status);
  }

  async getOrderById(userEmail: string, id: string): Promise<Order | null> {
    return orderRepository.findById(userEmail, id);
  }

  async createOrder(
    userEmail: string,
    orderData: Partial<Order>,
  ): Promise<Order> {
    // Validate required fields
    if (!orderData.buyer) {
      throw new Error("Buyer is required");
    }
    if (!orderData.products || orderData.products.length === 0) {
      throw new Error("At least one product is required");
    }
    if (orderData.total === undefined || orderData.total < 0) {
      throw new Error("Valid total amount is required");
    }

    return orderRepository.create(userEmail, orderData);
  }

  async updateOrder(
    userEmail: string,
    id: string,
    orderData: Partial<Order>,
  ): Promise<Order | null> {
    return orderRepository.update(userEmail, id, orderData);
  }

  async updateOrderStatus(
    userEmail: string,
    id: string,
    status: OrderStatus,
  ): Promise<Order | null> {
    const order = await orderRepository.findById(userEmail, id);
    if (!order) {
      throw new Error("Order not found");
    }

    // If changing to completed, add products to buyer's list
    if (status === "completed" && order.status !== "completed") {
      await this.addProductsToBuyerList(userEmail, order);
    }

    const ownerCanAccessProducts = status === "completed";
    const ownerProductAccessAt = ownerCanAccessProducts
      ? new Date().toISOString()
      : null;

    const updatedOrder = await orderRepository.update(userEmail, id, {
      status,
      ownerProductAccess: ownerCanAccessProducts,
      ownerProductAccessAt,
    });

    // Keep buyer-side order status/access aligned with warehouse order status.
    if (order.buyer) {
      try {
        await orderRepository.update(order.buyer, id, {
          status,
          ownerProductAccess: ownerCanAccessProducts,
          ownerProductAccessAt,
        });
      } catch (error) {
        console.error(
          `Failed to mirror status for buyer order ${id} (${order.buyer})`,
          error,
        );
      }
    }

    return updatedOrder;
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

  async acceptOrder(
    userEmail: string,
    id: string,
  ): Promise<{ success: boolean; message?: string }> {
    // Get the order
    const order = await orderRepository.findById(userEmail, id);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "pending") {
      throw new Error("Only pending orders can be accepted");
    }

    // Validate stock availability
    const stockCheck = await this.validateStock(userEmail, order.products);
    if (!stockCheck.valid) {
      return {
        success: false,
        message: `Insufficient stock for: ${stockCheck.insufficientProducts.join(", ")}`,
      };
    }

    // Deduct stock from products
    await this.deductStock(userEmail, order.products);

    // Update order status to Processing
    await orderRepository.updateStatus(userEmail, id, "processing");

    return { success: true };
  }

  async rejectOrder(userEmail: string, id: string): Promise<Order | null> {
    const order = await orderRepository.findById(userEmail, id);
    if (!order) return null;

    if (order.status !== "pending") {
      throw new Error("Only pending orders can be rejected");
    }

    return orderRepository.updateStatus(userEmail, id, "cancelled");
  }

  // Helper method to validate stock availability
  private async validateStock(
    userEmail: string,
    orderProducts: {
      productId: string;
      quantity: number;
      variantId?: string;
    }[],
  ): Promise<{ valid: boolean; insufficientProducts: string[] }> {
    const insufficientProducts: string[] = [];

    for (const item of orderProducts) {
      const product = await productRepository.findById(
        userEmail,
        item.productId,
      );
      if (!product) {
        insufficientProducts.push(`Product ${item.productId} not found`);
        continue;
      }

      if (
        item.variantId &&
        Array.isArray(product.variants) &&
        product.variants.length > 0
      ) {
        const selectedVariant = product.variants.find(
          (variant) => variant.id === item.variantId,
        );
        const availableVariantQuantity = Number(selectedVariant?.quantity) || 0;

        if (!selectedVariant) {
          insufficientProducts.push(`${product.name} (variant not found)`);
          continue;
        }

        if (availableVariantQuantity < item.quantity) {
          insufficientProducts.push(
            `${product.name} (${item.variantId}) (need ${item.quantity}, have ${availableVariantQuantity})`,
          );
        }
        continue;
      }

      const availableQuantity = this.getAvailableQuantity(product);
      if (availableQuantity < item.quantity) {
        insufficientProducts.push(
          `${product.name} (need ${item.quantity}, have ${availableQuantity})`,
        );
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
    orderProducts: {
      productId: string;
      quantity: number;
      variantId?: string;
    }[],
  ): Promise<void> {
    for (const item of orderProducts) {
      const product = await productRepository.findById(
        userEmail,
        item.productId,
      );
      if (!product) continue;

      const hasVariants =
        Array.isArray(product.variants) && product.variants.length > 0;

      if (hasVariants) {
        const updatedVariants = item.variantId
          ? this.updateSpecificVariant(
              product.variants as ProductVariant[],
              item.variantId,
              -item.quantity,
            )
          : this.deductFromVariants(
              product.variants as ProductVariant[],
              item.quantity,
            );
        const updatedQuantity = updatedVariants.reduce(
          (acc, variant) => acc + (Number(variant.quantity) || 0),
          0,
        );

        await productRepository.update(userEmail, item.productId, {
          variants: updatedVariants,
          quantity: updatedQuantity,
          status: computeStatus(updatedQuantity),
        });
      } else {
        const newQuantity = (Number(product.quantity) || 0) - item.quantity;
        await productRepository.update(userEmail, item.productId, {
          quantity: newQuantity,
          status: computeStatus(newQuantity),
        });
      }
    }
  }

  async cancelOrder(
    userEmail: string,
    id: string,
  ): Promise<{ success: boolean; message?: string }> {
    // Get the order
    const order = await orderRepository.findById(userEmail, id);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "processing") {
      throw new Error("Only processing orders can be cancelled");
    }

    // Restock products (reverse the stock deduction)
    await this.restockProducts(userEmail, order.products);

    // Update order status to Cancelled
    await orderRepository.updateStatus(userEmail, id, "cancelled");

    return { success: true };
  }

  // Helper method to restock products when cancelling
  private async restockProducts(
    userEmail: string,
    orderProducts: {
      productId: string;
      quantity: number;
      variantId?: string;
    }[],
  ): Promise<void> {
    for (const item of orderProducts) {
      const product = await productRepository.findById(
        userEmail,
        item.productId,
      );
      if (!product) continue;

      const hasVariants =
        Array.isArray(product.variants) && product.variants.length > 0;

      if (hasVariants) {
        const updatedVariants = item.variantId
          ? this.updateSpecificVariant(
              product.variants as ProductVariant[],
              item.variantId,
              item.quantity,
            )
          : this.restockToVariants(
              product.variants as ProductVariant[],
              item.quantity,
            );
        const updatedQuantity = updatedVariants.reduce(
          (acc, variant) => acc + (Number(variant.quantity) || 0),
          0,
        );

        await productRepository.update(userEmail, item.productId, {
          variants: updatedVariants,
          quantity: updatedQuantity,
          status: computeStatus(updatedQuantity),
        });
      } else {
        const newQuantity = (Number(product.quantity) || 0) + item.quantity;
        await productRepository.update(userEmail, item.productId, {
          quantity: newQuantity,
          status: computeStatus(newQuantity),
        });
      }
    }
  }

  private async addProductsToBuyerList(
    sellerEmail: string,
    order: Order,
  ): Promise<void> {
    // The buyer's email is stored in order.buyer
    const buyerEmail = order.buyer;

    console.log(
      `Adding products to buyer ${buyerEmail}'s list for order ${order.id}`,
    );

    if (!buyerEmail) {
      console.error("No buyer email found in order");
      return;
    }

    // Verify buyer exists as a user
    const buyerExists = await orderRepository.verifyUser(buyerEmail);
    if (!buyerExists) {
      console.error(`Buyer ${buyerEmail} not found`);
      throw new Error("Buyer user not found");
    }

    const buyerProducts = await productRepository.findAll(buyerEmail, 1, 1000);

    // For each product in the order, add it to buyer's product list
    for (const item of order.products) {
      try {
        // Get the original product details from seller
        const originalProduct = await productRepository.findById(
          sellerEmail,
          item.productId,
        );

        if (!originalProduct) {
          console.error(
            `Product ${item.productId} not found in seller's inventory`,
          );
          continue;
        }

        const existingProduct = buyerProducts.products.find(
          (p) => p.name.toLowerCase() === originalProduct.name.toLowerCase(),
        );

        const basePrice = Number(
          originalProduct.basePrice ?? originalProduct.price ?? 0,
        );

        const sourceVariant = item.variantId
          ? (originalProduct.variants || []).find(
              (variant) => variant.id === item.variantId,
            )
          : undefined;

        const selectedVariantAttributes: Record<string, string> =
          item.variantAttributes || sourceVariant?.attributes || {};

        const selectedVariantPrice = Number(
          sourceVariant?.price ?? item.price ?? basePrice,
        );

        const selectedVariantId =
          item.variantId || this.buildVariantId(selectedVariantAttributes);

        if (existingProduct) {
          const existingVariants = Array.isArray(existingProduct.variants)
            ? [...existingProduct.variants]
            : [];
          const hasExistingVariants = existingVariants.length > 0;

          if (item.variantId || hasExistingVariants) {
            const variants = hasExistingVariants
              ? existingVariants
              : [
                  {
                    id: "default",
                    attributes: {},
                    price: basePrice,
                    quantity: Number(existingProduct.quantity) || 0,
                  },
                ];

            const variantIndex = variants.findIndex(
              (variant) => variant.id === selectedVariantId,
            );

            if (variantIndex >= 0) {
              variants[variantIndex] = {
                ...variants[variantIndex],
                attributes:
                  Object.keys(selectedVariantAttributes).length > 0
                    ? selectedVariantAttributes
                    : variants[variantIndex].attributes,
                price: Number.isFinite(selectedVariantPrice)
                  ? selectedVariantPrice
                  : Number(variants[variantIndex].price) || 0,
                quantity:
                  (Number(variants[variantIndex].quantity) || 0) +
                  item.quantity,
              };
            } else {
              variants.push({
                id: selectedVariantId,
                attributes: selectedVariantAttributes,
                price: selectedVariantPrice,
                quantity: item.quantity,
              });
            }

            const nextQuantity = variants.reduce(
              (sum, variant) => sum + (Number(variant.quantity) || 0),
              0,
            );

            await productRepository.update(buyerEmail, existingProduct.id, {
              variants,
              quantity: nextQuantity,
              attributes: this.mergeAttributeValues(
                existingProduct.attributes,
                selectedVariantAttributes,
              ),
              price: basePrice,
              basePrice,
            });
          } else {
            // Non-variant product update path
            const newQuantity =
              (Number(existingProduct.quantity) || 0) + item.quantity;
            await productRepository.update(buyerEmail, existingProduct.id, {
              quantity: newQuantity,
              price: basePrice,
              basePrice,
              attributes: originalProduct.attributes || [],
            });
          }
        } else {
          // Create new product for buyer with full structure.
          const hasProductVariants =
            Array.isArray(originalProduct.variants) &&
            originalProduct.variants.length > 0;

          const initialVariants = item.variantId
            ? [
                {
                  id: selectedVariantId,
                  attributes: selectedVariantAttributes,
                  price: selectedVariantPrice,
                  quantity: item.quantity,
                },
              ]
            : hasProductVariants
              ? [
                  {
                    id: "default",
                    attributes: {},
                    price: basePrice,
                    quantity: item.quantity,
                  },
                ]
              : undefined;

          const initialAttributes = item.variantId
            ? this.mergeAttributeValues(
                originalProduct.attributes,
                selectedVariantAttributes,
              )
            : originalProduct.attributes || [];

          await productRepository.create(buyerEmail, {
            name: originalProduct.name,
            quantity: item.quantity,
            unit: originalProduct.unit,
            price: basePrice,
            basePrice,
            description: originalProduct.description,
            category: originalProduct.category,
            images: originalProduct.images || [],
            attributes: initialAttributes,
            variants: initialVariants,
            active: true,
          });
        }
        console.log(
          `Added product ${originalProduct.name} (quantity: ${item.quantity}) to buyer ${buyerEmail}'s list`,
        );
      } catch (error) {
        console.error(
          `Failed to add product ${item.productId} to buyer's list:`,
          error,
        );
        // Continue with other products even if one fails
      }
    }
  }
}

export const orderService = new OrderService();
