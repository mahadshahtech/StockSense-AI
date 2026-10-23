import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/departments', async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        categories: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
        _count: { select: { products: true } },
      },
    });
    res.json({
      data: departments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        productCount: d._count.products,
        categories: d.categories,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const where = req.query.departmentId
      ? { departmentId: String(req.query.departmentId) }
      : {};
    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { department: { select: { id: true, name: true } } },
    });
    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
});

export default router;
