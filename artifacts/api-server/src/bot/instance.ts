import { Telegraf, session } from 'telegraf';

export interface SessionData {
  language: 'uz' | 'ru' | 'en';
  step: string;
  adType: 'client' | 'specialist' | null;
  adData: {
    field?: string;
    region?: string;
    experience?: string;
    price?: string;
    description?: string;
    contact?: string;
  };
  // Admin doc upload flow
  adminDocFlow?: {
    docType?: 'sample' | 'template';
    category?: string;
    fileId?: string;
    fileType?: string;
    nameUz?: string;
    nameRu?: string;
    nameEn?: string;
    code?: string;
    price?: number;
  };
  // Service request
  serviceType?: 'legal_consult' | 'doc_create' | 'support' | 'admin_msg';
  serviceDesc?: string;
  // Payment flow
  pendingDocCode?: string;
  // Card management
  cardFlow?: {
    ownerName?: string;
  };
  // Broadcast
  broadcastStep?: boolean;
}

export interface BotContext {
  session: SessionData;
}

type MyContext = import('telegraf').Context & { session: SessionData };

let botInstance: Telegraf<MyContext> | null = null;

export function createBot(): Telegraf<MyContext> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');

  const bot = new Telegraf<MyContext>(token);

  bot.use(
    session({
      defaultSession: (): SessionData => ({
        language: 'uz',
        step: 'start',
        adType: null,
        adData: {},
      }),
    })
  );

  botInstance = bot;
  return bot;
}

export function getBot(): Telegraf<MyContext> {
  if (!botInstance) throw new Error('Bot not initialized');
  return botInstance;
}
