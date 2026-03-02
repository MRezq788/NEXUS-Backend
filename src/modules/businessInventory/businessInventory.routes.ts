import { Router } from 'express';
import { getBusinessInventory, getProductsCount } from './businessInventory.controller';

const router = Router();

router.get('/', getBusinessInventory);
router.get('/count', getProductsCount);

export default router;
