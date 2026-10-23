import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import { hasPermission, type Role } from '../utils/permissions.js';
import { formatPkr, paisaToPkr } from '../utils/money.js';
import { startOfWeek } from '../services/dashboardService.js';
import type { AuthUser } from '../middleware/auth.js';

export const TOOL_DEFINITIONS = [
  {
    name: 'search_products',
    description: 'Search products by name or SKU. Returns matching products with stock levels.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Product name or SKU search text' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_stock',
    description: 'Get current stock for a specific product by exact or partial name/SKU.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Product name or SKU' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_multiple_product_stocks',
    description: 'Get stock levels for multiple products at once.',
    parameters: {
      type: 'object',
      properties: {
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of product names or SKUs',
        },
      },
      required: ['queries'],
    },
  },
  {
    name: 'get_low_stock_products',
    description: 'List products at or below reorder level (but still > 0).',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_out_of_stock_products',
    description: 'List products with zero stock.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_top_selling_products',
    description: 'Get top-selling products based on SALE movements for this week (Monday–Sunday local).',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_stock_movements',
    description: 'Get recent stock movement history.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        productQuery: { type: 'string', description: 'Optional product filter' },
      },
    },
  },
  {
    name: 'get_inventory_summary',
    description: 'Get inventory summary: totals, low stock, out of stock. Valuation only for managers.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_sales_summary',
    description: 'Get sales summary for this week based on SALE movements.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_profit_summary',
    description: 'Get profit summary for this week. MANAGER ONLY.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'prepare_stock_in',
    description:
      'Prepare a pending stock-in proposal. Does NOT change stock until user confirms. Resolve product and optional supplier.',
    parameters: {
      type: 'object',
      properties: {
        productQuery: { type: 'string' },
        quantity: { type: 'number' },
        supplierQuery: { type: 'string', description: 'Supplier name e.n. Ali Traders' },
        reason: { type: 'string' },
      },
      required: ['productQuery', 'quantity'],
    },
  },
  {
    name: 'prepare_stock_out',
    description:
      'Prepare a pending stock-out, sale, or damaged proposal. Does NOT change stock until confirmed.',
    parameters: {
      type: 'object',
      properties: {
        productQuery: { type: 'string' },
        quantity: { type: 'number' },
        actionType: {
          type: 'string',
          enum: ['STOCK_OUT', 'SALE', 'DAMAGED'],
          description: 'Type of outbound movement',
        },
        reason: { type: 'string' },
      },
      required: ['productQuery', 'quantity', 'actionType'],
    },
  },
] as const;

export type ToolName = (typeof TOOL_DEFINITIONS)[number]['name'];

function normalizeProductQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\-./+]/g, ' ')
    .replace(/\b(bags?|pcs|pieces?|units?|items?|cartons?|bottles?|packs?|pairs?|sets?|kits?|rolls?|jars?|tubs?|dozens?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('ses') || token.endsWith('xes') || token.endsWith('zes') || token.endsWith('ches') || token.endsWith('shes')) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function queryVariants(query: string): string[] {
  const normalized = normalizeProductQuery(query);
  if (!normalized) return [];
  const variants = new Set<string>([normalized, query.trim()]);
  const tokens = normalized.split(' ').filter(Boolean);
  const singularTokens = tokens.map(singularizeToken);
  variants.add(singularTokens.join(' '));
  // Useful fragments: "type-c cable", "type c cable", "type-c"
  variants.add(singularTokens.join('-'));
  variants.add(normalized.replace(/-/g, ' '));
  variants.add(singularTokens.join(' ').replace(/-/g, ' '));
  if (singularTokens.length > 1) {
    variants.add(singularTokens.slice(-2).join(' '));
    variants.add(singularTokens[singularTokens.length - 1]);
  }
  return [...variants].filter((v) => v.length >= 2);
}

function scoreProductMatch(
  product: { name: string; sku: string },
  rawQuery: string
): number {
  const name = product.name.toLowerCase();
  const sku = product.sku.toLowerCase();
  const q = normalizeProductQuery(rawQuery);
  const qSingular = q.split(' ').map(singularizeToken).join(' ');
  if (!q) return 0;
  if (name === q || name === qSingular || sku === q) return 100;
  if (name.includes(q) || name.includes(qSingular)) return 80;
  if (sku.includes(q)) return 70;
  const tokens = qSingular.split(' ').filter((t) => t.length > 1);
  if (!tokens.length) return 0;
  const nameTokens = name.replace(/-/g, ' ').split(/\s+/);
  const hit = tokens.filter((t) => nameTokens.some((n) => n.includes(t) || t.includes(n))).length;
  if (hit === tokens.length) return 60 + hit;
  if (hit > 0 && hit >= Math.ceil(tokens.length * 0.6)) return 40 + hit;
  return 0;
}

async function findProducts(query: string, limit = 10) {
  const q = query.trim();
  if (!q) return [];

  const variants = queryVariants(q);
  const orClauses = variants.flatMap((v) => [{ name: { contains: v } }, { sku: { contains: v } }]);

  // Broad fetch then rank in memory (SQLite contains is limited for plurals)
  const candidates = await prisma.product.findMany({
    where: orClauses.length ? { OR: orClauses } : undefined,
    include: {
      department: { select: { name: true } },
      supplier: { select: { id: true, name: true } },
    },
    take: 80,
    orderBy: { name: 'asc' },
  });

  // If DB returned nothing (e.g. plural mismatch), scan a wider set
  const pool =
    candidates.length > 0
      ? candidates
      : await prisma.product.findMany({
          include: {
            department: { select: { name: true } },
            supplier: { select: { id: true, name: true } },
          },
          take: 200,
          orderBy: { name: 'asc' },
        });

  return pool
    .map((p) => ({ product: p, score: scoreProductMatch(p, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, limit)
    .map((x) => x.product);
}

async function resolveUniqueProduct(query: string) {
  const matches = await findProducts(query, 8);
  if (matches.length === 0) {
    return { error: `No product found matching "${query}".` };
  }
  const qNorm = normalizeProductQuery(query);
  const qSingular = qNorm.split(' ').map(singularizeToken).join(' ');
  const exact = matches.filter((p) => {
    const n = p.name.toLowerCase();
    return n === qNorm || n === qSingular || p.sku.toLowerCase() === qNorm;
  });
  if (exact.length === 1) return { product: exact[0] };

  // Strong top score and clear gap → accept uniquely
  const scored = matches.map((p) => ({ p, score: scoreProductMatch(p, query) }));
  if (scored[0].score >= 60 && (scored.length === 1 || scored[0].score >= scored[1].score + 15)) {
    return { product: scored[0].p };
  }
  if (matches.length === 1) return { product: matches[0] };

  return {
    ambiguous: true,
    matches: matches.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      currentStock: p.currentStock,
    })),
    message: `Multiple products match "${query}". Please clarify which one.`,
  };
}

function productPublic(p: {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  sellingPrice: number;
  costPrice: number;
  unit: string;
  department?: { name: string } | null;
  supplier?: { id: string; name: string } | null;
}, role: Role) {
  const base: Record<string, unknown> = {
    id: p.id,
    name: p.name,
    sku: p.sku,
    currentStock: p.currentStock,
    reorderLevel: p.reorderLevel,
    unit: p.unit,
    sellingPrice: formatPkr(p.sellingPrice),
    department: p.department?.name,
    supplier: p.supplier?.name,
  };
  if (hasPermission(role, 'VIEW_COST')) {
    base.costPrice = formatPkr(p.costPrice);
  }
  return base;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  user: AuthUser
): Promise<unknown> {
  const role = user.role as Role;

  switch (name) {
    case 'search_products': {
      const products = await findProducts(String(args.query ?? ''), Number(args.limit) || 10);
      return {
        count: products.length,
        products: products.map((p) => productPublic(p, role)),
      };
    }

    case 'get_product_stock': {
      const resolved = await resolveUniqueProduct(String(args.query ?? ''));
      if ('error' in resolved) return resolved;
      if ('ambiguous' in resolved) return resolved;
      return { product: productPublic(resolved.product, role) };
    }

    case 'get_multiple_product_stocks': {
      const queries = (args.queries as string[]) ?? [];
      const results = [];
      for (const q of queries) {
        const resolved = await resolveUniqueProduct(q);
        if ('error' in resolved) {
          results.push({ query: q, found: false, message: resolved.error });
        } else if ('ambiguous' in resolved) {
          results.push({ query: q, found: false, ambiguous: true, matches: resolved.matches });
        } else {
          results.push({
            query: q,
            found: true,
            name: resolved.product.name,
            sku: resolved.product.sku,
            currentStock: resolved.product.currentStock,
            unit: resolved.product.unit,
          });
        }
      }
      return { results };
    }

    case 'get_low_stock_products': {
      const all = await prisma.product.findMany({
        where: { currentStock: { gt: 0 } },
        include: { department: { select: { name: true } } },
        orderBy: { currentStock: 'asc' },
      });
      const low = all.filter((p) => p.currentStock <= p.reorderLevel);
      const limit = Number(args.limit) || 20;
      return {
        count: low.length,
        products: low.slice(0, limit).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          currentStock: p.currentStock,
          reorderLevel: p.reorderLevel,
          department: p.department.name,
        })),
      };
    }

    case 'get_out_of_stock_products': {
      const products = await prisma.product.findMany({
        where: { currentStock: { lte: 0 } },
        include: { department: { select: { name: true } } },
        take: Number(args.limit) || 20,
        orderBy: { name: 'asc' },
      });
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          currentStock: p.currentStock,
          department: p.department.name,
        })),
      };
    }

    case 'get_top_selling_products': {
      const weekStart = startOfWeek();
      const sales = await prisma.stockMovement.findMany({
        where: { type: 'SALE', createdAt: { gte: weekStart } },
        include: { product: { select: { id: true, name: true, sku: true } } },
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
      const ranked = [...map.values()].sort((a, b) => b.quantity - a.quantity);
      const limit = Number(args.limit) || 10;
      return {
        weekStart: weekStart.toISOString(),
        topSelling: ranked.slice(0, limit),
        message:
          ranked.length === 0
            ? 'No sales recorded this week yet.'
            : `Top seller this week: ${ranked[0].name} (${ranked[0].quantity} units).`,
      };
    }

    case 'get_stock_movements': {
      const where: Record<string, unknown> = {};
      if (args.productQuery) {
        const resolved = await resolveUniqueProduct(String(args.productQuery));
        if ('error' in resolved) return resolved;
        if ('ambiguous' in resolved) return resolved;
        where.productId = resolved.product.id;
      }
      const movements = await prisma.stockMovement.findMany({
        where,
        take: Number(args.limit) || 15,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, sku: true } },
          user: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      });
      return {
        count: movements.length,
        movements: movements.map((m) => ({
          id: m.id,
          type: m.type,
          quantity: m.quantity,
          previousStock: m.previousStock,
          newStock: m.newStock,
          product: m.product.name,
          sku: m.product.sku,
          performedBy: m.user.name,
          supplier: m.supplier?.name,
          source: m.source,
          createdAt: m.createdAt,
        })),
      };
    }

    case 'get_inventory_summary': {
      const products = await prisma.product.findMany({
        select: { currentStock: true, reorderLevel: true, costPrice: true },
      });
      const summary: Record<string, unknown> = {
        totalProducts: products.length,
        totalStockUnits: products.reduce((s, p) => s + p.currentStock, 0),
        lowStockCount: products.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel).length,
        outOfStockCount: products.filter((p) => p.currentStock <= 0).length,
      };
      if (hasPermission(role, 'VIEW_VALUATION')) {
        summary.inventoryValuation = formatPkr(
          products.reduce((s, p) => s + p.costPrice * p.currentStock, 0)
        );
      }
      return summary;
    }

    case 'get_sales_summary': {
      const weekStart = startOfWeek();
      const sales = await prisma.stockMovement.findMany({
        where: { type: 'SALE', createdAt: { gte: weekStart } },
      });
      const units = sales.reduce((s, m) => s + m.quantity, 0);
      const result: Record<string, unknown> = {
        weekStart: weekStart.toISOString(),
        saleEvents: sales.length,
        unitsSold: units,
      };
      if (hasPermission(role, 'VIEW_PROFIT')) {
        const revenue = sales.reduce((s, m) => s + (m.unitPrice ?? 0) * m.quantity, 0);
        result.revenue = formatPkr(revenue);
      }
      return result;
    }

    case 'get_profit_summary': {
      if (!hasPermission(role, 'VIEW_PROFIT')) {
        return {
          denied: true,
          message:
            'Access denied. Profit information is only available to managers. Your role does not permit viewing costs or profits.',
        };
      }
      const weekStart = startOfWeek();
      const sales = await prisma.stockMovement.findMany({
        where: { type: 'SALE', createdAt: { gte: weekStart } },
      });
      let revenue = 0;
      let cost = 0;
      for (const s of sales) {
        revenue += (s.unitPrice ?? 0) * s.quantity;
        cost += (s.unitCost ?? 0) * s.quantity;
      }
      return {
        weekStart: weekStart.toISOString(),
        revenue: formatPkr(revenue),
        cost: formatPkr(cost),
        profit: formatPkr(revenue - cost),
        revenuePkr: paisaToPkr(revenue),
        costPkr: paisaToPkr(cost),
        profitPkr: paisaToPkr(revenue - cost),
        unitsSold: sales.reduce((s, m) => s + m.quantity, 0),
      };
    }

    case 'prepare_stock_in': {
      if (!hasPermission(role, 'STOCK_IN')) {
        return { denied: true, message: 'You do not have permission to stock in.' };
      }
      const quantity = Number(args.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return { error: 'Quantity must be a positive integer.' };
      }
      const resolved = await resolveUniqueProduct(String(args.productQuery ?? ''));
      if ('error' in resolved) return resolved;
      if ('ambiguous' in resolved) return resolved;

      let supplierId: string | null = resolved.product.supplierId;
      let supplierName: string | null = resolved.product.supplier?.name ?? null;
      if (args.supplierQuery) {
        const suppliers = await prisma.supplier.findMany({
          where: { name: { contains: String(args.supplierQuery) } },
        });
        if (suppliers.length === 0) {
          return { error: `Supplier not found: "${args.supplierQuery}"` };
        }
        if (suppliers.length > 1) {
          const exact = suppliers.find(
            (s) => s.name.toLowerCase() === String(args.supplierQuery).toLowerCase()
          );
          if (!exact) {
            return {
              ambiguous: true,
              message: 'Multiple suppliers match. Please clarify.',
              matches: suppliers.map((s) => s.name),
            };
          }
          supplierId = exact.id;
          supplierName = exact.name;
        } else {
          supplierId = suppliers[0].id;
          supplierName = suppliers[0].name;
        }
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const proposal = await prisma.aIActionProposal.create({
        data: {
          userId: user.id,
          productId: resolved.product.id,
          actionType: 'STOCK_IN',
          quantity,
          supplierId,
          status: 'PENDING',
          expectedStock: resolved.product.currentStock,
          reason: (args.reason as string) || 'AI stock-in request',
          expiresAt,
        },
        include: { product: true, supplier: true },
      });

      return {
        proposal: {
          id: proposal.id,
          actionType: 'STOCK_IN',
          product: proposal.product.name,
          productId: proposal.productId,
          sku: proposal.product.sku,
          supplier: supplierName,
          quantity,
          currentStock: resolved.product.currentStock,
          newStock: resolved.product.currentStock + quantity,
          status: 'PENDING',
          expiresAt: proposal.expiresAt,
        },
        message:
          'Stock update proposal created. Stock has NOT been changed yet. Ask the user to Confirm or Cancel.',
      };
    }

    case 'prepare_stock_out': {
      const actionType = String(args.actionType || 'STOCK_OUT') as 'STOCK_OUT' | 'SALE' | 'DAMAGED';
      const perm =
        actionType === 'SALE' ? 'SALE' : actionType === 'DAMAGED' ? 'DAMAGED' : 'STOCK_OUT';
      if (!hasPermission(role, perm)) {
        return { denied: true, message: `You do not have permission for ${actionType}.` };
      }
      const quantity = Number(args.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return { error: 'Quantity must be a positive integer.' };
      }
      const resolved = await resolveUniqueProduct(String(args.productQuery ?? ''));
      if ('error' in resolved) return resolved;
      if ('ambiguous' in resolved) return resolved;

      if (resolved.product.currentStock < quantity) {
        return {
          error: `Insufficient stock for ${resolved.product.name}. Available: ${resolved.product.currentStock}, requested: ${quantity}. No proposal created.`,
          currentStock: resolved.product.currentStock,
        };
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const proposal = await prisma.aIActionProposal.create({
        data: {
          userId: user.id,
          productId: resolved.product.id,
          actionType,
          quantity,
          status: 'PENDING',
          expectedStock: resolved.product.currentStock,
          reason: (args.reason as string) || `AI ${actionType} request`,
          expiresAt,
        },
        include: { product: true },
      });

      return {
        proposal: {
          id: proposal.id,
          actionType,
          product: proposal.product.name,
          productId: proposal.productId,
          sku: proposal.product.sku,
          quantity,
          currentStock: resolved.product.currentStock,
          newStock: resolved.product.currentStock - quantity,
          status: 'PENDING',
          expiresAt: proposal.expiresAt,
        },
        message:
          'Stock update proposal created. Stock has NOT been changed yet. Ask the user to Confirm or Cancel.',
      };
    }

    default:
      throw new AppError(400, `Unknown tool: ${name}`, 'UNKNOWN_TOOL');
  }
}
