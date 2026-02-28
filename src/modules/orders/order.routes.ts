import { Router } from 'express';
import { orderController } from './order.controller';

const router = Router();

// Stats and batch routes first
router.get('/stats', orderController.getStats);
router.delete('/batch', orderController.deleteBatch);

// Custom action routes
router.post('/:id/accept', orderController.acceptOrder);
router.post('/:id/reject', orderController.rejectOrder);
router.post('/:id/cancel', orderController.cancelOrder);

// Then standard CRUD routes
router.get('/', orderController.getOrders);
router.post('/', orderController.createOrder);
router.get('/:id', orderController.getOrderById);
router.put('/:id', orderController.updateOrder);
router.patch('/:id/status', orderController.updateOrderStatus);
router.delete('/:id', orderController.deleteOrder);

export default router;