import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../../core/utils/response';
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
  createCashierService,
  getCashiersService
} from './user.service';

export const getUserSoldTotalController = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  try {
    const totalSold = await getUserSoldTotal(userId);
    return successResponse(res, { totalSold }, "User sold total fetched successfully");
  } catch (err) {
    console.error("Error fetching user sold total:", err);
    return errorResponse(res, "Failed to fetch user sold total", 500);
  }
};

export const getUserBoughtTotalController = async (req: Request, res: Response) => {
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

export const getUserOwnedSitesController = async (req: Request, res: Response) => {
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

export const getUserSoldTotalForSpecificDayController = async (req: Request, res: Response) => {
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
    return errorResponse(res, "Failed to fetch user sold total for specific day", 500);
  }
};

export const getMostSoldProductsController = async (req: Request, res: Response) => {
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
    return successResponse(res, { totalOrders }, "Total orders fetched successfully");
  } catch (err) {
    console.error("Error fetching total orders:", err);
    return errorResponse(res, "Failed to fetch total orders", 500);
  }
};

export const getRecentOrdersController = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const limit = parseInt(req.query.limit as string) || 10;
  try {
    const recentOrders = await getRecentOrdersService(userId, limit);
    return successResponse(res, { recentOrders }, "Recent orders fetched successfully");
  } catch (err) {
    console.error("Error fetching recent orders:", err);
    return errorResponse(res, "Failed to fetch recent orders", 500);
  }
};

export const getRevenueGrowthController = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const period = (req.query.period as string) || "week";
  try {
    const growth = await getRevenueGrowthService(userId, period);
    return successResponse(res, { growth }, "Revenue growth fetched successfully");
  } catch (err) {
    console.error("Error fetching revenue growth:", err);
    return errorResponse(res, "Failed to fetch revenue growth", 500);
  }
};

export const getTotalOrdersForPeriodController = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const period = (req.query.period as string) || "week";
  try {
    const totalOrders = await getTotalOrdersForPeriodService(userId, period);
    return successResponse(res, { totalOrders }, "Total orders for period fetched successfully");
  } catch (err) {
    console.error("Error fetching total orders for period:", err);
    return errorResponse(res, "Failed to fetch total orders for period", 500);
  }
};

export const getTotalRevenueForPeriodController = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const period = (req.query.period as string) || "week";
  console.log("Controller - getTotalRevenueForPeriod called:", userId, period);
  try {
    const totalRevenue = await getTotalRevenueForPeriodService(userId, period);
    return successResponse(res, { totalRevenue }, "Total revenue for period fetched successfully");
  } catch (err) {
    console.error("Error fetching total revenue for period:", err);
    return errorResponse(res, "Failed to fetch total revenue for period", 500);
  }
};

export const syncUser = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const { name, email, role } = req.body;

    // 1. Basic HTTP Input Validation
    if (!name || !email || !role) {
      res.status(400).json({ 
        success: false, 
        message: "Missing required fields: name, email, or role." 
      });
      return;
    }

    // 2. Security Validation: Ensure the authenticated token matches the email they are trying to register
    if (req.user?.email !== email) {
      res.status(403).json({ 
        success: false, 
        message: "Forbidden: Token email does not match the requested sync email." 
      });
      return;
    }

    // 3. Call the Service (Business Logic)
    const result = await syncNewUser({ name, email, role });

    // 4. Return HTTP Response
    res.status(201).json({ 
      success: true, 
      message: "User synced successfully",
      data: result 
    });

  } catch (error: any) {
    console.error("Error in syncUser controller:", error);
    
    // Catch business logic errors from the service
    if (error.message.includes('Business Logic Error')) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createCashierController = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // 1. Basic HTTP Input Validation
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: name, email, or password."
      });
      return;
    }

    // 2. Get the business owner ID from the authenticated user
    const businessOwnerId = req.user?.email;
    if (!businessOwnerId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No authenticated user found."
      });
      return;
    }

    // 3. Call the Service (Business Logic)
    const result = await createCashierService({
      name,
      email,
      password,
      businessOwnerId
    });

    // 4. Return HTTP Response
    res.status(201).json({
      success: true,
      message: "Cashier account created successfully",
      data: result
    });

  } catch (error: any) {
    console.error("Error in createCashier controller:", error);

    // Catch business logic errors from the service
    if (error.message.includes('Business Logic Error')) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    // Handle Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      res.status(400).json({ success: false, message: "Email already exists." });
      return;
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getUserProfileController = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No authenticated user found."
      });
      return;
    }

    // Import getUserData from service
    const { getUserData } = await import('./user.repository');
    const userData = await getUserData(userEmail);

    if (!userData || !userData.email) {
      res.status(404).json({
        success: false,
        message: "User profile not found."
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      data: userData
    });

  } catch (error: any) {
    console.error("Error in getUserProfile controller:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getCashiersController = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const businessOwnerId = req.user?.email;

    if (!businessOwnerId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No authenticated user found."
      });
      return;
    }

    // Call the Service
    const cashiers = await getCashiersService(businessOwnerId);

    res.status(200).json({
      success: true,
      message: "Cashiers fetched successfully",
      data: { cashiers }
    });

  } catch (error: any) {
    console.error("Error in getCashiers controller:", error);

    // Catch business logic errors from the service
    if (error.message.includes('Business Logic Error')) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};



