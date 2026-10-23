import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Bot, Send, Loader2, Sparkles, Check, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../lib/toast';
import { useQueryClient } from '@tanstack/react-query';

type Proposal = {
  id: string;
  actionType: string;
  product: string;
  sku?: string;
  supplier?: string | null;
  quantity: number;
  currentStock: number;
  newStock: number;
  status: string;
};

type ChatItem = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  proposals?: Proposal[];
  available?: boolean;
};

const SUGGESTIONS = [
  'How many Type-C cables are left?',
  'How many sugar bags, rice bags and Type-C cables do we have?',
  'Which product sold the most this week?',
  'Show me low-stock products.',
  'Add 40 Type-C cables from Ali Traders.',
  'Sell 8 keyboards.',
  "What's the total inventory value?",
  'What was our profit this week?',
];

export default function AssistantPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm **StockSense AI** for Nowshera Shopping Mall. Ask me about stock levels, sales, low inventory, or request stock changes — I'll prepare a confirmation before anything is updated.",
      available: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setInput('');
    const userMsg: ChatItem = { id: `u-${Date.now()}`, role: 'user', content: message };
    setMessages((m) => [...m, userMsg]);

    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const res = await api<{
        reply: string;
        proposals: Proposal[];
        available: boolean;
        error?: string;
      }>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      });

      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          proposals: res.proposals,
          available: res.available,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: 'system',
          content: err instanceof ApiError ? err.message : 'Failed to reach assistant',
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function confirmProposal(proposalId: string) {
    setActingId(proposalId);
    try {
      const res = await api<{
        alreadyConfirmed: boolean;
        product: { currentStock: number; name?: string };
        movement: unknown;
      }>(`/stock/proposals/${proposalId}/confirm`, { method: 'POST' });

      toast(
        res.alreadyConfirmed
          ? 'Already confirmed — no duplicate change'
          : `Confirmed. New stock: ${res.product.currentStock}`,
        'success'
      );

      setMessages((msgs) =>
        msgs.map((msg) => ({
          ...msg,
          proposals: msg.proposals?.map((p) =>
            p.id === proposalId
              ? { ...p, status: 'CONFIRMED', currentStock: res.product.currentStock, newStock: res.product.currentStock }
              : p
          ),
        }))
      );

      setMessages((m) => [
        ...m,
        {
          id: `c-${Date.now()}`,
          role: 'system',
          content: res.alreadyConfirmed
            ? 'Proposal was already confirmed. Stock was not changed again.'
            : `Stock update confirmed. Inventory is now ${res.product.currentStock}.`,
        },
      ]);

      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['movements'] });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Confirm failed', 'error');
    } finally {
      setActingId(null);
    }
  }

  async function cancelProposal(proposalId: string) {
    setActingId(proposalId);
    try {
      await api(`/stock/proposals/${proposalId}/cancel`, { method: 'POST' });
      toast('Proposal cancelled — stock unchanged', 'info');
      setMessages((msgs) =>
        msgs.map((msg) => ({
          ...msg,
          proposals: msg.proposals?.map((p) =>
            p.id === proposalId ? { ...p, status: 'CANCELLED' } : p
          ),
        }))
      );
      setMessages((m) => [
        ...m,
        {
          id: `x-${Date.now()}`,
          role: 'system',
          content: 'Proposal cancelled. No inventory changes were made.',
        },
      ]);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Cancel failed', 'error');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="h-[calc(100vh-7.5rem)] flex flex-col max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <span className="gradient-text">AI Inventory Assistant</span>
          <Sparkles size={18} className="text-cyan" />
        </h1>
        <p className="text-sm text-slate-400">Grounded in live database records · Stock changes need your confirmation</p>
      </div>

      <div className="flex-1 glass rounded-3xl flex flex-col overflow-hidden border border-white/10">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-accent to-violet text-white rounded-br-md'
                      : m.role === 'system'
                        ? 'bg-navy-800/80 border border-white/10 text-slate-300'
                        : 'bg-navy-800/90 border border-white/5 text-slate-100 rounded-bl-md'
                  }`}
                >
                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 text-cyan">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-cyan grid place-items-center">
                        <Bot size={14} className="text-white" />
                      </div>
                      <span className="text-xs font-medium text-slate-300">StockSense AI</span>
                      {m.available === false && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning">Unavailable</span>
                      )}
                    </div>
                  )}
                  <div className="prose-invert prose-sm [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>

                  {m.proposals?.map((p) => (
                    <ProposalCard
                      key={p.id}
                      proposal={p}
                      busy={actingId === p.id}
                      onConfirm={() => confirmProposal(p.id)}
                      onCancel={() => cancelProposal(p.id)}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {sending && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 size={16} className="animate-spin text-cyan" />
              <span>Looking up inventory…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 pt-2 flex gap-2 overflow-x-auto pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={sending}
              onClick={() => send(s)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan/40 hover:text-cyan transition"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          className="p-4 border-t border-white/5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about inventory or request a stock change…"
            className="flex-1 bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-accent/50"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 rounded-xl bg-gradient-to-r from-accent to-violet disabled:opacity-50 active:scale-95 transition"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  busy,
  onConfirm,
  onCancel,
}: {
  proposal: Proposal;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const pending = proposal.status === 'PENDING';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-3 rounded-2xl border border-cyan/30 bg-gradient-to-br from-navy-900 to-navy-800 p-4 shadow-lg shadow-cyan/10"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-display font-semibold text-cyan">Stock Update Proposal</p>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full ${
            proposal.status === 'CONFIRMED'
              ? 'bg-success/20 text-success'
              : proposal.status === 'CANCELLED'
                ? 'bg-slate-500/20 text-slate-300'
                : 'bg-warning/20 text-warning'
          }`}
        >
          {proposal.status}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:text-sm">
        <div>
          <dt className="text-slate-500">Product</dt>
          <dd className="font-medium">{proposal.product}</dd>
        </div>
        {proposal.supplier && (
          <div>
            <dt className="text-slate-500">Supplier</dt>
            <dd className="font-medium">{proposal.supplier}</dd>
          </div>
        )}
        <div>
          <dt className="text-slate-500">Operation</dt>
          <dd className="font-medium">{proposal.actionType.replace(/_/g, ' ')}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Quantity</dt>
          <dd className="font-medium text-accent-soft">
            {proposal.actionType === 'STOCK_IN' ? '+' : '-'}
            {proposal.quantity}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Current Stock</dt>
          <dd className="font-medium">{proposal.currentStock}</dd>
        </div>
        <div>
          <dt className="text-slate-500">New Stock</dt>
          <dd className="font-medium text-success">{proposal.newStock}</dd>
        </div>
      </dl>
      {pending && (
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm hover:bg-white/5 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <X size={14} /> Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-accent to-cyan text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Confirm Stock Update
          </button>
        </div>
      )}
    </motion.div>
  );
}
