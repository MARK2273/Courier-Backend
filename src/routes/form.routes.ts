import { Router } from 'express';
import { createShipment, getMyShipments, getShipmentById, deleteShipment, updateShipment, getUpiConfigs } from '../controllers/form.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Protect all routes
router.use(authenticateToken);

router.post('/create', createShipment);
router.get('/upi-configs', getUpiConfigs);
router.get('/mydata', getMyShipments);
router.get('/:id', getShipmentById);
router.put('/:id', updateShipment);
router.delete('/:id', deleteShipment);

export default router;
