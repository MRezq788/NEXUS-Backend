import { Router } from "express";
import {
  getMostSoldProductsController,
  getUserBoughtTotalController,
  getUserOwnedSitesController,
  getUserSoldTotalController,
  getUserSoldTotalForSpecificDayController,
  getTopCashiersController,
} from "./user.controller";

const router = Router();

router.get("/sold-total/:userId", getUserSoldTotalController);
router.get("/bought-total/:userId", getUserBoughtTotalController);
router.get("/owned-sites/:userId", getUserOwnedSitesController);
router.get("/most-sold-products/:userId", getMostSoldProductsController);
router.get(
  "/sold-total/:userId/specific-day",
  getUserSoldTotalForSpecificDayController,
);
router.get("/most-selling-cashiers/:userId", getTopCashiersController);

export default router;
