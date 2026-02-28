import { Router } from 'express';
import { productController } from './product.controller';

const router = Router();

// IMPORTANT: Specific routes MUST come before parameterized routes
// POST and batch routes first
router.post('/', productController.createProduct);
router.post('/batch-upload', productController.batchCreateProducts);
router.delete('/batch', productController.deleteBatch);

// Then parameterized routes
router.get('/stats', productController.getStats);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

export default router;