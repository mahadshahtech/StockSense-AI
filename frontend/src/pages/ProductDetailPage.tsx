import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, formatPkr, type Product } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { useState } from 'react';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { isManager } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () =>
      api<{
        product: Product;
        movements: Array<{
          id: string;
          type: string;
          quantity: number;
          previousStock: number;
          newStock: number;
          createdAt: string;
          user: { name: string };
          source: string;
        }>;
      }>(`/products/${id}`),
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast('Product updated', 'success');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['product', id] });
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  if (isLoading || !data) {
    return <div className="h-40 rounded-2xl bg-navy-800/50 animate-pulse" />;
  }

  const p = data.product;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/inventory" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={16} /> Back to inventory
      </Link>

      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">{p.name}</h1>
            <p className="text-slate-400 text-sm mt-1">{p.sku} · {p.department?.name} · {p.category?.name}</p>
            <p className="text-slate-500 text-sm mt-3">{p.description}</p>
          </div>
          {isManager && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="px-3 py-2 rounded-xl bg-white/5 text-sm hover:bg-white/10"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          <Metric label="Current Stock" value={`${p.currentStock} ${p.unit}`} />
          <Metric label="Reorder Level" value={String(p.reorderLevel)} />
          <Metric label="Selling Price" value={formatPkr(p.sellingPrice)} />
          {isManager && <Metric label="Cost Price" value={formatPkr(p.costPrice)} />}
          {isManager && <Metric label="Inventory Value" value={formatPkr(p.inventoryValue)} />}
          <Metric label="Supplier" value={p.supplier?.name || '—'} />
        </div>

        {editing && isManager && (
          <form
            className="mt-6 grid sm:grid-cols-2 gap-3 border-t border-white/5 pt-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateMutation.mutate({
                name: fd.get('name'),
                description: fd.get('description'),
                costPrice: Number(fd.get('costPrice')),
                sellingPrice: Number(fd.get('sellingPrice')),
                reorderLevel: Number(fd.get('reorderLevel')),
              });
            }}
          >
            <input name="name" defaultValue={p.name} className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <input name="description" defaultValue={p.description || ''} className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <input name="costPrice" type="number" step="0.01" defaultValue={p.costPrice} className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <input name="sellingPrice" type="number" step="0.01" defaultValue={p.sellingPrice} className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <input name="reorderLevel" type="number" defaultValue={p.reorderLevel} className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <button type="submit" className="sm:col-span-2 py-2.5 rounded-xl bg-accent text-sm font-medium">
              Save changes
            </button>
          </form>
        )}
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="font-display font-semibold mb-4">Stock History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/5">
                <th className="pb-2">Type</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Stock</th>
                <th className="pb-2">By</th>
                <th className="pb-2">Source</th>
                <th className="pb-2">When</th>
              </tr>
            </thead>
            <tbody>
              {data.movements.map((m) => (
                <tr key={m.id} className="border-b border-white/5">
                  <td className="py-2">{m.type}</td>
                  <td className="py-2">{m.quantity}</td>
                  <td className="py-2">
                    {m.previousStock} → {m.newStock}
                  </td>
                  <td className="py-2 text-slate-400">{m.user.name}</td>
                  <td className="py-2">{m.source}</td>
                  <td className="py-2 text-slate-400">{new Date(m.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-navy-800/50 border border-white/5 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium mt-1">{value}</p>
    </div>
  );
}
