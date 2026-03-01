import express, { Application } from "express";
import cors from "cors";

const app: Application = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import userRoutes from "./modules/users/user.routes";
import warehouseRoutes from "./modules/warehouses/warehouse.routes";
import productRoutes from "./modules/products/product.routes";
import inventoryRoutes from "./modules/warehouseInventory/inventory.routes";
import businessInventoryRoutes from "./modules/businessInventory/businessInventory.routes";
import orderRoutes from "./modules/orders/order.routes";
import posRoutes from "./modules/pos/pos.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import uploadRoutes from "./modules/uploads/upload.routes";
import reportRoutes from "./modules/reports/report.routes";

app.use("/api/users", userRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/business-inventory", businessInventoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/pos", posRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/reports", reportRoutes);

app.get("/health", (req, res) => {
  console.log("wow");

  res.json({ status: "ok" });
});

export default app;
