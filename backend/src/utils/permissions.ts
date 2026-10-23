import { AppError } from './errors.js';

export type Role = 'MANAGER' | 'STAFF';

export const PERMISSIONS = {
  VIEW_COST: 'VIEW_COST',
  VIEW_PROFIT: 'VIEW_PROFIT',
  VIEW_VALUATION: 'VIEW_VALUATION',
  EDIT_PRODUCT: 'EDIT_PRODUCT',
  EDIT_PRICES: 'EDIT_PRICES',
  MANAGE_SUPPLIERS: 'MANAGE_SUPPLIERS',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  VIEW_ALL_HISTORY: 'VIEW_ALL_HISTORY',
  VIEW_STAFF_ACTIVITY: 'VIEW_STAFF_ACTIVITY',
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  SALE: 'SALE',
  DAMAGED: 'DAMAGED',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  MANAGER: Object.values(PERMISSIONS),
  STAFF: [
    PERMISSIONS.STOCK_IN,
    PERMISSIONS.STOCK_OUT,
    PERMISSIONS.SALE,
    PERMISSIONS.DAMAGED,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AppError(403, 'You do not have permission to perform this action', 'FORBIDDEN');
  }
}

/** Strip financial fields for staff responses */
export function filterProductForRole<T extends Record<string, unknown>>(
  product: T,
  role: Role
): Omit<T, 'costPrice' | 'costPricePkr' | 'profit' | 'profitMargin' | 'inventoryValue' | 'unitCost'> {
  if (role === 'MANAGER') return product;
  const clone = { ...product };
  delete (clone as Record<string, unknown>).costPrice;
  delete (clone as Record<string, unknown>).costPricePkr;
  delete (clone as Record<string, unknown>).profit;
  delete (clone as Record<string, unknown>).profitMargin;
  delete (clone as Record<string, unknown>).inventoryValue;
  delete (clone as Record<string, unknown>).unitCost;
  return clone;
}
