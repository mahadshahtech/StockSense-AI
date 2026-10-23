import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import { assertPermission, type Role } from '../utils/permissions.js';
import type { AuthUser } from '../middleware/auth.js';

export type StockMovementType = 'STOCK_IN' | 'STOCK_OUT' | 'SALE' | 'DAMAGED' | 'ADJUSTMENT';

const TYPE_PERMISSION: Record<StockMovementType, 'STOCK_IN' | 'STOCK_OUT' | 'SALE' | 'DAMAGED' | 'STOCK_ADJUSTMENT'> = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  SALE: 'SALE',
  DAMAGED: 'DAMAGED',
  ADJUSTMENT: 'STOCK_ADJUSTMENT',
};

export interface StockChangeInput {
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  supplierId?: string | null;
  source?: 'FORM' | 'AI';
  /** For ADJUSTMENT: absolute new stock level */
  newStockLevel?: number;
}

function deltaForType(type: StockMovementType, quantity: number, previous: number, newLevel?: number): number {
  switch (type) {
    case 'STOCK_IN':
      return previous + quantity;
    case 'STOCK_OUT':
    case 'SALE':
    case 'DAMAGED':
      return previous - quantity;
    case 'ADJUSTMENT':
      if (newLevel == null || newLevel < 0) {
        throw new AppError(400, 'Adjustment requires a non-negative new stock level', 'INVALID_ADJUSTMENT');
      }
      return newLevel;
    default:
      throw new AppError(400, 'Invalid stock movement type', 'INVALID_TYPE');
  }
}

export async function applyStockChange(user: AuthUser, input: StockChangeInput) {
  assertPermission(user.role as Role, TYPE_PERMISSION[input.type]);

  if (input.type !== 'ADJUSTMENT' && (!Number.isInteger(input.quantity) || input.quantity <= 0)) {
    throw new AppError(400, 'Quantity must be a positive integer', 'INVALID_QUANTITY');
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) {
      throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
    }

    const previousStock = product.currentStock;
    const newStock = deltaForType(input.type, input.quantity, previousStock, input.newStockLevel);

    if (newStock < 0) {
      throw new AppError(
        400,
        `Insufficient stock. Available: ${previousStock}, requested: ${input.quantity}`,
        'INSUFFICIENT_STOCK'
      );
    }

    if (input.supplierId) {
      const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
      if (!supplier) {
        throw new AppError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');
      }
    }

    const qty =
      input.type === 'ADJUSTMENT'
        ? Math.abs(newStock - previousStock)
        : input.quantity;

    const updated = await tx.product.update({
      where: { id: product.id },
      data: { currentStock: newStock },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: input.type,
        quantity: qty,
        previousStock,
        newStock,
        reason: input.reason ?? null,
        supplierId: input.supplierId ?? product.supplierId ?? null,
        performedBy: user.id,
        source: input.source ?? 'FORM',
        unitCost: product.costPrice,
        unitPrice: input.type === 'SALE' ? product.sellingPrice : null,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        user: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: `STOCK_${input.type}`,
        entityType: 'Product',
        entityId: product.id,
        metadata: JSON.stringify({
          previousStock,
          newStock,
          quantity: qty,
          source: input.source ?? 'FORM',
          movementId: movement.id,
        }),
      },
    });

    return { product: updated, movement };
  });
}

