import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type Toast = { id: number; type: 'success' | 'error' | 'info'; message: string };

const ToastContext = createContext<{
  toast: (message: string, type?: Toast['type']) => void;
} | null>(null);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className="pointer-events-auto glass rounded-xl px-4 py-3 shadow-xl flex items-start gap-3"
            >
              {t.type === 'success' && <CheckCircle2 className="text-success shrink-0" size={18} />}
              {t.type === 'error' && <XCircle className="text-danger shrink-0" size={18} />}
              {t.type === 'info' && <Info className="text-accent-soft shrink-0" size={18} />}
              <p className="text-sm flex-1 text-slate-100">{t.message}</p>
              <button
                type="button"
                className="text-slate-400 hover:text-white"
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast requires ToastProvider');
  return ctx;
}
