import express, { Application } from 'express';
import cors from 'cors';
import { extractUserEmail } from './modules/products/product.controller'; // Import middleware

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(extractUserEmail); // extracts email from all requests and adds it to req.userEmail

// Import routes
import userRoutes from './modules/users/user.routes';
import warehouseRoutes from './modules/warehouses/warehouse.routes';
import productRoutes from './modules/products/product.routes';
import inventoryRoutes from './modules/warehouseInventory/inventory.routes';
import businessInventoryRoutes from './modules/businessInventory/businessInventory.routes';
import orderRoutes from './modules/orders/order.routes';
import posRoutes from './modules/pos/pos.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import uploadRoutes from './modules/uploads/upload.routes';
import reportRoutes from './modules/reports/report.routes';

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/business-inventory', businessInventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;