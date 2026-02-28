import { Router } from 'express';
import { trackShipment, getHsCodes } from '../controllers/public.controller';

const router = Router();

router.get('/track/:awb', trackShipment);
router.get('/hs-codes', getHsCodes);

export default router;
