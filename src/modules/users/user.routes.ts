import { Router } from 'express';
import { verifyAuthToken } from '../../core/middleware/auth.middleware';
import * as userController from './user.controller';

const router = Router();

// POST /api/users/sync
// Frontend calls this right after Firebase Client SDK signup
router.post('/sync', verifyAuthToken, userController.syncUser);

export default router;