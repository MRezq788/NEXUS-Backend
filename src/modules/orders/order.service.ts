import { createOrdersRepo, createSingleOrderRepo } from './order.repository';

interface IncomingOrder {
  buyerEmail: string;
  sellerEmail: string;
  products: {
    productId: string;
    quantity: number;
  }[];
  total: number;
}

export const createOrdersService = async (
  orders: IncomingOrder[]
) => {
  // 🔹 Basic validation layer
  for (const order of orders) {
    if (
      !order.buyerEmail ||
      !order.sellerEmail ||
      !Array.isArray(order.products) ||
      order.products.length === 0 ||
      typeof order.total !== 'number'
    ) {
      throw new Error('Invalid order format');
    }
  }

  // 🔥 Call repository (atomic batch inside)
  await createOrdersRepo(orders);
};

export const createSingleOrderService = async (
  order: IncomingOrder
) => {
  const { buyerEmail, sellerEmail, products, total } = order;

  // 🔹 Basic validation
  if (
    !buyerEmail ||
    !sellerEmail ||
    !Array.isArray(products) ||
    products.length === 0 ||
    typeof total !== 'number'
  ) {
    throw new Error('Invalid order format');
  }

  // 🔥 Call repository
  return await createSingleOrderRepo(order);
};