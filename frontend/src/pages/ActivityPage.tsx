import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function ActivityPage() {
  const { isManager } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () =>
      api<{
        data: Array<{
          id: string;
          action: string;
          entityType: string;
          entityId: string | null;
          metadata: unknown;
          createdAt: string;
          user: { name: string; email: string; role: string };
        }>;
      }>('/activity?limit=50'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Activity</h1>
        <p className="text-sm text-slate-400">
          {isManager ? 'All staff and manager audit events' : 'Your recent activity'}
        </p>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        {isLoading && <p className="p-6 text-slate-500 text-sm">Loading…</p>}
        <ul className="divide-y divide-white/5">
          {data?.data.map((log) => (
            <li key={log.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{log.action}</span>
                <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                {log.user.name} ({log.user.role}) · {log.entityType}
                {log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ''}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
