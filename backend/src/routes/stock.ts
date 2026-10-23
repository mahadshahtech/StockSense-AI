import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { applyStockChange, confirmProposal, cancelProposal } from '../services/stockService.js';
import { prisma } from '../db/prisma.js';
import { hasPermission, type Role } from '../utils/permissions.js';
import { paisaToPkr } from '../utils/money.js';

const router = Router();
router.use(authenticate);

const changeSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(['STOCK_IN', 'STOCK_OUT', 'SALE', 'DAMAGED', 'ADJUSTMENT']),
  quantity: z.number().int().positive().optional(),
  reason: z.string().optional(),
  supplierId: z.string().optional().nullable(),
  newStockLevel: z.number().int().nonnegative().optional(),
});

router.post('/change', async (req, res, next) => {
  try {
    const data = changeSchema.parse(req.body);
    if (data.type !== 'ADJUSTMENT' && !data.quantity) {
      res.status(400).json({ error: 'Quantity is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const result = await applyStockChange(req.user!, {
      productId: data.productId,
      type: data.type,
      quantity: data.quantity ?? 0,
      reason: data.reason,
      supplierId: data.supplierId,
      newStockLevel: data.newStockLevel,
      source: 'FORM',
    });
    res.json({
      product: {
        id: result.product.id,
        name: result.product.name,
        currentStock: result.product.currentStock,
      },
      movement: result.movement,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/movements', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const where: Record<string, unknown> = {};
    if (req.query.productId) where.productId = String(req.query.productId);
    if (req.query.type) where.type = String(req.query.type);

    const [total, movements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          user: { select: { id: true, name: true, email: true } },
          supplier: { select: { id: true, name: true } },
        },
      }),
    ]);

    const role = req.user!.role as Role;
    const data = movements.map((m) => {
      const row: Record<string, unknown> = {
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        previousStock: m.previousStock,
        newStock: m.newStock,
        reason: m.reason,
        source: m.source,
        createdAt: m.createdAt,
        product: m.product,
        user: m.user,
        supplier: m.supplier,
      };
      if (hasPermission(role, 'VIEW_COST') && m.unitCost != null) {
        row.unitCost = paisaToPkr(m.unitCost);
      }
      if (m.unitPrice != null) {
        row.unitPrice = paisaToPkr(m.unitPrice);
      }
      return row;
    });

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/proposals/:id/confirm', async (req, res, next) => {
  try {
    const result = await confirmProposal(req.user!, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/proposals/:id/cancel', async (req, res, next) => {
  try {
    const proposal = await cancelProposal(req.user!, req.params.id);
    res.json({ proposal });
  } catch (err) {
    next(err);
  }
});

router.get('/proposals/:id', async (req, res, next) => {
  try {
    const proposal = await prisma.aIActionProposal.findUnique({
      where: { id: req.params.id },
      include: {
        product: { select: { id: true, name: true, sku: true, currentStock: true } },
        supplier: { select: { id: true, name: true } },
      },
    });
    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found', code: 'PROPOSAL_NOT_FOUND' });
      return;
    }
    if (proposal.userId !== req.user!.id && req.user!.role !== 'MANAGER') {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }
    res.json({ proposal });
  } catch (err) {
    next(err);
  }
});

export default router;
