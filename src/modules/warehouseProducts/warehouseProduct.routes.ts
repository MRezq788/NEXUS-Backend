import { Router } from 'express';
import { getProduct } from './warehouseproduct.controller';

const router = Router();

router.get('/', getProduct);

export default router;
