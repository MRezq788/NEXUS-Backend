const {
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
} = require("./user.service");
const { success, error } = require("../../core/utils/response");
export const getUserSoldTotalController = async (req: any, res: any) => {
  const userId = req.params.userId;
  try {
    const totalSold = await getUserSoldTotal(userId);
    return success(res, { totalSold }, "User sold total fetched successfully");
  } catch (err) {
    console.error("Error fetching user sold total:", err);
    return error(res, "Failed to fetch user sold total", 500);
  }
};

export const getUserBoughtTotalController = async (req: any, res: any) => {
  const userId = req.params.userId;
  try {
    const totalBought = await getUserBoughtTotal(userId);
    return success(
      res,
      { totalBought },
      "User bought total fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user bought total:", err);
    return error(res, "Failed to fetch user bought total", 500);
  }
};

export const getUserOwnedSitesController = async (req: any, res: any) => {
  const userId = req.params.userId;
  const isUserOwner = (await getUserRole(userId)) === "business_owner";
  try {
    if (!isUserOwner) {
      return error(res, "User is not a business owner", 403);
    }
    const ownedSites = await getUserOwnedSites(userId);
    return success(
      res,
      { ownedSites, isUserOwner },
      "User owned sites fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user owned sites:", err);
    return error(res, "Failed to fetch user owned sites", 500);
  }
};

export const getUserSoldTotalForSpecificDayController = async (
  req: any,
  res: any,
) => {
  const userId = req.params.userId;
  const date = new Date(req.query.date);
  try {
    const totalSold = await getUserSoldTotalForSpecificDayService(userId, date);
    return success(
      res,
      { totalSold },
      "User sold total for specific day fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user sold total for specific day:", err);
    return error(res, "Failed to fetch user sold total for specific day", 500);
  }
};

export const getMostSoldProductsController = async (req: any, res: any) => {
  const userId = req.params.userId;
  const range = parseInt(req.query.range) || 5;
  try {
    const mostSoldProducts = await getMostSoldProduct(userId, range);
    return success(
      res,
      { mostSoldProducts },
      "User's most sold products fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user's most sold products:", err);
    return error(res, "Failed to fetch user's most sold products", 500);
  }
};

export const getTopCashiersController = async (req: any, res: any) => {
  const userId = req.params.userId;
  const range = parseInt(req.query.range) || 5;
  try {
    const topCashiers = await getMostSellingCashiers(userId, range);
    return success(
      res,
      { topCashiers },
      "User's top cashiers fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user's top cashiers:", err);
    return error(res, "Failed to fetch user's top cashiers", 500);
  }
};

export const getUserRevenueController = async (req: any, res: any) => {
  const userId = req.params.userId;
  const period = req.query.period || "week";

  try {
    const data = await getUserRevenueData(userId, period);
    return success(res, { data }, "User revenue fetched successfully");
  } catch (err) {
    console.error("Error fetching user revenue:", err);
    return error(res, "Failed to fetch user revenue", 500);
  }
};

export const getTotalOrdersController = async (req: any, res: any) => {
  const userId = req.params.userId;
  try {
    const totalOrders = await getTotalOrdersService(userId);
    return success(res, { totalOrders }, "Total orders fetched successfully");
  } catch (err) {
    console.error("Error fetching total orders:", err);
    return error(res, "Failed to fetch total orders", 500);
  }
};

export const getRecentOrdersController = async (req: any, res: any) => {
  const userId = req.params.userId;
  const limit = parseInt(req.query.limit) || 10;
  try {
    const recentOrders = await getRecentOrdersService(userId, limit);
    return success(res, { recentOrders }, "Recent orders fetched successfully");
  } catch (err) {
    console.error("Error fetching recent orders:", err);
    return error(res, "Failed to fetch recent orders", 500);
  }
};

export const getRevenueGrowthController = async (req: any, res: any) => {
  const userId = req.params.userId;
  const period = req.query.period || "week";
  try {
    const growth = await getRevenueGrowthService(userId, period);
    return success(res, { growth }, "Revenue growth fetched successfully");
  } catch (err) {
    console.error("Error fetching revenue growth:", err);
    return error(res, "Failed to fetch revenue growth", 500);
  }
};

export const getTotalOrdersForPeriodController = async (req: any, res: any) => {
  const userId = req.params.userId;
  const period = req.query.period || "week";
  try {
    const totalOrders = await getTotalOrdersForPeriodService(userId, period);
    return success(res, { totalOrders }, "Total orders for period fetched successfully");
  } catch (err) {
    console.error("Error fetching total orders for period:", err);
    return error(res, "Failed to fetch total orders for period", 500);
  }
};

export const getTotalRevenueForPeriodController = async (req: any, res: any) => {
  const userId = req.params.userId;
  const period = req.query.period || "week";
  console.log("Controller - getTotalRevenueForPeriod called:", userId, period);
  try {
    const totalRevenue = await getTotalRevenueForPeriodService(userId, period);
    return success(res, { totalRevenue }, "Total revenue for period fetched successfully");
  } catch (err) {
    console.error("Error fetching total revenue for period:", err);
    return error(res, "Failed to fetch total revenue for period", 500);
  }
};
