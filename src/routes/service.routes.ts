import { Router } from 'express';
import { getServices } from '../controllers/service.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Protect all routes
router.use(authenticateToken);

router.get('/', getServices);

export default router;
