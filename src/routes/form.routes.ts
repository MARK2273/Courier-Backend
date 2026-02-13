import { Router } from 'express';
import { createShipment, getMyShipments } from '../controllers/form.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Protect all routes
router.use(authenticateToken);

router.post('/create', createShipment);
router.get('/mydata', getMyShipments);

export default router;
