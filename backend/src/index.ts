import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const dataDir = path.join(backendRoot, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(dataDir, 'stocksense.db').replace(/\\/g, '/')}`;
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'stocksense-dev-secret-change-me';
}

const PORT = Number(process.env.PORT) || 3001;

async function main() {
  // Ensure schema exists
  const { execSync } = await import('node:child_process');
  try {
    execSync('npx prisma db push --skip-generate', {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
    });
  } catch {
    console.warn('[db] prisma db push warning — continuing if schema already applied');
  }

  // Seed if empty (run as subprocess so prisma/seed stays outside tsc rootDir)
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log('[seed] No users found — running seed...');
    execSync('npx tsx prisma/seed.ts', {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
    });
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`StockSense AI API listening on http://localhost:${PORT}`);
    console.log(`Gemini configured: ${Boolean(process.env.GEMINI_API_KEY?.trim())}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
