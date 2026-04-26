import { Router } from 'express';
import { verifyToken } from '../../core/middleware/auth.middleware';
import { createProductController, getProductsController, getInventoryStatsController } from './product.controller';

export const addProductRouter = Router();
addProductRouter.post('/', verifyToken, createProductController);

export const shopProductsRouter = Router();
shopProductsRouter.get('/', verifyToken, getProductsController);
shopProductsRouter.get('/summary', verifyToken, getInventoryStatsController);