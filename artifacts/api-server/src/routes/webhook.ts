import { Router } from 'express';
import { getBot } from '../bot/instance.js';

export const webhookRouter = Router();

webhookRouter.post('/api/telegram-webhook', async (req, res) => {
  // Always respond 200 to Telegram to avoid retries
  res.sendStatus(200);
  try {
    const bot = getBot();
    await bot.handleUpdate(req.body);
  } catch (err) {
    console.error('Webhook error:', err);
  }
});
