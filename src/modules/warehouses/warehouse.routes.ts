import { Router } from 'express';
import { getWarehouse } from './warehouse.controller';


const router = Router();

router.get('/', getWarehouse);

export default router;
