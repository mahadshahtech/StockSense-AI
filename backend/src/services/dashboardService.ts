import { prisma } from '../db/prisma.js';
import { hasPermission, type Role } from '../utils/permissions.js';
import { paisaToPkr } from '../utils/money.js';

function startOfWeek(d = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun
  const diff = day === 0 ? 6 : day - 1; // Monday start
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diff);
  return date;
}

export async function getDashboard(role: Role) {
  const [
    totalProducts,
    stockAgg,
    allProducts,
    recentMovements,
    departments,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.aggregate({ _sum: { currentStock: true } }),
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        currentStock: true,
        reorderLevel: true,
        costPrice: true,
        sellingPrice: true,
        departmentId: true,
      },
    }),
    prisma.stockMovement.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.department.findMany({ select: { id: true, name: true } }),
  ]);

  const lowStock = allProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel);
  const outOfStock = allProducts.filter((p) => p.currentStock <= 0);

  const deptDistribution = departments.map((d) => ({
    departmentId: d.id,
    name: d.name,
    products: allProducts.filter((p) => p.departmentId === d.id).length,
    stockUnits: allProducts
      .filter((p) => p.departmentId === d.id)
      .reduce((s, p) => s + p.currentStock, 0),
  }));

  const weekStart = startOfWeek();
  const salesThisWeek = await prisma.stockMovement.findMany({
    where: { type: 'SALE', createdAt: { gte: weekStart } },
    include: { product: { select: { id: true, name: true, sku: true } } },
  });

  const soldMap = new Map<string, { productId: string; name: string; sku: string; quantity: number }>();
  for (const s of salesThisWeek) {
    const cur = soldMap.get(s.productId) ?? {
      productId: s.productId,
      name: s.product.name,
      sku: s.product.sku,
      quantity: 0,
    };
    cur.quantity += s.quantity;
    soldMap.set(s.productId, cur);
  }
  const topSelling = [...soldMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  // Movement trends last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const movements = await prisma.stockMovement.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { type: true, quantity: true, createdAt: true },
  });

  const trendMap = new Map<string, { date: string; in: number; out: number; sales: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(sevenDaysAgo.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, { date: key, in: 0, out: 0, sales: 0 });
  }
  for (const m of movements) {
    const key = m.createdAt.toISOString().slice(0, 10);
    const row = trendMap.get(key);
    if (!row) continue;
    if (m.type === 'STOCK_IN') row.in += m.quantity;
    else if (m.type === 'SALE') row.sales += m.quantity;
    else if (m.type === 'STOCK_OUT' || m.type === 'DAMAGED') row.out += m.quantity;
  }

  const result: Record<string, unknown> = {
    totalProducts,
    totalStockUnits: stockAgg._sum.currentStock ?? 0,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStockProducts: lowStock.slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      currentStock: p.currentStock,
      reorderLevel: p.reorderLevel,
    })),
    outOfStockProducts: outOfStock.slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      currentStock: p.currentStock,
    })),
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      previousStock: m.previousStock,
      newStock: m.newStock,
      createdAt: m.createdAt,
      product: m.product,
      user: m.user,
      source: m.source,
    })),
    departmentDistribution: deptDistribution,
    movementTrends: [...trendMap.values()],
    topSellingProducts: topSelling,
  };

  if (hasPermission(role, 'VIEW_VALUATION')) {
    const valuation = allProducts.reduce((s, p) => s + p.costPrice * p.currentStock, 0);
    result.inventoryValuation = paisaToPkr(valuation);
  }

  if (hasPermission(role, 'VIEW_PROFIT')) {
    const allSales = await prisma.stockMovement.findMany({
      where: { type: 'SALE', createdAt: { gte: weekStart } },
      select: { quantity: true, unitCost: true, unitPrice: true },
    });
    let revenue = 0;
    let cost = 0;
    for (const s of allSales) {
      revenue += (s.unitPrice ?? 0) * s.quantity;
      cost += (s.unitCost ?? 0) * s.quantity;
    }
    result.weeklyProfit = {
      revenue: paisaToPkr(revenue),
      cost: paisaToPkr(cost),
      profit: paisaToPkr(revenue - cost),
      unitsSold: allSales.reduce((s, x) => s + x.quantity, 0),
    };
  }

  return result;
}

export { startOfWeek };
