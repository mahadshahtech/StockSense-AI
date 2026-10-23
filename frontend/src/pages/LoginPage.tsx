import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { ApiError } from '../lib/api';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(data: Form) {
    setSubmitting(true);
    try {
      await login(data.email, data.password);
      toast('Welcome to StockSense AI', 'success');
      navigate('/dashboard');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Login failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.25),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.2),_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(34,211,238,0.12),_transparent_45%)] animate-[pulse_8s_ease-in-out_infinite]" />
      <motion.div
        className="absolute w-72 h-72 rounded-full bg-accent/20 blur-3xl -top-10 -left-10"
        animate={{ y: [0, 30, 0], x: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-80 h-80 rounded-full bg-violet/20 blur-3xl bottom-0 right-0"
        animate={{ y: [0, -40, 0], x: [0, -25, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md glass rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-accent via-cyan to-violet grid place-items-center mb-4 shadow-lg shadow-accent/30">
            <Sparkles className="text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            <span className="gradient-text">StockSense AI</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Smarter Inventory. Better Decisions.</p>
          <p className="text-slate-500 text-xs mt-1">Nowshera Shopping Mall</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
            <input
              {...register('email')}
              type="email"
              className="w-full bg-navy-800/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent/60"
              placeholder="manager@stocksense.local"
            />
            {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Password</label>
            <div className="relative">
              <input
                {...register('password')}
                type={show ? 'text' : 'password'}
                className="w-full bg-navy-800/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent/60 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setShow((s) => !s)}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-violet font-medium text-sm shadow-lg shadow-accent/25 hover:opacity-95 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Sign in
          </button>
        </form>

        <div className="mt-6 p-3 rounded-xl bg-navy-800/50 border border-white/5 text-xs text-slate-400 space-y-2">
          <p className="text-slate-300 font-medium">Demo credentials (development)</p>
          <button
            type="button"
            className="block w-full text-left hover:text-cyan transition"
            onClick={() => {
              setValue('email', 'manager@stocksense.local');
              setValue('password', 'Manager@123');
            }}
          >
            Manager: manager@stocksense.local / Manager@123
          </button>
          <button
            type="button"
            className="block w-full text-left hover:text-cyan transition"
            onClick={() => {
              setValue('email', 'staff@stocksense.local');
              setValue('password', 'Staff@123');
            }}
          >
            Staff: staff@stocksense.local / Staff@123
          </button>
        </div>
      </motion.div>
    </div>
  );
}
