import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const configPath = path.join(backendRoot, 'data', 'ai-config.json');

export type AiAgentConfig = {
  /** Runtime API key override (takes precedence over env when set) */
  apiKey?: string;
  model: string;
  temperature: number;
  /** Extra instructions appended to the system prompt */
  customInstructions: string;
  displayName: string;
  enabled: boolean;
};

const DEFAULTS: AiAgentConfig = {
  model: 'gemini-3.8-flash',
  temperature: 0.2,
  customInstructions: '',
  displayName: 'StockSense AI',
  enabled: true,
};

let cached: AiAgentConfig | null = null;

function ensureDataDir() {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadAiConfig(): AiAgentConfig {
  if (cached) return cached;
  ensureDataDir();
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<AiAgentConfig>;
      cached = { ...DEFAULTS, ...raw };
      return cached;
    }
  } catch (err) {
    console.warn('[ai-config] failed to read config, using defaults', err);
  }
  cached = { ...DEFAULTS };
  return cached;
}

export function saveAiConfig(update: Partial<AiAgentConfig>): AiAgentConfig {
  const current = loadAiConfig();
  const next: AiAgentConfig = {
    ...current,
    ...update,
    model: (update.model ?? current.model).trim() || DEFAULTS.model,
    temperature: clampTemp(update.temperature ?? current.temperature),
    customInstructions: update.customInstructions ?? current.customInstructions,
    displayName: (update.displayName ?? current.displayName).trim() || DEFAULTS.displayName,
    enabled: update.enabled ?? current.enabled,
  };

  // Only overwrite apiKey when explicitly provided (non-empty string)
  if (update.apiKey !== undefined) {
    const key = update.apiKey.trim();
    if (key) next.apiKey = key;
    else delete next.apiKey;
  }

  ensureDataDir();
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf8');
  cached = next;
  return next;
}

function clampTemp(t: number): number {
  if (Number.isNaN(t)) return DEFAULTS.temperature;
  return Math.min(1, Math.max(0, t));
}

export function getGeminiApiKey(): string {
  const cfg = loadAiConfig();
  const fromConfig = cfg.apiKey?.trim();
  if (fromConfig) return fromConfig;
  return process.env.GEMINI_API_KEY?.trim() || '';
}

export function isGeminiConfigured(): boolean {
  const cfg = loadAiConfig();
  if (!cfg.enabled) return false;
  const key = getGeminiApiKey();
  return Boolean(key && key !== 'invalid' && key.length > 8);
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return `${'•'.repeat(Math.min(12, key.length - 4))}${key.slice(-4)}`;
}

export function getPublicAiConfig() {
  const cfg = loadAiConfig();
  const key = getGeminiApiKey();
  return {
    available: isGeminiConfigured(),
    enabled: cfg.enabled,
    model: cfg.model,
    temperature: cfg.temperature,
    customInstructions: cfg.customInstructions,
    displayName: cfg.displayName,
    apiKeyConfigured: Boolean(key),
    apiKeyMasked: key ? maskApiKey(key) : '',
    keySource: cfg.apiKey ? 'settings' : process.env.GEMINI_API_KEY?.trim() ? 'env' : 'none',
    message: !cfg.enabled
      ? 'AI assistant is disabled in settings'
      : isGeminiConfigured()
        ? 'AI assistant is configured'
        : 'Gemini API key not configured — add a key in Settings or backend/.env',
  };
}

/** Reload from disk (e.g. after external edit) */
export function reloadAiConfig(): AiAgentConfig {
  cached = null;
  return loadAiConfig();
}
