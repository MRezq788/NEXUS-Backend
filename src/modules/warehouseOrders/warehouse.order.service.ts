import crypto from 'crypto'; // Ensure crypto is available for UUID generation
import { orderRepository } from "./warehouse.order.repository";
import { productRepository } from "../warehouseProducts/warehouse.product.repository";
import { Order, OrderStatus } from "./warehouse.order.model";
import {
  computeStatus,
  Product,
  ProductVariant,
} from "../warehouseProducts/warehouse.product.model";

export class OrderService {
  // Compare two attribute objects for equality (order-independent)
  private attributesMatch(
    a: Record<string, string>,
    b: Record<string, string>,
  ): boolean {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key, i) => key === keysB[i] && a[key] === b[key]);
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
    if (!orderData.buyer) throw new Error("Buyer is required");
    if (!orderData.products || orderData.products.length === 0) throw new Error("At least one product is required");
    if (orderData.total === undefined || orderData.total < 0) throw new Error("Valid total amount is required");

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
    if (!order) throw new Error("Order not found");

    if (status === "completed" && order.status !== "completed") {
      await this.addProductsToBuyerList(userEmail, order);
    }

    const ownerCanAccessProducts = status === "completed";
    const ownerProductAccessAt = ownerCanAccessProducts ? new Date().toISOString() : null;

    const updatedOrder = await orderRepository.update(userEmail, id, {
      status,
      ownerProductAccess: ownerCanAccessProducts,
      ownerProductAccessAt,
    });

    if (order.buyer) {
      try {
        await orderRepository.update(order.buyer, id, {
          status,
          ownerProductAccess: ownerCanAccessProducts,
          ownerProductAccessAt,
        });
      } catch (error) {
        console.error(`Failed to mirror status for buyer order ${id} (${order.buyer})`, error);
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
    const order = await orderRepository.findById(userEmail, id);
    if (!order) throw new Error("Order not found");
    if (order.status !== "pending") throw new Error("Only pending orders can be accepted");

    const stockCheck = await this.validateStock(userEmail, order.products);
    if (!stockCheck.valid) {
      return {
        success: false,
        message: `Insufficient stock for: ${stockCheck.insufficientProducts.join(", ")}`,
      };
    }

    await this.deductStock(userEmail, order.products);
    await this.updateOrderStatus(userEmail, id, "processing");

    return { success: true };
  }

  async rejectOrder(userEmail: string, id: string): Promise<Order | null> {
    const order = await orderRepository.findById(userEmail, id);
    if (!order) return null;
    if (order.status !== "pending") throw new Error("Only pending orders can be rejected");

    return this.updateOrderStatus(userEmail, id, "cancelled");
  }

  private async validateStock(
    userEmail: string,
    orderProducts: { productId: string; quantity: number; variantId?: string; }[],
  ): Promise<{ valid: boolean; insufficientProducts: string[] }> {
    const insufficientProducts: string[] = [];

    for (const item of orderProducts) {
      const product = await productRepository.findById(userEmail, item.productId);
      if (!product) {
        insufficientProducts.push(`Product ${item.productId} not found`);
        continue;
      }

      if (item.variantId && Array.isArray(product.variants) && product.variants.length > 0) {
        const selectedVariant = product.variants.find((variant) => variant.id === item.variantId);
        const availableVariantQuantity = Number(selectedVariant?.quantity) || 0;

        if (!selectedVariant) {
          insufficientProducts.push(`${product.name} (variant not found)`);
          continue;
        }

        if (availableVariantQuantity < item.quantity) {
          insufficientProducts.push(`${product.name} (${item.variantId}) (need ${item.quantity}, have ${availableVariantQuantity})`);
        }
        continue;
      }

      const availableQuantity = this.getAvailableQuantity(product);
      if (availableQuantity < item.quantity) {
        insufficientProducts.push(`${product.name} (need ${item.quantity}, have ${availableQuantity})`);
      }
    }

    return { valid: insufficientProducts.length === 0, insufficientProducts };
  }

  private async deductStock(
    userEmail: string,
    orderProducts: { productId: string; quantity: number; variantId?: string; }[],
  ): Promise<void> {
    for (const item of orderProducts) {
      const product = await productRepository.findById(userEmail, item.productId);
      if (!product) continue;

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

      if (hasVariants) {
        const updatedVariants = item.variantId
          ? this.updateSpecificVariant(product.variants as ProductVariant[], item.variantId, -item.quantity)
          : this.deductFromVariants(product.variants as ProductVariant[], item.quantity);
        const updatedQuantity = updatedVariants.reduce((acc, variant) => acc + (Number(variant.quantity) || 0), 0);

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
    const order = await orderRepository.findById(userEmail, id);
    if (!order) throw new Error("Order not found");
    if (order.status !== "processing") throw new Error("Only processing orders can be cancelled");

    await this.restockProducts(userEmail, order.products);
    await this.updateOrderStatus(userEmail, id, "cancelled");

    return { success: true };
  }

  private async restockProducts(
    userEmail: string,
    orderProducts: { productId: string; quantity: number; variantId?: string; }[],
  ): Promise<void> {
    for (const item of orderProducts) {
      const product = await productRepository.findById(userEmail, item.productId);
      if (!product) continue;

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

      if (hasVariants) {
        const updatedVariants = item.variantId
          ? this.updateSpecificVariant(product.variants as ProductVariant[], item.variantId, item.quantity)
          : this.restockToVariants(product.variants as ProductVariant[], item.quantity);
        const updatedQuantity = updatedVariants.reduce((acc, variant) => acc + (Number(variant.quantity) || 0), 0);

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
    const buyerEmail = order.buyer;
    if (!buyerEmail) return;

    const buyerExists = await orderRepository.verifyUser(buyerEmail);
    if (!buyerExists) throw new Error("Buyer user not found");

    // 🔹 GROUP order items by productId to process each product once
    const groupedByProduct = new Map<string, typeof order.products>();
    for (const item of order.products) {
      if (!groupedByProduct.has(item.productId)) {
        groupedByProduct.set(item.productId, []);
      }
      groupedByProduct.get(item.productId)!.push(item);
    }

    // 🔹 Fetch buyer's existing products once
    const buyerProducts = await productRepository.findAll(buyerEmail, 1, 1000);
    const existingProductsByName = new Map<string, Product>();
    for (const p of buyerProducts.products) {
      const fullProduct = await productRepository.findById(buyerEmail, p.id);
      if (fullProduct) {
        existingProductsByName.set(fullProduct.name.toLowerCase(), fullProduct);
      }
    }

    // 🔹 Process each unique product
    for (const [productId, items] of groupedByProduct) {
      try {
        const originalProduct = await productRepository.findById(sellerEmail, productId);
        if (!originalProduct) continue;

        const basePrice = Number(originalProduct.basePrice ?? originalProduct.price ?? 0);
        const existingProduct = existingProductsByName.get(originalProduct.name.toLowerCase());

        if (existingProduct) {
          // ── Product exists: merge new variants into existing ones ──
          // Start with a deep copy of all existing variants
          const mergedVariants: ProductVariant[] = Array.isArray(existingProduct.variants)
            ? existingProduct.variants.map(v => ({ ...v }))
            : [];

          // Also track total quantity from existing variants (or product-level quantity if no variants)
          let totalQuantity = mergedVariants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);

          // If product has no variants but has quantity, create a default variant to track it
          if (mergedVariants.length === 0 && (existingProduct.quantity || 0) > 0) {
            mergedVariants.push({
              id: crypto.randomUUID(),
              price: Number(existingProduct.price) || basePrice,
              quantity: existingProduct.quantity,
            });
            totalQuantity = existingProduct.quantity;
          }

          // Track all attributes across all variants (existing + new)
          const allAttributes = new Map<string, Set<string>>();

          // First: collect attributes from existing variants
          for (const v of mergedVariants) {
            const { id: _id, price: _pr, quantity: _qt, ...vAttrs } = v;
            for (const [key, value] of Object.entries(vAttrs)) {
              if (!allAttributes.has(key)) allAttributes.set(key, new Set());
              allAttributes.get(key)!.add(String(value));
            }
          }

          // Second: process each ordered item and merge into mergedVariants
          for (const item of items) {
            const sourceVariant = item.variantId
              ? (originalProduct.variants || []).find((v) => v.id === item.variantId)
              : undefined;

            const { id: _i, price: _p, quantity: _q, ...sourceVariantAttributes } = sourceVariant || {};
            const selectedVariantAttributes: Record<string, string> = item.variantAttributes || (sourceVariantAttributes as any) || {};
            const selectedVariantPrice = Number(sourceVariant?.price ?? item.price ?? basePrice);
            const hasSelectedAttributes = Object.keys(selectedVariantAttributes).length > 0;

            if (hasSelectedAttributes) {
              // Try to find matching variant by attributes
              const variantIndex = mergedVariants.findIndex((v) => {
                const { id: _id, price: _pr, quantity: _qt, ...vAttrs } = v;
                return this.attributesMatch(vAttrs as Record<string, string>, selectedVariantAttributes);
              });

              if (variantIndex >= 0) {
                // Found matching variant: increment quantity
                mergedVariants[variantIndex] = {
                  ...mergedVariants[variantIndex],
                  ...selectedVariantAttributes,
                  price: selectedVariantPrice,
                  quantity: (Number(mergedVariants[variantIndex].quantity) || 0) + item.quantity,
                };
              } else {
                // New variant: add it
                mergedVariants.push({
                  id: crypto.randomUUID(),
                  ...selectedVariantAttributes,
                  price: selectedVariantPrice,
                  quantity: item.quantity,
                });
              }

              // Track attributes
              for (const [key, value] of Object.entries(selectedVariantAttributes)) {
                if (!allAttributes.has(key)) allAttributes.set(key, new Set());
                allAttributes.get(key)!.add(String(value));
              }
            } else {
              // No variant attributes: add to a default variant or create one
              if (mergedVariants.length > 0) {
                // Add to first variant
                mergedVariants[0] = {
                  ...mergedVariants[0],
                  quantity: (Number(mergedVariants[0].quantity) || 0) + item.quantity,
                };
              } else {
                mergedVariants.push({
                  id: crypto.randomUUID(),
                  price: basePrice,
                  quantity: item.quantity,
                });
              }
            }

            totalQuantity += item.quantity;
          }

          // Build final attributes array
          const mergedAttributes = Array.from(allAttributes.entries()).map(([name, values]) => ({
            name,
            values: Array.from(values),
          }));

          // Update the product once with fully merged variants
          await productRepository.update(buyerEmail, existingProduct.id, {
            variants: mergedVariants,
            quantity: totalQuantity,
            attributes: mergedAttributes.length > 0 ? mergedAttributes : originalProduct.attributes || [],
            price: basePrice,
            basePrice,
          });

          // Update in map so subsequent products with same name see updated state
          existingProduct.variants = mergedVariants;
          existingProduct.quantity = totalQuantity;

        } else {
          // ── Product doesn't exist: create once with all variants ──
          const allVariants: any[] = [];
          const allAttributes = new Map<string, Set<string>>();

          for (const item of items) {
            const sourceVariant = item.variantId
              ? (originalProduct.variants || []).find((v) => v.id === item.variantId)
              : undefined;

            const { id: _i, price: _p, quantity: _q, ...sourceVariantAttributes } = sourceVariant || {};
            const selectedVariantAttributes: Record<string, string> = item.variantAttributes || (sourceVariantAttributes as any) || {};
            const selectedVariantPrice = Number(sourceVariant?.price ?? item.price ?? basePrice);
            const hasSelectedAttributes = Object.keys(selectedVariantAttributes).length > 0;

            if (hasSelectedAttributes) {
              // Check if variant already exists in allVariants (within this same order)
              const existingIndex = allVariants.findIndex((v) => {
                const { id: _id, price: _pr, quantity: _qt, ...vAttrs } = v;
                return this.attributesMatch(vAttrs as Record<string, string>, selectedVariantAttributes);
              });

              if (existingIndex >= 0) {
                allVariants[existingIndex].quantity = (Number(allVariants[existingIndex].quantity) || 0) + item.quantity;
              } else {
                allVariants.push({
                  id: crypto.randomUUID(),
                  ...selectedVariantAttributes,
                  price: selectedVariantPrice,
                  quantity: item.quantity,
                });
              }

              for (const [key, value] of Object.entries(selectedVariantAttributes)) {
                if (!allAttributes.has(key)) allAttributes.set(key, new Set());
                allAttributes.get(key)!.add(String(value));
              }
            } else {
              // No variant attributes
              if (allVariants.length > 0) {
                allVariants[0].quantity = (Number(allVariants[0].quantity) || 0) + item.quantity;
              } else {
                allVariants.push({
                  id: crypto.randomUUID(),
                  price: basePrice,
                  quantity: item.quantity,
                });
              }
            }
          }

          const totalQuantity = allVariants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
          const mergedAttributes = Array.from(allAttributes.entries()).map(([name, values]) => ({
            name,
            values: Array.from(values),
          }));

          const newProduct = await productRepository.create(buyerEmail, {
            name: originalProduct.name,
            quantity: totalQuantity,
            unit: originalProduct.unit,
            price: basePrice,
            basePrice,
            description: originalProduct.description,
            category: originalProduct.category,
            images: originalProduct.images || [],
            attributes: mergedAttributes.length > 0 ? mergedAttributes : originalProduct.attributes || [],
            variants: allVariants.length > 0 ? allVariants : undefined,
            active: true,
          });

          // Add to map so subsequent products with same name are found
          existingProductsByName.set(originalProduct.name.toLowerCase(), newProduct as Product);
        }
      } catch (error) {
        console.error(`Failed to add product ${productId} to buyer's list:`, error);
      }
    }
  }
}

export const orderService = new OrderService();