import express from 'express';
import { createBot } from './bot/instance.js';
import { setupBot } from './bot/index.js';
import { initDb } from './db/index.js';
import { webhookRouter } from './routes/webhook.js';
import { healthRouter } from './routes/health.js';

const PORT = parseInt(process.env.PORT || '3000');
const DOMAIN = process.env.REPLIT_DOMAINS?.split(',')[0];

async function main() {
  // Init DB
  await initDb();

  // Create & setup bot
  const bot = createBot();
  setupBot(bot);

  const app = express();
  app.use(express.json());

  // Routes
  app.use(webhookRouter);
  app.use(healthRouter);

  // Start server
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server running on port ${PORT}`);

    if (DOMAIN) {
      // PRODUCTION: webhook mode
      const webhookUrl = `https://${DOMAIN}/api/telegram-webhook`;
      try {
        await bot.telegram.setWebhook(webhookUrl, {
          drop_pending_updates: true,
          max_connections: 100,
        });
        console.log(`✅ Webhook set: ${webhookUrl}`);
      } catch (err) {
        console.error('Webhook error:', err);
      }

      // Keep-alive ping every 4 minutes
      setInterval(async () => {
        try {
          await fetch(`https://${DOMAIN}/api/healthz`);
          console.log('🏓 Keep-alive ping sent');
        } catch {}
      }, 4 * 60 * 1000);
    } else {
      // DEVELOPMENT: polling mode
      try {
        await bot.telegram.deleteWebhook();
        console.log('🔄 Webhook deleted, starting polling...');
      } catch {}
      bot.launch({ dropPendingUpdates: true });
      console.log('✅ Bot started in polling mode');
    }
  });

  // Graceful shutdown
  process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
