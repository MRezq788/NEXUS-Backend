import { Router } from "express";
import {
  getMostSoldProductsController,
  getUserBoughtTotalController,
  getUserOwnedSitesController,
  getUserSoldTotalController,
  getUserSoldTotalForSpecificDayController,
  getTopCashiersController,
  getUserRevenueController,
  getTotalOrdersController,
  getRecentOrdersController,
  getRevenueGrowthController,
  getTotalOrdersForPeriodController,
  getTotalRevenueForPeriodController,
  syncUser,
  createCashierController,
  getUserProfileController,
  getCashiersController
} from "./user.controller";
import { verifyToken } from "../../core/middleware/auth.middleware";

const router = Router();

router.get("/sold-total/:userId", verifyToken, getUserSoldTotalController);
router.get("/bought-total/:userId", verifyToken, getUserBoughtTotalController);
router.get("/owned-sites/:userId", verifyToken, getUserOwnedSitesController);
router.get(
  "/most-sold-products/:userId",
  verifyToken,
  getMostSoldProductsController
);
router.get(
  "/sold-total/:userId/specific-day",
  verifyToken,
  getUserSoldTotalForSpecificDayController
);
router.get(
  "/most-selling-cashiers/:userId",
  verifyToken,
  getTopCashiersController
);
router.get("/revenue/:userId", verifyToken, getUserRevenueController);
router.get("/total-orders/:userId", verifyToken, getTotalOrdersController);
router.get("/recent-orders/:userId", verifyToken, getRecentOrdersController);
router.get("/revenue-growth/:userId", verifyToken, getRevenueGrowthController);
router.get(
  "/total-orders-period/:userId",
  verifyToken,
  getTotalOrdersForPeriodController
);
router.get(
  "/total-revenue-period/:userId",
  verifyToken,
  getTotalRevenueForPeriodController
);

// POST /api/users/sync
// Frontend calls this right after Firebase Client SDK signup
router.post('/sync', verifyToken, syncUser);

// POST /api/users/cashiers
// Business owners can create cashier accounts
router.post('/cashiers', verifyToken, createCashierController);

// GET /api/users/cashiers
// Business owners can view all cashiers they created
router.get('/cashiers', verifyToken, getCashiersController);

// GET /api/users/profile
// Get current authenticated user's profile
router.get('/profile', verifyToken, getUserProfileController);

export default router;