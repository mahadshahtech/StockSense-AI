import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../utils/errors.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (isAppError(err)) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code ?? 'APP_ERROR',
    });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
}
