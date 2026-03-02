import { Router } from 'express';
import { getProduct } from './warehouseProduct.controller';

const router = Router();

router.get('/', getProduct);

export default router;
