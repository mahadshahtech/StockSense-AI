import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import stockRoutes from './routes/stock.js';
import dashboardRoutes from './routes/dashboard.js';
import supplierRoutes from './routes/suppliers.js';
import reportRoutes from './routes/reports.js';
import assistantRoutes from './routes/assistant.js';
import metaRoutes from './routes/meta.js';
import activityRoutes from './routes/activity.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      product: 'StockSense AI',
      client: 'Nowshera Shopping Mall',
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/suppliers', supplierRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/assistant', assistantRoutes);
  app.use('/api/meta', metaRoutes);
  app.use('/api/activity', activityRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
