import { Router } from "express";
import {
  getMostSoldProductsController,
  getUserBoughtTotalController,
  getUserOwnedSitesController,
  getUserSoldTotalController,
  getUserSoldTotalForSpecificDayController,
  getTopCashiersController,
  getUserRevenueController,
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

export default router;
