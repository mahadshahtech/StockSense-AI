import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Search, X } from 'lucide-react';
import { api, formatPkr, type Product } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

export default function InventoryPage() {
  const { isManager } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);

  const search = params.get('search') || '';
  const departmentId = params.get('departmentId') || '';
  const stockStatus = params.get('stockStatus') || '';
  const page = Number(params.get('page') || 1);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api<{ data: Array<{ id: string; name: string; categories: Array<{ id: string; name: string }> }> }>('/meta/departments'),
  });

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (departmentId) q.set('departmentId', departmentId);
    if (stockStatus) q.set('stockStatus', stockStatus);
    q.set('page', String(page));
    q.set('limit', '20');
    return q.toString();
  }, [search, departmentId, stockStatus, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['products', query],
    queryFn: () =>
      api<{ data: Product[]; pagination: { page: number; totalPages: number; total: number } }>(
        `/products?${query}`
      ),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api<{ data: Array<{ id: string; name: string }> }>('/suppliers'),
    enabled: showAdd && isManager,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/products', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast('Product created', 'success');
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-slate-400">{data?.pagination.total ?? '…'} products</p>
        </div>
        {isManager && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-sm font-medium hover:bg-accent-soft transition"
          >
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      <div className="glass rounded-2xl p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            placeholder="Search name or SKU…"
            className="w-full bg-navy-800/80 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-accent/40"
          />
        </div>
        <select
          value={departmentId}
          onChange={(e) => updateParam('departmentId', e.target.value)}
          className="bg-navy-800/80 border border-white/5 rounded-xl px-3 py-2 text-sm"
        >
          <option value="">All departments</option>
          {departments?.data.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={stockStatus}
          onChange={(e) => updateParam('stockStatus', e.target.value)}
          className="bg-navy-800/80 border border-white/5 rounded-xl px-3 py-2 text-sm"
        >
          <option value="">All stock status</option>
          <option value="IN_STOCK">In stock</option>
          <option value="LOW_STOCK">Low stock</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
        </select>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Dept</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Sell</th>
                {isManager && <th className="px-4 py-3 font-medium">Cost</th>}
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.data.map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="border-t border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <Link to={`/inventory/${p.id}`} className="font-medium hover:text-cyan">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{p.sku}</td>
                  <td className="px-4 py-3">{p.department?.name}</td>
                  <td className="px-4 py-3">
                    {p.currentStock} {p.unit}
                  </td>
                  <td className="px-4 py-3">{formatPkr(p.sellingPrice)}</td>
                  {isManager && <td className="px-4 py-3">{formatPkr(p.costPrice)}</td>}
                  <td className="px-4 py-3">
                    <StatusBadge status={p.stockStatus} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateParam('page', String(page - 1))}
              className="px-3 py-1.5 rounded-lg bg-white/5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-slate-400">
              Page {page} / {data.pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= data.pagination.totalPages}
              onClick={() => updateParam('page', String(page + 1))}
              className="px-3 py-1.5 rounded-lg bg-white/5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showAdd && isManager && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60">
          <motion.form
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createMutation.mutate({
                sku: fd.get('sku'),
                name: fd.get('name'),
                description: fd.get('description'),
                departmentId: fd.get('departmentId'),
                categoryId: fd.get('categoryId'),
                supplierId: fd.get('supplierId') || undefined,
                costPrice: Number(fd.get('costPrice')),
                sellingPrice: Number(fd.get('sellingPrice')),
                currentStock: Number(fd.get('currentStock') || 0),
                reorderLevel: Number(fd.get('reorderLevel') || 10),
                unit: fd.get('unit') || 'pcs',
              });
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-lg">Add Product</h2>
              <button type="button" onClick={() => setShowAdd(false)}>
                <X size={18} />
              </button>
            </div>
            {['sku', 'name', 'description', 'unit'].map((f) => (
              <input
                key={f}
                name={f}
                required={f !== 'description'}
                placeholder={f}
                className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
              />
            ))}
            <select name="departmentId" required className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm">
              <option value="">Department</option>
              {departments?.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select name="categoryId" required className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm">
              <option value="">Category</option>
              {departments?.data.flatMap((d) =>
                d.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {d.name} — {c.name}
                  </option>
                ))
              )}
            </select>
            <select name="supplierId" className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm">
              <option value="">Supplier (optional)</option>
              {suppliers?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input name="costPrice" type="number" step="0.01" required placeholder="Cost PKR" className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm" />
              <input name="sellingPrice" type="number" step="0.01" required placeholder="Sell PKR" className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm" />
              <input name="currentStock" type="number" placeholder="Stock" className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm" />
              <input name="reorderLevel" type="number" placeholder="Reorder level" className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-accent font-medium text-sm disabled:opacity-60"
            >
              Create
            </button>
          </motion.form>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    IN_STOCK: 'bg-success/15 text-success',
    LOW_STOCK: 'bg-warning/15 text-warning',
    OUT_OF_STOCK: 'bg-danger/15 text-danger',
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${styles[status] || 'bg-white/10'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
