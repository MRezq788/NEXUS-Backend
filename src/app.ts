import express, { Application } from "express";
import cors from "cors";
import { extractUserEmail } from "./modules/warehouseProducts/warehouse.product.controller";


const app: Application = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(extractUserEmail); // extracts email from all requests and adds it to req.userEmail

// Import routes
import userRoutes from "./modules/users/user.routes";
import warehouseRoutes from "./modules/warehouses/warehouse.routes";
import productRoutes from "./modules/warehouseProducts/warehouse.product.routes";
import inventoryRoutes from "./modules/warehouseInventory/inventory.routes";
import businessInventoryRoutes from "./modules/businessInventory/businessInventory.routes";
import orderRoutes from "./modules/warehouseOrders/warehouse.order.routes";
import warehouseShopOrderRoutes from "./modules/orders/order.routes";
import posRoutes from "./modules/pos/pos.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import uploadRoutes from "./modules/uploads/upload.routes";
import reportRoutes from "./modules/reports/report.routes";
import warehouseProductRoutes from "./modules/WarehouseShopProducts/warehouseProduct.routes";
import { addProductRouter, shopProductsRouter } from "./modules/products/product.routes";
import storefrontRoutes from "./modules/storefront/storefront.routes";

// Use routes
app.use("/api/users", userRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/products", productRoutes);
app.use("/api/warehouse-products", warehouseProductRoutes); // from inventory branch
app.use("/api/inventory", inventoryRoutes);
app.use("/api/business-inventory", businessInventoryRoutes);
app.use("/api/warehouse-shop/orders", warehouseShopOrderRoutes); // from inventory branch
app.use("/api/orders", orderRoutes); // from main branch
app.use("/api/pos", posRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/add-product", addProductRouter);
app.use("/api/shop-products", shopProductsRouter);
app.use("/api/storefront", storefrontRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
