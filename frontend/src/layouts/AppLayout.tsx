import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Truck,
  BarChart3,
  Bot,
  Activity,
  Settings,
  Menu,
  X,
  LogOut,
  Search,
  Bell,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import clsx from 'clsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/stock', label: 'Stock', icon: Boxes },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { user, logout, isManager } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-cyan grid place-items-center shadow-lg shadow-accent/20">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white tracking-tight">StockSense AI</p>
            <p className="text-[11px] text-slate-400">Nowshera Shopping Mall</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                isActive
                  ? 'text-white bg-white/8'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-gradient-to-b from-accent to-cyan"
                  />
                )}
                <item.icon size={18} className={isActive ? 'text-cyan' : ''} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet to-accent grid place-items-center text-xs font-bold">
            {user?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-400">{isManager ? 'Manager' : 'Staff'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full flex items-center justify-center gap-2 text-sm text-slate-300 hover:text-white py-2 rounded-lg hover:bg-white/5"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex">
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-white/5 bg-navy-900/80 sticky top-0 h-screen">
        {sidebar}
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 w-72 z-50 bg-navy-900 border-r border-white/5 lg:hidden"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <button
                type="button"
                className="absolute top-4 right-4 text-slate-400"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 glass border-b border-white/5 px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg hover:bg-white/5"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 max-w-md relative hidden sm:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              placeholder="Search inventory…"
              className="w-full bg-navy-800/80 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-accent/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = (e.target as HTMLInputElement).value;
                  navigate(`/inventory?search=${encodeURIComponent(q)}`);
                }
              }}
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent-soft border border-accent/20">
              All Departments
            </span>
            <button type="button" className="relative p-2 rounded-lg hover:bg-white/5 text-slate-300">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan animate-pulse" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/assistant')}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-accent to-violet text-sm font-medium shadow-lg shadow-accent/20 hover:opacity-95 active:scale-[0.98] transition"
            >
              <Bot size={16} /> Ask AI
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
