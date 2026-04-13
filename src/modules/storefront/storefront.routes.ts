import { Router } from "express";
import {
  createOrderController,
  createPageController,
  deletePageController,
  getHomepageController,
  getOrdersController,
  getPageBySlugController,
  getProductController,
  getSiteUserController,
  listPagesController,
  listProductsController,
  loginController,
  signupController,
  updateAddressesController,
  updateCartController,
  updatePageController,
  updateWishlistController,
} from "./storefront.controller";

const router = Router();

router.get("/sites/:siteName/pages", listPagesController);
router.post("/sites/:siteName/pages", createPageController);
router.patch("/sites/:siteName/pages/:pageId", updatePageController);
router.delete("/sites/:siteName/pages/:pageId", deletePageController);

router.get("/sites/:siteName/pages/home", getHomepageController);
router.get("/sites/:siteName/pages/slug/:pageSlug", getPageBySlugController);

router.get("/sites/:siteName/products", listProductsController);
router.get("/sites/:siteName/products/:productId", getProductController);

router.post("/auth/signup", signupController);
router.post("/auth/login", loginController);
router.get("/site-users/:siteName/:email", getSiteUserController);
router.put("/site-users/:siteName/:email/cart", updateCartController);
router.put("/site-users/:siteName/:email/wishlist", updateWishlistController);
router.put("/site-users/:siteName/:email/addresses", updateAddressesController);

router.post("/sites/:siteName/orders", createOrderController);
router.get("/sites/:siteName/orders/customer/:email", getOrdersController);

export default router;
