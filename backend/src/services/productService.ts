import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import { filterProductForRole, hasPermission, type Role } from '../utils/permissions.js';
import { paisaToPkr, pkrToPaisa } from '../utils/money.js';
import type { AuthUser } from '../middleware/auth.js';

export function serializeProduct(product: {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string;
  departmentId: string;
  supplierId: string | null;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  reorderLevel: number;
  unit: string;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
}, role: Role) {
  const stockStatus =
    product.currentStock <= 0
      ? 'OUT_OF_STOCK'
      : product.currentStock <= product.reorderLevel
        ? 'LOW_STOCK'
        : 'IN_STOCK';

  const base: Record<string, unknown> = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    departmentId: product.departmentId,
    supplierId: product.supplierId,
    sellingPrice: paisaToPkr(product.sellingPrice),
    sellingPricePaisa: product.sellingPrice,
    currentStock: product.currentStock,
    reorderLevel: product.reorderLevel,
    unit: product.unit,
    stockStatus,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    category: product.category ?? undefined,
    department: product.department ?? undefined,
    supplier: product.supplier ?? undefined,
  };

  if (hasPermission(role, 'VIEW_COST')) {
    base.costPrice = paisaToPkr(product.costPrice);
    base.costPricePaisa = product.costPrice;
    base.inventoryValue = paisaToPkr(product.costPrice * product.currentStock);
  }

  return filterProductForRole(base, role);
}

export async function listProducts(
  role: Role,
  opts: {
    search?: string;
    departmentId?: string;
    categoryId?: string;
    stockStatus?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  let products;
  let total: number;

  if (opts.stockStatus === 'LOW_STOCK') {
    const all = await prisma.product.findMany({
      where: {
        ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.search
          ? { OR: [{ name: { contains: opts.search } }, { sku: { contains: opts.search } }] }
          : {}),
        currentStock: { gt: 0 },
      },
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    const filtered = all.filter((p) => p.currentStock <= p.reorderLevel);
    total = filtered.length;
    products = filtered.slice((page - 1) * limit, page * limit);
  } else if (opts.stockStatus === 'IN_STOCK') {
    const all = await prisma.product.findMany({
      where: {
        ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.search
          ? { OR: [{ name: { contains: opts.search } }, { sku: { contains: opts.search } }] }
          : {}),
        currentStock: { gt: 0 },
      },
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    const filtered = all.filter((p) => p.currentStock > p.reorderLevel);
    total = filtered.length;
    products = filtered.slice((page - 1) * limit, page * limit);
  } else {
    const whereClause: Record<string, unknown> = {};
    if (opts.departmentId) whereClause.departmentId = opts.departmentId;
    if (opts.categoryId) whereClause.categoryId = opts.categoryId;
    if (opts.search) {
      whereClause.OR = [
        { name: { contains: opts.search } },
        { sku: { contains: opts.search } },
      ];
    }
    if (opts.stockStatus === 'OUT_OF_STOCK') {
      whereClause.currentStock = { lte: 0 };
    }

    total = await prisma.product.count({ where: whereClause });
    products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  return {
    data: products.map((p) => serializeProduct(p, role)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProduct(id: string, role: Role) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  });
  if (!product) throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  return serializeProduct(product, role);
}

export async function createProduct(
  user: AuthUser,
  data: {
    sku: string;
    name: string;
    description?: string;
    categoryId: string;
    departmentId: string;
    supplierId?: string;
    costPrice: number;
    sellingPrice: number;
    currentStock?: number;
    reorderLevel?: number;
    unit?: string;
  }
) {
  if (user.role !== 'MANAGER') {
    throw new AppError(403, 'Only managers can create products', 'FORBIDDEN');
  }

  const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (existing) throw new AppError(409, 'SKU already exists', 'SKU_EXISTS');

  const product = await prisma.product.create({
    data: {
      sku: data.sku,
      name: data.name,
      description: data.description ?? null,
      categoryId: data.categoryId,
      departmentId: data.departmentId,
      supplierId: data.supplierId ?? null,
      costPrice: pkrToPaisa(data.costPrice),
      sellingPrice: pkrToPaisa(data.sellingPrice),
      currentStock: data.currentStock ?? 0,
      reorderLevel: data.reorderLevel ?? 10,
      unit: data.unit ?? 'pcs',
    },
    include: {
      category: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product.id,
      metadata: JSON.stringify({ sku: product.sku, name: product.name }),
    },
  });

  return serializeProduct(product, user.role);
}

export async function updateProduct(
  user: AuthUser,
  id: string,
  data: Partial<{
    name: string;
    description: string;
    categoryId: string;
    departmentId: string;
    supplierId: string | null;
    costPrice: number;
    sellingPrice: number;
    reorderLevel: number;
    unit: string;
  }>
) {
  if (user.role !== 'MANAGER') {
    throw new AppError(403, 'Only managers can update products', 'FORBIDDEN');
  }

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND');

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
  if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
  if (data.reorderLevel !== undefined) updateData.reorderLevel = data.reorderLevel;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.costPrice !== undefined) updateData.costPrice = pkrToPaisa(data.costPrice);
  if (data.sellingPrice !== undefined) updateData.sellingPrice = pkrToPaisa(data.sellingPrice);

  const product = await prisma.product.update({
    where: { id },
    data: updateData,
    include: {
      category: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: product.id,
      metadata: JSON.stringify(data),
    },
  });

  return serializeProduct(product, user.role);
}
