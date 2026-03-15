import { Router } from 'express';
import { trackShipment, getHsCodes, viewShipmentPdf } from '../controllers/public.controller';

const router = Router();

router.get('/track/:awb', trackShipment);
router.get('/hs-codes', getHsCodes);
router.get('/shipment-pdf/:id', viewShipmentPdf);

export default router;
