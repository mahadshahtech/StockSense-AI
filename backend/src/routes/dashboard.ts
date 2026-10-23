import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getDashboard } from '../services/dashboardService.js';
import type { Role } from '../utils/permissions.js';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const data = await getDashboard(req.user!.role as Role);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
