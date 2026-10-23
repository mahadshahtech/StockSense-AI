import { useQuery } from '@tanstack/react-query';
import { api, formatPkr } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function ReportsPage() {
  const { isManager } = useAuth();

  const top = useQuery({
    queryKey: ['report-top'],
    queryFn: () => api<{ data: Array<{ name: string; sku: string; quantity: number }> }>('/reports/top-selling'),
  });
  const low = useQuery({
    queryKey: ['report-low'],
    queryFn: () =>
      api<{ data: Array<{ name: string; sku: string; currentStock: number; reorderLevel: number; department: string }> }>(
        '/reports/low-stock'
      ),
  });
  const out = useQuery({
    queryKey: ['report-out'],
    queryFn: () =>
      api<{ data: Array<{ name: string; sku: string; department: string }> }>('/reports/out-of-stock'),
  });
  const dept = useQuery({
    queryKey: ['report-dept'],
    queryFn: () =>
      api<{
        data: Array<{ name: string; productCount: number; stockUnits: number; inventoryValue?: number }>;
      }>('/reports/department-inventory'),
  });
  const sales = useQuery({
    queryKey: ['report-sales'],
    queryFn: () =>
      api<{
        unitsSold: number;
        saleEvents: number;
        revenue?: number;
        cost?: number;
        profit?: number;
      }>('/reports/sales-summary'),
  });
  const profit = useQuery({
    queryKey: ['report-profit'],
    queryFn: () =>
      api<{ revenue: number; cost: number; profit: number; unitsSold: number }>('/reports/profit-summary'),
    enabled: isManager,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Reports</h1>
        <p className="text-sm text-slate-400">Aggregated from live stock movements and inventory</p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Units sold (week)" value={String(sales.data?.unitsSold ?? '—')} />
        <Stat label="Sale events" value={String(sales.data?.saleEvents ?? '—')} />
        {isManager && <Stat label="Weekly revenue" value={formatPkr(profit.data?.revenue)} />}
        {isManager && <Stat label="Weekly profit" value={formatPkr(profit.data?.profit)} />}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ReportCard title="Top Selling This Week">
          <Rows
            rows={top.data?.data.map((r) => [r.name, `${r.quantity} sold`]) ?? []}
            empty="No sales yet"
          />
        </ReportCard>
        <ReportCard title="Department Inventory">
          <Rows
            rows={
              dept.data?.data.map((d) => [
                d.name,
                `${d.stockUnits} units · ${d.productCount} SKUs${
                  d.inventoryValue != null ? ` · ${formatPkr(d.inventoryValue)}` : ''
                }`,
              ]) ?? []
            }
          />
        </ReportCard>
        <ReportCard title="Low Stock">
          <Rows
            rows={low.data?.data.map((r) => [r.name, `${r.currentStock} (reorder ${r.reorderLevel})`]) ?? []}
            empty="None"
          />
        </ReportCard>
        <ReportCard title="Out of Stock">
          <Rows rows={out.data?.data.map((r) => [r.name, r.department]) ?? []} empty="None" />
        </ReportCard>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-display text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-display font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Rows({ rows, empty }: { rows: string[][]; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{empty || 'No data'}</p>;
  return (
    <ul className="space-y-2 max-h-72 overflow-y-auto">
      {rows.map(([a, b]) => (
        <li key={a + b} className="flex justify-between gap-3 text-sm border-b border-white/5 pb-2">
          <span>{a}</span>
          <span className="text-slate-400 text-right">{b}</span>
        </li>
      ))}
    </ul>
  );
}
