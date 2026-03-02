const { getProductDetails } = require("../products/product.repository");
const {
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
} = require("./user.repository");

async function getUserSoldTotal(userId: String) {
  return await getUserSoldAmount(userId);
}
async function getUserBoughtTotal(userId: String) {
  return await getUserBoughtAmount(userId);
}
async function getUserOwnedSites(userId: String) {
  return await getOwnerSites(userId);
}
async function getUserRole(userId: String) {
  return await userRole(userId);
}
async function getUserSoldTotalForSpecificDayService(
  userId: String,
  date: Date,
) {
  return await getUserSoldTotalForSpecificDay(userId, date);
}
async function getMostSoldProduct(userId: String, range: number) {
  const mostSoldPoductsId = await getMostSoldItems(userId, range);

  const mostSoldProducts = [];
  for (const productId of mostSoldPoductsId) {
    const product = await getProductDetails(productId, userId);
    if (product) {
      mostSoldProducts.push(product);
    }
  }

  return mostSoldProducts;
}
async function getMostSellingCashiers(userId: String, range: number) {
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
async function getUserRevenueData(userId: String, period: String) {
  return await getUserRevenue(userId, period);
}
async function getTotalOrdersService(userId: String) {
  return await getTotalOrders(userId);
}
async function getRecentOrdersService(userId: String, limit: number) {
  return await getRecentOrders(userId, limit);
}
async function getRevenueGrowthService(userId: String, period: String) {
  return await getRevenueGrowth(userId, period);
}
async function getTotalOrdersForPeriodService(userId: String, period: String) {
  return await getTotalOrdersForPeriod(userId, period);
}
async function getTotalRevenueForPeriodService(userId: String, period: String) {
  return await getTotalRevenueForPeriod(userId, period);
}

module.exports = {
  getUserSoldTotal,
  getUserBoughtTotal,
  getUserOwnedSites,
  getUserRole,
  getUserSoldTotalForSpecificDayService,
  getMostSoldProduct,
  getMostSellingCashiers,
  getUserRevenueData,
  getTotalOrdersService,
  getRecentOrdersService,
  getRevenueGrowthService,
  getTotalOrdersForPeriodService,
  getTotalRevenueForPeriodService,
};
import * as userRepository from './user.repository';
import { CreateUserData } from './user.repository';

export const syncNewUser = async (data: CreateUserData) => {
  // Business Logic: Ensure the role is one of the allowed types
  const validRoles = ["business_owner", "warehouse", "app_User"];
  
  if (!validRoles.includes(data.role)) {
    throw new Error(`Business Logic Error: Invalid role '${data.role}'.`);
  }

  // Delegate the actual database creation to the repository
  const createdUser = await userRepository.createUserDocument(data);
  
  return createdUser;
};