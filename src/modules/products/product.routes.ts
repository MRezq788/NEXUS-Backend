import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verifyToken } from "../../core/middleware/auth.middleware";
import {
  createProductController,
  getSingleProductController,
  updateProductController,
  getProductsController,
  getInventoryStatsController,
  getRecommendationsController,
} from "./product.controller";

export const addProductRouter = Router();
addProductRouter.post("/", verifyToken, createProductController);
addProductRouter.get("/:id", verifyToken, getSingleProductController);
addProductRouter.put("/:id", verifyToken, updateProductController);

export const shopProductsRouter = Router();
shopProductsRouter.get("/", verifyToken, getProductsController);
shopProductsRouter.get(
  "/summary",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  verifyToken,
  getInventoryStatsController,
);
shopProductsRouter.get(
  "/recommendations",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  verifyToken,
  getRecommendationsController,
);
