const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('ss_token');
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.error || res.statusText, data.code);
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<{ user: User }>('/auth/me'),
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'MANAGER' | 'STAFF';
  departmentId: string | null;
  department?: { id: string; name: string } | null;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  categoryId: string;
  departmentId: string;
  supplierId?: string | null;
  sellingPrice: number;
  costPrice?: number;
  inventoryValue?: number;
  currentStock: number;
  reorderLevel: number;
  unit: string;
  stockStatus: string;
  category?: { id: string; name: string };
  department?: { id: string; name: string };
  supplier?: { id: string; name: string };
};

export function formatPkr(amount: number | undefined | null): string {
  if (amount == null) return '—';
  return `PKR ${amount.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}
