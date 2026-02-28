const { getProductDetails } = require("../products/product.repository");
const {
  getUserSoldAmount,
  getUserBoughtAmount,
  getOwnerSites,
  userRole,
  getUserSoldTotalForSpecificDay,
  getMostSoldItems,
  getTopCashiersSelling,
  getUserData,
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
    const product = await getProductDetails(productId);
    if (product) {
      mostSoldProducts.push(product);
    }
  }
  return mostSoldProducts;
}
async function getMostSellingCashiers(userId: String, range: number) {
  const mostSellingCashiersId = await getTopCashiersSelling(userId, range);
  const mostSellingCashiers = [];
  for (const cashierId of mostSellingCashiersId) {
    const cashier = await getUserData(cashierId);
    if (cashier) {
      mostSellingCashiers.push(cashier);
    }
  }
  return mostSellingCashiers;
}

module.exports = {
  getUserSoldTotal,
  getUserBoughtTotal,
  getUserOwnedSites,
  getUserRole,
  getUserSoldTotalForSpecificDayService,
  getMostSoldProduct,
  getMostSellingCashiers,
};
