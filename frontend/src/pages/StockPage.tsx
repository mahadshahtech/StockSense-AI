import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Product } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { ApiError } from '../lib/api';

const TYPES = [
  { value: 'STOCK_IN', label: 'Stock In' },
  { value: 'STOCK_OUT', label: 'Stock Out' },
  { value: 'SALE', label: 'Sale' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'ADJUSTMENT', label: 'Manual Adjustment (manager)' },
] as const;

export default function StockPage() {
  const { isManager } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [type, setType] = useState<string>('STOCK_IN');
  const [quantity, setQuantity] = useState(1);
  const [newStockLevel, setNewStockLevel] = useState(0);
  const [reason, setReason] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [pending, setPending] = useState(false);

  const { data: products } = useQuery({
    queryKey: ['products-search', productSearch],
    queryFn: () =>
      api<{ data: Product[] }>(`/products?search=${encodeURIComponent(productSearch)}&limit=10`),
    enabled: productSearch.length >= 1,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api<{ data: Array<{ id: string; name: string }> }>('/suppliers'),
  });

  const { data: movements, refetch } = useQuery({
    queryKey: ['movements'],
    queryFn: () =>
      api<{
        data: Array<{
          id: string;
          type: string;
          quantity: number;
          previousStock: number;
          newStock: number;
          createdAt: string;
          product: { name: string; sku: string };
          user: { name: string };
          source: string;
        }>;
      }>('/stock/movements?limit=30'),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) {
      toast('Select a product', 'error');
      return;
    }
    if (type === 'ADJUSTMENT' && !isManager) {
      toast('Only managers can adjust stock', 'error');
      return;
    }
    setPending(true);
    try {
      await api('/stock/change', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct.id,
          type,
          quantity: type === 'ADJUSTMENT' ? undefined : quantity,
          newStockLevel: type === 'ADJUSTMENT' ? newStockLevel : undefined,
          reason: reason || undefined,
          supplierId: supplierId || undefined,
        }),
      });
      toast('Stock updated successfully', 'success');
      setQuantity(1);
      setReason('');
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      refetch();
      const refreshed = await api<{ product: Product }>(`/products/${selectedProduct.id}`);
      setSelectedProduct(refreshed.product);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Stock update failed', 'error');
    } finally {
      setPending(false);
    }
  }

  const availableTypes = TYPES.filter((t) => t.value !== 'ADJUSTMENT' || isManager);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Stock Management</h1>
        <p className="text-sm text-slate-400">Record stock-in, sales, damages, and adjustments</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-display font-semibold">Record Movement</h2>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Find product</label>
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Type name or SKU…"
              className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
            />
            {products && products.data.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/5 divide-y divide-white/5">
                {products.data.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                      onClick={() => {
                        setSelectedProduct(p);
                        setProductSearch(p.name);
                        setNewStockLevel(p.currentStock);
                        setSupplierId(p.supplierId || '');
                      }}
                    >
                      {p.name}{' '}
                      <span className="text-slate-500">
                        ({p.sku}) — {p.currentStock} {p.unit}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedProduct && (
            <div className="rounded-xl bg-accent/10 border border-accent/20 px-3 py-2 text-sm">
              Selected: <strong>{selectedProduct.name}</strong> · Stock:{' '}
              <strong>{selectedProduct.currentStock}</strong>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 block mb-1">Operation</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
            >
              {availableTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {type === 'ADJUSTMENT' ? (
            <div>
              <label className="text-xs text-slate-400 block mb-1">New stock level</label>
              <input
                type="number"
                min={0}
                value={newStockLevel}
                onChange={(e) => setNewStockLevel(Number(e.target.value))}
                className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          )}

          {type === 'STOCK_IN' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
              >
                <option value="">Default / none</option>
                {suppliers?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 block mb-1">Reason (optional)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-cyan font-medium text-sm disabled:opacity-60 active:scale-[0.99]"
          >
            {pending ? 'Processing…' : 'Apply Stock Change'}
          </button>
        </form>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-display font-semibold mb-4">Recent Movements</h2>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {movements?.data.map((m) => (
              <div key={m.id} className="rounded-xl border border-white/5 px-3 py-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{m.product.name}</span>
                  <span className="text-xs text-slate-500">{m.source}</span>
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  {m.type} · {m.quantity} · {m.previousStock} → {m.newStock} · {m.user.name}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {new Date(m.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
