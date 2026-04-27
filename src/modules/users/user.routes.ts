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
  getCurrentUserProfileController,
  createCashierController,
  getUserProfileController,
  getCashiersController,
  allocateInventoryToCashierController,
  returnInventoryFromCashierController,
  getAllocationHistoryController,
  createCashierPosSaleController,
  createBusinessOwnerStoreController,
  updateStoreAiAssistantController,
  listBusinessOwnerStoresController,
  listOwnerProductsForStoreAllocationController,
  listStoreAllocatedProductsController,
  allocateProductToStoreController,
} from "./user.controller";
import { verifyToken } from "../../core/middleware/auth.middleware";

const router = Router();

router.get("/profile", verifyToken, getCurrentUserProfileController);

router.get("/sold-total/:userId", verifyToken, getUserSoldTotalController);
router.get("/bought-total/:userId", verifyToken, getUserBoughtTotalController);
router.get("/owned-sites/:userId", verifyToken, getUserOwnedSitesController);
router.get(
  "/most-sold-products/:userId",
  verifyToken,
  getMostSoldProductsController,
);
router.get(
  "/sold-total/:userId/specific-day",
  verifyToken,
  getUserSoldTotalForSpecificDayController,
);
router.get(
  "/most-selling-cashiers/:userId",
  verifyToken,
  getTopCashiersController,
);
router.get("/revenue/:userId", verifyToken, getUserRevenueController);
router.get("/total-orders/:userId", verifyToken, getTotalOrdersController);
router.get("/recent-orders/:userId", verifyToken, getRecentOrdersController);
router.get("/revenue-growth/:userId", verifyToken, getRevenueGrowthController);
router.get(
  "/total-orders-period/:userId",
  verifyToken,
  getTotalOrdersForPeriodController,
);
router.get(
  "/total-revenue-period/:userId",
  verifyToken,
  getTotalRevenueForPeriodController,
);

// POST /api/users/sync
// Frontend calls this right after Firebase Client SDK signup
router.post("/sync", verifyToken, syncUser);

// POST /api/users/cashiers
// Business owners can create cashier accounts
router.post("/cashiers", verifyToken, createCashierController);

// POST /api/users/cashiers/allocate-inventory
// Business owners can allocate product variants to their own cashiers
router.post(
  "/cashiers/allocate-inventory",
  verifyToken,
  allocateInventoryToCashierController,
);

router.post(
  "/cashiers/return-inventory",
  verifyToken,
  returnInventoryFromCashierController,
);

router.get(
  "/allocations/history",
  verifyToken,
  getAllocationHistoryController,
);

// POST /api/users/cashiers/pos-sales
// Cashiers can register a sale during checkout, deducting stock accordingly
router.post(
  "/cashiers/pos-sales",
  verifyToken,
  createCashierPosSaleController,
);

// GET /api/users/cashiers
// Business owners can view all cashiers they created
router.get("/cashiers", verifyToken, getCashiersController);

router.get("/stores", verifyToken, listBusinessOwnerStoresController);
router.post("/stores", verifyToken, createBusinessOwnerStoreController);
router.patch("/stores/:siteName/ai-assistant", verifyToken, updateStoreAiAssistantController);
router.get("/stores/products", verifyToken, listOwnerProductsForStoreAllocationController);
router.get("/stores/:siteName/allocated-products", verifyToken, listStoreAllocatedProductsController);
router.post("/stores/allocate-product", verifyToken, allocateProductToStoreController);

// GET /api/users/profile
// Get current authenticated user's profile
router.get("/profile", verifyToken, getUserProfileController);

export default router;