export async function confirmProposal(user: AuthUser, proposalId: string) {
  return prisma.$transaction(async (tx) => {
    const proposal = await tx.aIActionProposal.findUnique({
      where: { id: proposalId },
      include: { product: true, supplier: true },
    });

    if (!proposal) {
      throw new AppError(404, 'Proposal not found', 'PROPOSAL_NOT_FOUND');
    }
    if (proposal.userId !== user.id) {
      throw new AppError(403, 'You can only confirm your own proposals', 'FORBIDDEN');
    }
    if (proposal.status === 'CONFIRMED') {
      // Idempotent: return current state without re-applying
      const product = await tx.product.findUnique({ where: { id: proposal.productId } });
      return {
        alreadyConfirmed: true as const,
        proposal,
        product,
        movement: null,
      };
    }
    if (proposal.status !== 'PENDING') {
      throw new AppError(400, `Proposal is ${proposal.status.toLowerCase()} and cannot be confirmed`, 'PROPOSAL_NOT_PENDING');
    }
    if (proposal.expiresAt.getTime() < Date.now()) {
      await tx.aIActionProposal.update({
        where: { id: proposal.id },
        data: { status: 'EXPIRED' },
      });
      throw new AppError(400, 'Proposal has expired. Please request a new action.', 'PROPOSAL_EXPIRED');
    }

    const product = await tx.product.findUnique({ where: { id: proposal.productId } });
    if (!product) {
      throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
    }

    if (product.currentStock !== proposal.expectedStock) {
      await tx.aIActionProposal.update({
        where: { id: proposal.id },
        data: { status: 'REJECTED' },
      });
      throw new AppError(
        409,
        `Stock changed since proposal was created (expected ${proposal.expectedStock}, now ${product.currentStock}). Please create a new proposal.`,
        'STALE_PROPOSAL'
      );
    }

    const type = proposal.actionType as StockMovementType;
    assertPermission(user.role as Role, TYPE_PERMISSION[type]);

    const previousStock = product.currentStock;
    let newStock: number;
    if (type === 'STOCK_IN') {
      newStock = previousStock + proposal.quantity;
    } else {
      newStock = previousStock - proposal.quantity;
    }

    if (newStock < 0) {
      await tx.aIActionProposal.update({
        where: { id: proposal.id },
        data: { status: 'REJECTED' },
      });
      throw new AppError(
        400,
        `Insufficient stock. Available: ${previousStock}, requested: ${proposal.quantity}`,
        'INSUFFICIENT_STOCK'
      );
    }

    const updated = await tx.product.update({
      where: { id: product.id },
      data: { currentStock: newStock },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type,
        quantity: proposal.quantity,
        previousStock,
        newStock,
        reason: proposal.reason ?? `AI-confirmed ${type}`,
        supplierId: proposal.supplierId,
        performedBy: user.id,
        source: 'AI',
        unitCost: product.costPrice,
        unitPrice: type === 'SALE' ? product.sellingPrice : null,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        user: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    const confirmed = await tx.aIActionProposal.update({
      where: { id: proposal.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
      include: { product: true, supplier: true },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'AI_PROPOSAL_CONFIRMED',
        entityType: 'AIActionProposal',
        entityId: proposal.id,
        metadata: JSON.stringify({
          previousStock,
          newStock,
          quantity: proposal.quantity,
          movementId: movement.id,
          actionType: type,
        }),
      },
    });

    return { alreadyConfirmed: false as const, proposal: confirmed, product: updated, movement };
  });
}

export async function cancelProposal(user: AuthUser, proposalId: string) {
  const proposal = await prisma.aIActionProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) {
    throw new AppError(404, 'Proposal not found', 'PROPOSAL_NOT_FOUND');
  }
  if (proposal.userId !== user.id && user.role !== 'MANAGER') {
    throw new AppError(403, 'You can only cancel your own proposals', 'FORBIDDEN');
  }
  if (proposal.status === 'CANCELLED') {
    return proposal;
  }
  if (proposal.status !== 'PENDING') {
    throw new AppError(400, `Proposal is ${proposal.status.toLowerCase()} and cannot be cancelled`, 'PROPOSAL_NOT_PENDING');
  }

  const cancelled = await prisma.aIActionProposal.update({
    where: { id: proposalId },
    data: { status: 'CANCELLED' },
    include: { product: true, supplier: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'AI_PROPOSAL_CANCELLED',
      entityType: 'AIActionProposal',
      entityId: proposalId,
      metadata: JSON.stringify({ productId: proposal.productId, quantity: proposal.quantity }),
    },
  });

  return cancelled;
}
