import { Request, Response } from "express";
import { successResponse, errorResponse } from "../../core/utils/response";
import {
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
  syncNewUser,
  getCurrentUserProfileService,
} from "./user.service";

export const getUserSoldTotalController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.params.userId as string;
  try {
    const totalSold = await getUserSoldTotal(userId);
    return successResponse(
      res,
      { totalSold },
      "User sold total fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user sold total:", err);
    return errorResponse(res, "Failed to fetch user sold total", 500);
  }
};

export const getUserBoughtTotalController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.params.userId as string;
  try {
    const totalBought = await getUserBoughtTotal(userId);
    return successResponse(
      res,
      { totalBought },
      "User bought total fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user bought total:", err);
    return errorResponse(res, "Failed to fetch user bought total", 500);
  }
};

export const getUserOwnedSitesController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.params.userId as string;
  try {
    const isUserOwner = (await getUserRole(userId)) === "business_owner";
    if (!isUserOwner) {
      return errorResponse(res, "User is not a business owner", 403);
    }
    const ownedSites = await getUserOwnedSites(userId);
    return successResponse(
      res,
      { ownedSites, isUserOwner },
      "User owned sites fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user owned sites:", err);
    return errorResponse(res, "Failed to fetch user owned sites", 500);
  }
};

export const getUserSoldTotalForSpecificDayController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.params.userId as string;
  const date = new Date(req.query.date as string);
  try {
    const totalSold = await getUserSoldTotalForSpecificDayService(userId, date);
    return successResponse(
      res,
      { totalSold },
      "User sold total for specific day fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user sold total for specific day:", err);
    return errorResponse(
      res,
      "Failed to fetch user sold total for specific day",
      500,
    );
  }
};

export const getMostSoldProductsController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.params.userId as string;
  const range = parseInt(req.query.range as string) || 5;
  try {
    const mostSoldProducts = await getMostSoldProduct(userId, range);
    return successResponse(
      res,
      { mostSoldProducts },
      "User's most sold products fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user's most sold products:", err);
    return errorResponse(res, "Failed to fetch user's most sold products", 500);
  }
};

export const getTopCashiersController = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const range = parseInt(req.query.range as string) || 5;
  try {
    const topCashiers = await getMostSellingCashiers(userId, range);
    return successResponse(
      res,
      { topCashiers },
      "User's top cashiers fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user's top cashiers:", err);
    return errorResponse(res, "Failed to fetch user's top cashiers", 500);
  }
};

export const getUserRevenueController = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const period = (req.query.period as string) || "week";

  try {
    const data = await getUserRevenueData(userId, period);
    return successResponse(res, { data }, "User revenue fetched successfully");
  } catch (err) {
    console.error("Error fetching user revenue:", err);
    return errorResponse(res, "Failed to fetch user revenue", 500);
  }
};

export const getTotalOrdersController = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  try {
    const totalOrders = await getTotalOrdersService(userId);
    return successResponse(
      res,
      { totalOrders },
      "Total orders fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching total orders:", err);
    return errorResponse(res, "Failed to fetch total orders", 500);
  }
};

export const getRecentOrdersController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.params.userId as string;
  const limit = parseInt(req.query.limit as string) || 10;
  try {
    const recentOrders = await getRecentOrdersService(userId, limit);
    return successResponse(
      res,
      { recentOrders },
      "Recent orders fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching recent orders:", err);
    return errorResponse(res, "Failed to fetch recent orders", 500);
  }
};

export const getRevenueGrowthController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.params.userId as string;
  const period = (req.query.period as string) || "week";
  try {
    const growth = await getRevenueGrowthService(userId, period);
    return successResponse(
      res,
      { growth },
      "Revenue growth fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching revenue growth:", err);
    return errorResponse(res, "Failed to fetch revenue growth", 500);
  }
};

export const getTotalOrdersForPeriodController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.params.userId as string;
  const period = (req.query.period as string) || "week";
  try {
    const totalOrders = await getTotalOrdersForPeriodService(userId, period);
    return successResponse(
      res,
      { totalOrders },
      "Total orders for period fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching total orders for period:", err);
    return errorResponse(res, "Failed to fetch total orders for period", 500);
  }
};

export const getTotalRevenueForPeriodController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.params.userId as string;
  const period = (req.query.period as string) || "week";
  console.log("Controller - getTotalRevenueForPeriod called:", userId, period);
  try {
    const totalRevenue = await getTotalRevenueForPeriodService(userId, period);
    return successResponse(
      res,
      { totalRevenue },
      "Total revenue for period fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching total revenue for period:", err);
    return errorResponse(res, "Failed to fetch total revenue for period", 500);
  }
};

export const syncUser = async (
  req: Request | any,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, role } = req.body;

    // 1. Basic HTTP Input Validation
    if (!name || !email || !role) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: name, email, or role.",
      });
      return;
    }

    // 2. Security Validation: Ensure the authenticated token matches the email they are trying to register
    if (req.user?.email !== email) {
      res.status(403).json({
        success: false,
        message:
          "Forbidden: Token email does not match the requested sync email.",
      });
      return;
    }

    // 3. Call the Service (Business Logic)
    const result = await syncNewUser({ name, email, role });

    // 4. Return HTTP Response
    res.status(201).json({
      success: true,
      message: "User synced successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Error in syncUser controller:", error);

    // Catch business logic errors from the service
    if (error.message.includes("Business Logic Error")) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getCurrentUserProfileController = async (
  req: Request | any,
  res: Response,
) => {
  try {
    const email = req.user?.email as string | undefined;

    if (!email) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const profile = await getCurrentUserProfileService(email);

    if (!profile) {
      return errorResponse(res, "User profile not found", 404);
    }

    return successResponse(
      res,
      {
        email: profile.email,
        name: profile.name || "User",
        role: profile.role || "app_User",
        profileImageUrl: profile.profileImageUrl,
      },
      "User profile fetched successfully",
    );
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return errorResponse(res, "Failed to fetch user profile", 500);
  }
};
