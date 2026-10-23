import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Bot, Loader2, Save } from 'lucide-react';

type AiConfig = {
  available: boolean;
  enabled: boolean;
  model: string;
  temperature: number;
  customInstructions: string;
  displayName: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  keySource: string;
  message: string;
};

const MODEL_OPTIONS = [
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

export default function SettingsPage() {
  const { user, isManager } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api<AiConfig>('/assistant/status'),
  });

  const { data: aiConfig, isLoading: configLoading } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => api<AiConfig>('/assistant/config'),
    enabled: isManager,
  });

  const [displayName, setDisplayName] = useState('StockSense AI');
  const [model, setModel] = useState('gemini-3.8-flash');
  const [temperature, setTemperature] = useState(0.2);
  const [customInstructions, setCustomInstructions] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [clearKey, setClearKey] = useState(false);

  useEffect(() => {
    if (!aiConfig) return;
    setDisplayName(aiConfig.displayName);
    setModel(aiConfig.model);
    setTemperature(aiConfig.temperature);
    setCustomInstructions(aiConfig.customInstructions || '');
    setEnabled(aiConfig.enabled);
  }, [aiConfig]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<AiConfig>('/assistant/config', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast('AI agent settings saved', 'success');
      setApiKey('');
      setClearKey(false);
      qc.invalidateQueries({ queryKey: ['ai-config'] });
      qc.invalidateQueries({ queryKey: ['ai-status'] });
    },
    onError: (e: Error) => toast(e instanceof ApiError ? e.message : 'Save failed', 'error'),
  });

  function save(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      displayName,
      model,
      temperature,
      customInstructions,
      enabled,
    };
    if (clearKey) body.clearApiKey = true;
    else if (apiKey.trim()) body.apiKey = apiKey.trim();
    saveMutation.mutate(body);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="text-sm text-slate-400">Account and AI agent configuration</p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-display font-semibold">Profile</h2>
        <Row label="Name" value={user?.name || ''} />
        <Row label="Email" value={user?.email || ''} />
        <Row label="Role" value={isManager ? 'Manager' : 'Staff'} />
        <Row label="Department" value={user?.department?.name || 'All departments'} />
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <Bot size={18} className="text-cyan" /> AI Assistant Status
        </h2>
        <Row
          label="Status"
          value={
            aiStatus?.available
              ? `Ready (${aiStatus.model})`
              : aiStatus?.message || 'Unavailable'
          }
        />
        <Row label="Key source" value={aiStatus?.keySource || 'none'} />
        {!aiStatus?.available && (
          <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl px-3 py-2">
            The assistant needs a valid Google AI Studio Gemini API key (usually starts with{' '}
            <code className="text-cyan">AIza</code>). Paste it below (managers) or set{' '}
            <code className="text-cyan">GEMINI_API_KEY</code> in <code>backend/.env</code> and
            restart the backend.
          </p>
        )}
      </div>

      {isManager && (
        <form onSubmit={save} className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-semibold">Modify AI Agent</h2>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded"
              />
              Enabled
            </label>
          </div>

          {configLoading ? (
            <p className="text-sm text-slate-500">Loading config…</p>
          ) : (
            <>
              <Field label="Display name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Model">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
                >
                  {!MODEL_OPTIONS.includes(model) && (
                    <option value={model}>{model}</option>
                  )}
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={`Temperature (${temperature.toFixed(2)})`}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full"
                />
              </Field>

              <Field label="Custom instructions (tone, priorities — security rules still apply)">
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={5}
                  placeholder="e.g. Prefer short answers. Always mention department when listing low-stock items."
                  className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm resize-y"
                />
              </Field>

              <Field
                label={
                  aiConfig?.apiKeyConfigured
                    ? `Gemini API key (current: ${aiConfig.apiKeyMasked})`
                    : 'Gemini API key'
                }
              >
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setClearKey(false);
                  }}
                  placeholder="Paste new key to update (leave blank to keep current)"
                  className="w-full bg-navy-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
                  autoComplete="off"
                />
              </Field>

              {aiConfig?.apiKeyConfigured && (
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={clearKey}
                    onChange={(e) => setClearKey(e.target.checked)}
                  />
                  Clear settings key (fall back to backend/.env)
                </label>
              )}

              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-accent to-violet text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saveMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save AI settings
              </button>
            </>
          )}
        </form>
      )}

      {!isManager && (
        <p className="text-xs text-slate-500">
          Only managers can modify the AI agent. Ask a manager to update the Gemini key or
          instructions in Settings.
        </p>
      )}

      <div className="glass rounded-2xl p-6 space-y-2">
        <h2 className="font-display font-semibold">About</h2>
        <p className="text-sm text-slate-300">StockSense AI — Intelligent Inventory Management</p>
        <p className="text-sm text-slate-500">Client: Nowshera Shopping Mall</p>
        <p className="text-sm text-slate-500">Tagline: Smarter Inventory. Better Decisions.</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm border-b border-white/5 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
