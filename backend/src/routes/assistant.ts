import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { chatWithAssistant } from '../ai/assistant.js';
import { getPublicAiConfig, saveAiConfig } from '../ai/config.js';
import { prisma } from '../db/prisma.js';

const router = Router();
router.use(authenticate);

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

router.post('/chat', async (req, res, next) => {
  try {
    const { message, history } = chatSchema.parse(req.body);
    const result = await chatWithAssistant(req.user!, message, history);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'AI_CHAT',
        entityType: 'Assistant',
        metadata: JSON.stringify({
          messagePreview: message.slice(0, 120),
          available: result.available,
          proposalCount: result.proposals.length,
        }),
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/status', async (_req, res) => {
  res.json(getPublicAiConfig());
});

router.get('/config', requireRole('MANAGER'), async (_req, res) => {
  res.json(getPublicAiConfig());
});

const configSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().min(1).max(120).optional(),
  temperature: z.number().min(0).max(1).optional(),
  customInstructions: z.string().max(4000).optional(),
  displayName: z.string().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  clearApiKey: z.boolean().optional(),
});

router.put('/config', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const data = configSchema.parse(req.body);
    const update: Parameters<typeof saveAiConfig>[0] = {};

    if (data.model !== undefined) update.model = data.model;
    if (data.temperature !== undefined) update.temperature = data.temperature;
    if (data.customInstructions !== undefined) update.customInstructions = data.customInstructions;
    if (data.displayName !== undefined) update.displayName = data.displayName;
    if (data.enabled !== undefined) update.enabled = data.enabled;
    if (data.clearApiKey) update.apiKey = '';
    else if (data.apiKey !== undefined && data.apiKey.trim()) update.apiKey = data.apiKey;

    saveAiConfig(update);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'AI_CONFIG_UPDATED',
        entityType: 'Assistant',
        metadata: JSON.stringify({
          model: data.model,
          temperature: data.temperature,
          enabled: data.enabled,
          apiKeyChanged: Boolean(data.apiKey?.trim()) || Boolean(data.clearApiKey),
          instructionsChanged: data.customInstructions !== undefined,
        }),
      },
    });

    res.json(getPublicAiConfig());
  } catch (err) {
    next(err);
  }
});

export default router;
