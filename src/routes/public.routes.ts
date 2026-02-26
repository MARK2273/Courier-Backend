import { Router } from 'express';
import { trackShipment } from '../controllers/public.controller';

const router = Router();

router.get('/track/:awb', trackShipment);

export default router;
