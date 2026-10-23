import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { hasPermission, type Role } from '../utils/permissions.js';
import { paisaToPkr } from '../utils/money.js';
import { startOfWeek } from '../services/dashboardService.js';

const router = Router();
router.use(authenticate);

router.get('/top-selling', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : startOfWeek();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const sales = await prisma.stockMovement.findMany({
      where: { type: 'SALE', createdAt: { gte: from, lte: to } },
      include: { product: { select: { id: true, name: true, sku: true, departmentId: true } } },
    });
    const map = new Map<string, { productId: string; name: string; sku: string; quantity: number }>();
    for (const s of sales) {
      const cur = map.get(s.productId) ?? {
        productId: s.productId,
        name: s.product.name,
        sku: s.product.sku,
        quantity: 0,
      };
      cur.quantity += s.quantity;
      map.set(s.productId, cur);
    }
    res.json({
      from,
      to,
      data: [...map.values()].sort((a, b) => b.quantity - a.quantity),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/low-stock', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { currentStock: { gt: 0 } },
      include: {
        department: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { currentStock: 'asc' },
    });
    res.json({
      data: products
        .filter((p) => p.currentStock <= p.reorderLevel)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          currentStock: p.currentStock,
          reorderLevel: p.reorderLevel,
          department: p.department.name,
          category: p.category.name,
        })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/out-of-stock', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { currentStock: { lte: 0 } },
      include: {
        department: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        currentStock: p.currentStock,
        department: p.department.name,
        category: p.category.name,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/department-inventory', async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        products: {
          select: { currentStock: true, costPrice: true, sellingPrice: true },
        },
      },
    });
    const role = _req.user!.role as Role;
    res.json({
      data: departments.map((d) => {
        const row: Record<string, unknown> = {
          id: d.id,
          name: d.name,
          productCount: d.products.length,
          stockUnits: d.products.reduce((s, p) => s + p.currentStock, 0),
        };
        if (hasPermission(role, 'VIEW_VALUATION')) {
          row.inventoryValue = paisaToPkr(
            d.products.reduce((s, p) => s + p.costPrice * p.currentStock, 0)
          );
        }
        return row;
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/sales-summary', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : startOfWeek();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const sales = await prisma.stockMovement.findMany({
      where: { type: 'SALE', createdAt: { gte: from, lte: to } },
    });
    const role = req.user!.role as Role;
    const result: Record<string, unknown> = {
      from,
      to,
      saleEvents: sales.length,
      unitsSold: sales.reduce((s, m) => s + m.quantity, 0),
    };
    if (hasPermission(role, 'VIEW_PROFIT')) {
      const revenue = sales.reduce((s, m) => s + (m.unitPrice ?? 0) * m.quantity, 0);
      const cost = sales.reduce((s, m) => s + (m.unitCost ?? 0) * m.quantity, 0);
      result.revenue = paisaToPkr(revenue);
      result.cost = paisaToPkr(cost);
      result.profit = paisaToPkr(revenue - cost);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/profit-summary', async (req, res, next) => {
  try {
    if (!hasPermission(req.user!.role as Role, 'VIEW_PROFIT')) {
      res.status(403).json({ error: 'Profit data is manager-only', code: 'FORBIDDEN' });
      return;
    }
    const from = req.query.from ? new Date(String(req.query.from)) : startOfWeek();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const sales = await prisma.stockMovement.findMany({
      where: { type: 'SALE', createdAt: { gte: from, lte: to } },
      include: { product: { select: { name: true, sku: true } } },
    });
    const revenue = sales.reduce((s, m) => s + (m.unitPrice ?? 0) * m.quantity, 0);
    const cost = sales.reduce((s, m) => s + (m.unitCost ?? 0) * m.quantity, 0);
    res.json({
      from,
      to,
      revenue: paisaToPkr(revenue),
      cost: paisaToPkr(cost),
      profit: paisaToPkr(revenue - cost),
      unitsSold: sales.reduce((s, m) => s + m.quantity, 0),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
