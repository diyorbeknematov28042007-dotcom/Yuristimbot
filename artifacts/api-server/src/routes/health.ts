import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/api/healthz', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});
