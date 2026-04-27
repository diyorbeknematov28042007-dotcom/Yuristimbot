import type { Telegraf } from 'telegraf';

const CHANNELS = ['@LegalUz_Y_u', '@LegalUz_M_u', '@Yurist_ND'];
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  subscribed: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function clearSubscriptionCache(userId: string) {
  cache.delete(userId);
}

export async function checkSubscription(
  bot: Telegraf<any>,
  userId: string
): Promise<boolean> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.subscribed;
  }

  try {
    const results = await Promise.all(
      CHANNELS.map(async (channel) => {
        try {
          const member = await bot.telegram.getChatMember(channel, parseInt(userId));
          return ['member', 'administrator', 'creator'].includes(member.status);
        } catch {
          // If bot is not admin or can't check — assume subscribed
          return true;
        }
      })
    );

    const subscribed = results.every(Boolean);
    cache.set(userId, { subscribed, expiresAt: Date.now() + CACHE_TTL });
    return subscribed;
  } catch {
    return true;
  }
}
