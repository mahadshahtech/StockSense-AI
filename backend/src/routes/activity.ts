import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const isManager = req.user!.role === 'MANAGER';

    const where = isManager ? {} : { userId: req.user!.id };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    res.json({
      data: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        metadata: l.metadata ? JSON.parse(l.metadata) : null,
        createdAt: l.createdAt,
        user: l.user,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/staff', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { user: { role: 'STAFF' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({ data: logs });
  } catch (err) {
    next(err);
  }
});

export default router;
