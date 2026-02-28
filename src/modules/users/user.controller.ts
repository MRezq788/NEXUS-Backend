const { getUserSoldTotal } = require("./user.service");
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
