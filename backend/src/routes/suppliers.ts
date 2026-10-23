import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import * as productService from '../services/productService.js';
import type { Role } from '../utils/permissions.js';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    res.json({
      data: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        productCount: s._count.products,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        products: {
          include: {
            category: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!supplier) throw new AppError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');
    const role = req.user!.role as Role;
    res.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        products: supplier.products.map((p) => productService.serializeProduct(p, role)),
      },
    });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
});

router.post('/', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const existing = await prisma.supplier.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError(409, 'Supplier already exists', 'SUPPLIER_EXISTS');
    const supplier = await prisma.supplier.create({
      data: {
        name: data.name,
        phone: data.phone ?? null,
        email: data.email || null,
        address: data.address ?? null,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SUPPLIER_CREATED',
        entityType: 'Supplier',
        entityId: supplier.id,
        metadata: JSON.stringify({ name: supplier.name }),
      },
    });
    res.status(201).json({ supplier });
  } catch (err) {
    next(err);
  }
});

export default router;
