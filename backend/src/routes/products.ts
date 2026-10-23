import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as productService from '../services/productService.js';
import { prisma } from '../db/prisma.js';
import type { Role } from '../utils/permissions.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const result = await productService.listProducts(req.user!.role as Role, {
      search: req.query.search as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      stockStatus: req.query.stockStatus as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const product = await productService.getProduct(id, req.user!.role as Role);
    const movements = await prisma.stockMovement.findMany({
      where: { productId: id },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });
    res.json({ product, movements });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().min(1),
  departmentId: z.string().min(1),
  supplierId: z.string().optional(),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  currentStock: z.number().int().nonnegative().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  unit: z.string().optional(),
});

router.post('/', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const product = await productService.createProduct(req.user!, data);
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  departmentId: z.string().optional(),
  supplierId: z.string().nullable().optional(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  unit: z.string().optional(),
});

router.patch('/:id', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const product = await productService.updateProduct(req.user!, String(req.params.id), data);
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

export default router;
