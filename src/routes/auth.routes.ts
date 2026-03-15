import { Router } from 'express';
import { login, verifyOwnerPassword } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/verify-owner', authenticateToken, verifyOwnerPassword);

export default router;
