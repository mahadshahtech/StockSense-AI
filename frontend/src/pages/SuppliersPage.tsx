import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

export default function SuppliersPage() {
  const { isManager } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () =>
      api<{
        data: Array<{
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          productCount: number;
        }>;
      }>('/suppliers'),
  });

  const { data: detail } = useQuery({
    queryKey: ['supplier', selected],
    queryFn: () =>
      api<{
        supplier: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          products: Array<{ id: string; name: string; sku: string; currentStock: number }>;
        };
      }>(`/suppliers/${selected}`),
    enabled: !!selected,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api('/suppliers', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast('Supplier created', 'success');
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-slate-400">Including Ali Traders and regional partners</p>
        </div>
        {isManager && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-sm font-medium"
          >
            <Plus size={16} /> Add Supplier
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl divide-y divide-white/5 overflow-hidden">
          {data?.data.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              className={`w-full text-left px-4 py-3 hover:bg-white/5 ${selected === s.id ? 'bg-white/5' : ''}`}
            >
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {s.productCount} products · {s.phone || 'No phone'}
              </p>
            </button>
          ))}
        </div>

        <div className="glass rounded-2xl p-5 min-h-64">
          {!detail && <p className="text-slate-500 text-sm">Select a supplier to view details</p>}
          {detail && (
            <div>
              <h2 className="font-display text-xl font-semibold">{detail.supplier.name}</h2>
              <p className="text-sm text-slate-400 mt-2">{detail.supplier.address}</p>
              <p className="text-sm text-slate-400">{detail.supplier.email}</p>
              <p className="text-sm text-slate-400">{detail.supplier.phone}</p>
              <h3 className="mt-6 mb-2 font-medium text-sm text-slate-300">Associated Products</h3>
              <ul className="space-y-1 max-h-80 overflow-y-auto">
                {detail.supplier.products.map((p) => (
                  <li key={p.id}>
                    <Link to={`/inventory/${p.id}`} className="text-sm hover:text-cyan flex justify-between py-1.5">
                      <span>
                        {p.name} <span className="text-slate-500">({p.sku})</span>
                      </span>
                      <span className="text-slate-400">{p.currentStock}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <form
            className="glass rounded-2xl p-6 w-full max-w-md space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createMutation.mutate({
                name: String(fd.get('name')),
                phone: String(fd.get('phone') || ''),
                email: String(fd.get('email') || ''),
                address: String(fd.get('address') || ''),
              });
            }}
          >
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">New Supplier</h2>
              <button type="button" onClick={() => setShowAdd(false)}>
                <X size={18} />
              </button>
            </div>
            {['name', 'phone', 'email', 'address'].map((f) => (
              <input
                key={f}
                name={f}
                required={f === 'name'}
                placeholder={f}
                className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
              />
            ))}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-accent text-sm font-medium">
              Create
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
