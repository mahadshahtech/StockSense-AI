import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package,
  Boxes,
  AlertTriangle,
  Ban,
  TrendingUp,
  Bot,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { api, formatPkr } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CountUp } from '../components/CountUp';

type Dashboard = {
  totalProducts: number;
  totalStockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockProducts: Array<{ id: string; name: string; currentStock: number; reorderLevel: number }>;
  recentMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    createdAt: string;
    product: { name: string };
    user: { name: string };
  }>;
  departmentDistribution: Array<{ name: string; stockUnits: number; products: number }>;
  movementTrends: Array<{ date: string; in: number; out: number; sales: number }>;
  topSellingProducts: Array<{ name: string; quantity: number }>;
  inventoryValuation?: number;
  weeklyProfit?: { revenue: number; cost: number; profit: number; unitsSold: number };
};

export default function DashboardPage() {
  const { isManager } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/dashboard'),
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-navy-800/60 animate-pulse" />
        ))}
      </div>
    );
  }

  const kpis = [
    { label: 'Total Products', value: data.totalProducts, icon: Package, color: 'from-accent/30 to-accent/5' },
    { label: 'Stock Units', value: data.totalStockUnits, icon: Boxes, color: 'from-cyan/30 to-cyan/5' },
    { label: 'Low Stock', value: data.lowStockCount, icon: AlertTriangle, color: 'from-warning/30 to-warning/5' },
    { label: 'Out of Stock', value: data.outOfStockCount, icon: Ban, color: 'from-danger/30 to-danger/5' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Live inventory intelligence for Nowshera Shopping Mall</p>
        </div>
        <Link
          to="/assistant"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent to-violet text-sm font-medium shadow-lg shadow-accent/20"
        >
          <Bot size={16} /> Open AI Assistant <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`rounded-2xl border border-white/5 bg-gradient-to-br ${k.color} p-5 glass`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-400">{k.label}</p>
              <k.icon size={18} className="text-slate-300" />
            </div>
            <p className="font-display text-3xl font-bold">
              <CountUp value={k.value} />
            </p>
          </motion.div>
        ))}
      </div>

      {isManager && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <p className="text-sm text-slate-400 mb-1">Inventory Valuation</p>
            <p className="font-display text-2xl font-bold text-cyan">
              {formatPkr(data.inventoryValuation)}
            </p>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-sm text-slate-400 mb-1 flex items-center gap-2">
              <TrendingUp size={14} /> Weekly Profit
            </p>
            <p className="font-display text-2xl font-bold text-success">
              {formatPkr(data.weeklyProfit?.profit)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Revenue {formatPkr(data.weeklyProfit?.revenue)} · Cost{' '}
              {formatPkr(data.weeklyProfit?.cost)} · {data.weeklyProfit?.unitsSold ?? 0} units sold
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 glass rounded-2xl p-5">
          <h2 className="font-display font-semibold mb-4">Stock Movement Trends (7 days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.movementTrends}>
                <defs>
                  <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#121a2b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="url(#sales)" name="Sales" />
                <Area type="monotone" dataKey="in" stroke="#22d3ee" fill="transparent" name="Stock In" />
                <Area type="monotone" dataKey="out" stroke="#f87171" fill="transparent" name="Out/Damage" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-display font-semibold mb-4">Department Stock</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.departmentDistribution}>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#121a2b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                />
                <Bar dataKey="stockUnits" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Units" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Low Stock Alerts</h2>
            <Link to="/reports" className="text-xs text-cyan hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {data.lowStockProducts.length === 0 && (
              <li className="text-sm text-slate-500">No low-stock products</li>
            )}
            {data.lowStockProducts.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/inventory/${p.id}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/5"
                >
                  <span className="text-sm">{p.name}</span>
                  <span className="text-xs text-warning">
                    {p.currentStock} / reorder {p.reorderLevel}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-display font-semibold mb-4">Top Selling This Week</h2>
          <ul className="space-y-2">
            {data.topSellingProducts.length === 0 && (
              <li className="text-sm text-slate-500">No sales this week</li>
            )}
            {data.topSellingProducts.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3 px-3 py-2">
                <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent-soft text-xs grid place-items-center font-bold">
                  {i + 1}
                </span>
                <span className="text-sm flex-1">{p.name}</span>
                <span className="text-xs text-slate-400">{p.quantity} sold</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold">Recent Stock Movements</h2>
          <Link to="/stock" className="text-xs text-cyan hover:underline">
            Manage stock
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/5">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Qty</th>
                <th className="pb-2 font-medium">By</th>
                <th className="pb-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {data.recentMovements.map((m) => (
                <tr key={m.id} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5">{m.product.name}</td>
                  <td className="py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5">{m.type}</span>
                  </td>
                  <td className="py-2.5">{m.quantity}</td>
                  <td className="py-2.5 text-slate-400">{m.user.name}</td>
                  <td className="py-2.5 text-slate-400">
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
