import express from 'express';
import { createOrdersController, createSingleOrderController } from './order.controller';

const router = express.Router();

router.post('/bulk', createOrdersController);
router.post('/', createSingleOrderController);

export default router;