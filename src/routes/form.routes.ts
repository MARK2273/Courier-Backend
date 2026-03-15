import { Router } from 'express';
import { createShipment, getMyShipments, getShipmentById, deleteShipment, updateShipment, getUpiConfigs, uploadPdf } from '../controllers/form.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Protect all routes
router.use(authenticateToken);

router.post('/create', createShipment);
router.post('/upload-pdf/:id', upload.single('pdf'), uploadPdf);
router.get('/upi-configs', getUpiConfigs);
router.get('/mydata', getMyShipments);
router.get('/:id', getShipmentById);
router.put('/:id', updateShipment);
router.delete('/:id', deleteShipment);

export default router;
