import { getProductDetails } from "../products/product.repository";
import {
  getUserSoldAmount,
  getUserBoughtAmount,
  getOwnerSites,
  userRole,
  getUserSoldTotalForSpecificDay,
  getMostSoldItems,
  getUserData,
  getTopCashiersSelling,
  getUserRevenue,
  getTotalOrders,
  getRecentOrders,
  getRevenueGrowth,
  getTotalOrdersForPeriod,
  getTotalRevenueForPeriod,
  createUserDocument,
  CreateUserData,
  getUserProfileByEmail,
} from "./user.repository";

export async function getUserSoldTotal(userId: string) {
  return await getUserSoldAmount(userId);
}

export async function getUserBoughtTotal(userId: string) {
  return await getUserBoughtAmount(userId);
}

export async function getUserOwnedSites(userId: string) {
  return await getOwnerSites(userId);
}

export async function getUserRole(userId: string) {
  return await userRole(userId);
}

export async function getUserSoldTotalForSpecificDayService(
  userId: string,
  date: Date,
) {
  return await getUserSoldTotalForSpecificDay(userId, date);
}

export async function getMostSoldProduct(userId: string, range: number) {
  const mostSoldProductsId = await getMostSoldItems(userId, range);

  const mostSoldProducts = [];
  for (const productId of mostSoldProductsId) {
    const product = await getProductDetails(productId, userId);
    if (product) {
      mostSoldProducts.push(product);
    }
  }

  return mostSoldProducts;
}

export async function getMostSellingCashiers(userId: string, range: number) {
  const cashiersWithTotals = await getTopCashiersSelling(userId, range);

  const mostSellingCashiers = [];
  for (const { cashierId, totalSold } of cashiersWithTotals) {
    const cashier = await getUserData(cashierId);
    if (cashier) {
      mostSellingCashiers.push({
        ...cashier,
        totalSold,
      });
    }
  }
  return mostSellingCashiers;
}

export async function getUserRevenueData(userId: string, period: string) {
  return await getUserRevenue(userId, period);
}

export async function getTotalOrdersService(userId: string) {
  return await getTotalOrders(userId);
}

export async function getRecentOrdersService(userId: string, limit: number) {
  return await getRecentOrders(userId, limit);
}

export async function getRevenueGrowthService(userId: string, period: string) {
  return await getRevenueGrowth(userId, period);
}

export async function getTotalOrdersForPeriodService(
  userId: string,
  period: string,
) {
  return await getTotalOrdersForPeriod(userId, period);
}

export async function getTotalRevenueForPeriodService(
  userId: string,
  period: string,
) {
  return await getTotalRevenueForPeriod(userId, period);
}

export async function getCurrentUserProfileService(email: string) {
  return await getUserProfileByEmail(email);
}

export const syncNewUser = async (data: CreateUserData) => {
  // Business Logic: Ensure the role is one of the allowed types
  const validRoles = ["business_owner", "warehouse", "app_User"];

  if (!validRoles.includes(data.role)) {
    throw new Error(`Business Logic Error: Invalid role '${data.role}'.`);
  }

  // Delegate the actual database creation to the repository
  const createdUser = await createUserDocument(data);

  return createdUser;
};
